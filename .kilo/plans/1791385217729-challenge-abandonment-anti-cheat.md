# Challenge Abandonment & Anti-Cheat Specification

## Problem Statement

Players can currently "peek" at any challenge (see the board, fixed placements, and mentally solve it), press the back button with zero consequences, then re-enter the same challenge and solve it in seconds with a fresh timer and clean fail count. This completely undermines leaderboards, world records, and the integrity of progression stats.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Timer model for Normal | Timestamp at start, timestamp at validate, elapsed = diff | Prevents peek-and-retry; simple and tamper-resistant |
| Timer model for Daily | Persistent (same as Normal, but cannot abandon) | Daily is single-attempt; the timer accumulates across re-entries |
| Abandon in Normal mode | Marks challenge as abandoned; 30-min cooldown on same challenge | Discourages serial peeking without permanently blocking |
| Abandon in Daily mode | Not allowed; dialog warns timer keeps running | Daily is the competitive mode; no escape |
| Abandon in Friends mode | Keep current behavior (quit = consume attempt) | Already correct |
| Hardware back button (Android) | Intercept with same confirmation dialog as the UI button | Prevent bypass |
| Swipe-to-go-back (iOS) | Disable via `gestureEnabled: false` on game screens | Prevent bypass |

---

## Terminology

- **`challengeStartedAt`**: ISO timestamp of when the player first opened this specific `challengeId` (persisted in `playerStore`)
- **`challengeAbandonedAt`**: ISO timestamp of when the player abandoned (persisted in `playerStore`)
- **`abandonCooldownMs`**: 30 minutes = `1_800_000` ms
- **`abandonCount`**: per-challenge counter (persisted in `playerStore.stats`)

---

## Scenario 1 — Normal Mode (`app/game/[challengeId].tsx`)

### State Changes in `playerStore`

Add to `PlayerStats`:
```ts
challengeStartedAt: Record<string, number>;   // challengeId → Date.now() of first open
challengeAbandonedAt: Record<string, number>; // challengeId → Date.now() of abandon
abandonCount: Record<string, number>;         // challengeId → total abandon count
```

Add to `PersistedPlayerState` in `useStorage.ts` (same 3 fields).

Add actions in `playerStore`:
```ts
markChallengeStarted: (challengeId: string) => void;
markChallengeAbandoned: (challengeId: string) => void;
clearChallengeTimestamps: (challengeId: string) => void; // called on victory
getChallengeElapsed: (challengeId: string) => number;    // cumulative elapsed
isChallengeOnCooldown: (challengeId: string) => { onCooldown: boolean; remainingMs: number };
```

### Timer Behavior

**On challenge load** (`[challengeId].tsx` useEffect):
1. Check `isChallengeOnCooldown(challengeId)`:
   - If on cooldown → show "cooldown" UI (see below), do NOT load the challenge
   - If not on cooldown → proceed
2. Check `challengeStartedAt[challengeId]`:
   - If exists (returning to a previously-opened challenge) → compute `priorElapsed = abandonedAt - startedAt` (or current accumulated time). The timer starts from this offset.
   - If not exists (first time opening) → call `markChallengeStarted(challengeId)` with `Date.now()`. Timer starts from 0.
3. `game.loadChallenge(found)` as before, but `startTime` is set to `Date.now() - priorElapsed` so `elapsedTime` reflects total thinking time.

**On victory** (`isVictory` useEffect):
1. `elapsedTime` at validation = `Date.now() - startTime`. Since `startTime` was backdated by `priorElapsed`, this automatically includes all prior viewing time.
2. Call `player.clearChallengeTimestamps(challengeId)` to remove `challengeStartedAt` and `challengeAbandonedAt` entries (cleanup).
3. The rest of the victory flow (markChallengeCompleted, badges, Firestore sync) is unchanged.

**On abandon** (back button press):
1. Show `AbandonConfirmModal` (new component, see below).
2. If user confirms:
   - `player.markChallengeAbandoned(challengeId)` → stores `challengeAbandonedAt[challengeId] = Date.now()`, increments `abandonCount[challengeId]`
   - `game.resetGame()`
   - `router.replace('/(tabs)/levels')`
3. If user cancels: dismiss modal, resume game.

### UI: Back Button

Replace:
```tsx
<TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
  <Text style={styles.backText}>← Retour</Text>
</TouchableOpacity>
```

With:
```tsx
<TouchableOpacity onPress={handleAbandon} style={styles.backBtn}>
  <Text style={styles.backText}>← Abandonner</Text>
</TouchableOpacity>
```

### UI: AbandonConfirmModal (Normal Mode)

New component `src/components/Game/AbandonConfirmModal.tsx`.

**Content:**
- Title: "Abandonner ce defi ?"
- Message: "Le chrono ne s'arretera pas. Tu pourras retenter ce defi dans 30 minutes."
- Icon: warning icon (amber)
- Button primary: "Continuer a jouer" (green, dismisses modal)
- Button secondary: "Abandonner" (red text, confirms abandon)

### UI: Cooldown Screen (Normal Mode)

When a player navigates to a challenge that is on cooldown, instead of loading the game, show an inline view (not a modal):
- Icon: hourglass
- Title: "Defi en pause"
- Message: "Tu pourras retenter ce defi dans {MM}min {SS}s"
- Live countdown (recalculated every second from `challengeAbandonedAt + abandonCooldownMs - Date.now()`)
- Button: "Retour aux niveaux" → `router.replace('/(tabs)/levels')`
- When countdown reaches 0: auto-redirect or show "Reprendre" button

### Hardware/Gesture Back Prevention

In `[challengeId].tsx`, add:
```tsx
import { BackHandler } from 'react-native';

// Intercept Android hardware back button
useEffect(() => {
  const sub = BackHandler.addEventListener('hardwareBackPress', () => {
    handleAbandon(); // show the confirmation modal
    return true;     // prevent default back navigation
  });
  return () => sub.remove();
}, []);
```

For Expo Router, set screen options to disable swipe-to-go-back:
```tsx
// In app/game/_layout.tsx or via Stack.Screen options
<Stack.Screen
  name="[challengeId]"
  options={{ gestureEnabled: false }}
/>
```

### Edge Cases

| Scenario | Behavior |
|---|---|
| Player force-kills the app mid-game | `challengeStartedAt` is persisted. On next open, timer resumes from stored start time. No abandon recorded → no cooldown → player can re-enter immediately but with accumulated time. |
| Player completes challenge after prior abandon | `clearChallengeTimestamps` removes all abandon/start data. The recorded `bestTime` includes all elapsed time from all sessions. |
| Player replays a completed challenge | `challengeStartedAt` gets a new fresh timestamp (previous was cleared on victory). Timer starts from 0. Normal flow. |
| Cooldown expires while app is closed | On next open, `isChallengeOnCooldown` returns false. Player can re-enter. `challengeStartedAt` is preserved → timer resumes from accumulated elapsed. |
| Player abandons N times in a row | Each abandon restarts the 30-min cooldown from the new abandon timestamp. `abandonCount` increments each time. The accumulated timer keeps growing (startedAt stays the same, only abandonedAt updates). |

---

## Scenario 2 — Daily Mode (`app/game/daily.tsx`)

### Timer Behavior

Same persistent timer model as Normal mode, using a fixed daily challenge key (e.g., `daily_2026-10-07`).

**On daily load:**
1. Check `dailyChallengeStatus`:
   - Already `'success'` or `'failed'` for today → redirect (existing behavior)
   - `null` → proceed
2. Check `challengeStartedAt[dailyKey]`:
   - Exists → compute `priorElapsed`, backdate `startTime`
   - Not exists → `markChallengeStarted(dailyKey)`, timer from 0
3. Set `dailyChallengeStatus = 'in_progress'` (new status value) to distinguish "never opened" from "opened but not finished"

### Back Button Behavior

Replace the current back button with:
```tsx
<TouchableOpacity onPress={handleDailyBack} style={styles.backBtn}>
  <Text style={styles.backText}>← Abandonner</Text>
</TouchableOpacity>
```

**`handleDailyBack`:**
1. Show `DailyAbandonConfirmModal` (different from Normal mode modal)
2. Content:
   - Title: "Quitter le Defi du Jour ?"
   - Message: "Tu ne pourras plus retenter ce defi. Il sera compte comme un echec."
   - Icon: warning icon (red)
   - Button primary: "Continuer a jouer" (green, dismisses modal)
   - Button secondary: "Abandonner" (red, confirms)
3. If confirmed:
   - `player.submitDailyResult(dailyDate, false)` → marks as failed, resets streak
   - `player.clearChallengeTimestamps(dailyKey)`
   - `game.resetGame()`
   - `router.replace('/(tabs)')`

### State Change: New `dailyChallengeStatus` Value

Add `'in_progress'` to the existing union type:
```ts
dailyChallengeStatus: 'pending' | 'in_progress' | 'success' | 'failed' | null;
```

The `'in_progress'` status is set when the daily is first loaded. It distinguishes "player has seen the board" from "player has never opened the daily today". On app restart, if status is `'in_progress'` and the date matches today, the player can re-enter but the timer resumes.

### Hardware/Gesture Back Prevention

Same pattern as Normal mode: intercept `BackHandler` + `gestureEnabled: false`.

### Edge Cases

| Scenario | Behavior |
|---|---|
| Player opens daily, quits app, comes back | `dailyChallengeStatus = 'in_progress'` + `challengeStartedAt[dailyKey]` exists → timer resumes, player continues |
| Player opens daily, presses abandon | Counted as failure. Daily cannot be retried. "Rendez-vous demain" |
| Date rolls over while daily is in progress | On re-entry, `getDailyDateString()` returns a new date → the old `in_progress` is stale. Generate new daily for the new date. Old `challengeStartedAt` for yesterday's key is irrelevant. |
| Player force-kills during daily | Same as "quits app" — timer resumes on re-entry. Not counted as failure until explicit abandon or validation failure. |

---

## Scenario 3 — Friends Mode (`app/game/friend-challenge.tsx`)

### No Changes

Current behavior is already correct:
- "Quitter" button calls `handleClose()` which calls `game.resetGame()` and navigates back
- For Player A (challenger): quitting means the challenge is never sent. The token was already spent to generate the challenge.
- For Player B (opponent): quitting means the challenge remains unanswered in Firestore.
- No timer persistence needed (friend challenges are ephemeral, one-shot).

The only minor addition: confirm dialog on the "Quitter" button (optional, low priority). Not part of this spec's scope.

---

## Implementation Task List

### Store Changes

1. **`playerStore.ts`** — Add new state fields:
   - `challengeStartedAt: Record<string, number>` (init `{}`)
   - `challengeAbandonedAt: Record<string, number>` (init `{}`)
   - `stats.abandonCount: Record<string, number>` (init `{}`)
   - Update `dailyChallengeStatus` type to include `'in_progress'`

2. **`playerStore.ts`** — Add new actions:
   - `markChallengeStarted(challengeId)` — sets `challengeStartedAt[id] = Date.now()` if not already set
   - `markChallengeAbandoned(challengeId)` — sets `challengeAbandonedAt[id] = Date.now()`, increments `abandonCount[id]`
   - `clearChallengeTimestamps(challengeId)` — deletes `challengeStartedAt[id]` and `challengeAbandonedAt[id]`
   - `isChallengeOnCooldown(challengeId)` — returns `{ onCooldown, remainingMs }` based on `challengeAbandonedAt[id] + 1_800_000 vs Date.now()`
   - `getChallengeElapsed(challengeId)` — returns `(challengeAbandonedAt[id] ?? Date.now()) - challengeStartedAt[id]` or 0 if no start

3. **`playerStore.ts`** — Update `markChallengeCompleted`:
   - After successful completion, call `clearChallengeTimestamps(challengeId)` internally

4. **`playerStore.ts`** — Update `logout`:
   - Add `challengeStartedAt: {}, challengeAbandonedAt: {}` to reset block

5. **`useStorage.ts`** — Add persistence for `challengeStartedAt`, `challengeAbandonedAt`, `stats.abandonCount`, updated `dailyChallengeStatus` type
   - Add to `PersistedPlayerState` interface
   - Add to `extractPersistable()`
   - Add to restore `useEffect` with defaults `?? {}`
   - Add `challengeStartedAt`/`challengeAbandonedAt` to the `changed` check in `subscribe()`

### New Components

6. **`src/components/Game/AbandonConfirmModal.tsx`** — Confirmation dialog for Normal mode
   - Props: `visible`, `remainingCooldownText: string`, `onContinue`, `onAbandon`
   - Animated appearance (reuse FailModal animation pattern)
   - Amber warning style

7. **`src/components/Game/DailyAbandonConfirmModal.tsx`** — Confirmation dialog for Daily mode  
   - Props: `visible`, `onContinue`, `onAbandon`
   - Red warning style (more severe — irreversible)

8. **`src/components/Game/CooldownScreen.tsx`** — Inline view for cooldown state
   - Props: `remainingMs: number`, `onBack: () => void`
   - Live countdown timer (useEffect + setInterval)
   - Hourglass icon + message

### Screen Updates

9. **`app/game/[challengeId].tsx`** — Normal mode:
   - Import `BackHandler` from react-native
   - Add `useState` for `showAbandonModal`
   - Add `handleAbandon` function (shows modal)
   - Replace "← Retour" button with "← Abandonner" + `handleAbandon`
   - Add `BackHandler` useEffect
   - Add cooldown check in challenge load useEffect: if on cooldown, render `CooldownScreen` instead of game
   - Add timer resume logic: compute `priorElapsed` from `challengeStartedAt`, pass to `game.startTimer()` or backdate `startTime`
   - Call `player.markChallengeStarted(challengeId)` on first load
   - Call `player.clearChallengeTimestamps(challengeId)` on victory
   - Render `AbandonConfirmModal`

10. **`app/game/daily.tsx`** — Daily mode:
    - Import `BackHandler` from react-native
    - Add `useState` for `showDailyAbandonModal`
    - Add `handleDailyBack` function (shows modal)
    - Replace "← Retour" button with "← Abandonner" + `handleDailyBack`
    - Add `BackHandler` useEffect
    - Add timer resume logic (same pattern as Normal)
    - Set `dailyChallengeStatus = 'in_progress'` on first load
    - On abandon confirm: `submitDailyResult(date, false)` + navigate out
    - Render `DailyAbandonConfirmModal`

11. **`app/game/friend-challenge.tsx`** — No changes required.

### Routing Config

12. **`app/game/_layout.tsx`** — If this file exists, set `gestureEnabled: false` for game screens. If it doesn't exist, create a minimal Stack layout:
    ```tsx
    import { Stack } from 'expo-router';
    export default function GameLayout() {
      return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />;
    }
    ```
    This prevents iOS swipe-to-go-back on all game screens.

### gameStore Changes

13. **`gameStore.ts`** — Update `startTimer`:
    - Accept an optional `elapsedOffset?: number` parameter
    - `startTimer: (elapsedOffset) => set({ startTime: Date.now() - (elapsedOffset ?? 0) })`
    - This allows the timer to resume from a prior elapsed value without changing the tick logic

14. **`useGame.ts`** — Expose the updated `startTimer` with offset support.

---

## Data Flow Summary

### Normal Mode — First Open
```
Player opens challenge
  → playerStore.markChallengeStarted(id) [sets challengeStartedAt[id] = now]
  → gameStore.loadChallenge(challenge)
  → gameStore.startTimer(0)              [timer from 0]
  → Player plays...
  → Validates → Victory
    → playerStore.markChallengeCompleted(id, elapsedTime, errorCount)
    → playerStore.clearChallengeTimestamps(id) [cleanup]
```

### Normal Mode — Abandon + Return
```
Player opens challenge (already started)
  → playerStore.isChallengeOnCooldown(id)
    → if cooldown active: show CooldownScreen, STOP
    → if cooldown expired: proceed
  → priorElapsed = challengeAbandonedAt[id] - challengeStartedAt[id]
  → gameStore.loadChallenge(challenge)
  → gameStore.startTimer(priorElapsed)   [timer resumes from prior elapsed]
  → Player presses "Abandonner"
    → Show AbandonConfirmModal
    → Confirm:
      → playerStore.markChallengeAbandoned(id) [sets abandonedAt, increments abandonCount]
      → gameStore.resetGame()
      → router.replace('/(tabs)/levels')
```

### Daily Mode
```
Player opens daily (first time today)
  → playerStore sets dailyChallengeStatus = 'in_progress'
  → playerStore.markChallengeStarted('daily_2026-10-07')
  → gameStore.loadDailyChallenge(challenge)
  → After briefing: gameStore.startTimer(0)

Player quits app and returns
  → dailyChallengeStatus === 'in_progress' + date matches today
  → priorElapsed = now - challengeStartedAt['daily_2026-10-07']
  → Resume with startTimer(priorElapsed)

Player presses "Abandonner"
  → DailyAbandonConfirmModal shown
  → Confirm:
    → submitDailyResult(date, false) [marks failed, resets streak]
    → clearChallengeTimestamps(dailyKey)
    → resetGame() + navigate out
```

---

## Validation Plan

1. **Normal mode — peek prevention**: Open challenge, note timer at 10s, press back, confirm abandon. Wait 30 min (or temporarily reduce cooldown to 10s for testing). Re-enter: timer should show ~10s+ (not 0).
2. **Normal mode — cooldown**: Abandon a challenge, immediately try to re-enter the same one. Should see CooldownScreen with countdown.
3. **Normal mode — victory clears state**: Complete a challenge after a prior abandon. Verify `challengeStartedAt` and `challengeAbandonedAt` are cleaned up.
4. **Daily mode — timer persistence**: Open daily, wait 15s, force-kill app, reopen, navigate to daily. Timer should show ~15s+.
5. **Daily mode — abandon = failure**: Open daily, press abandon, confirm. Verify `dailyChallengeStatus === 'failed'` and streak is reset. Verify daily cannot be re-entered.
6. **Friends mode — unchanged**: Verify "Quitter" still works as before (no modal, no cooldown).
7. **Android hardware back**: In Normal/Daily mode, press Android back button. Confirm modal should appear, not raw navigation.
8. **iOS swipe back**: Verify swipe-to-go-back is disabled on game screens.
9. **AsyncStorage persistence**: Abandon a challenge, kill app, reopen. Verify cooldown and timer data survived.
10. **Replay completed challenge**: Complete a challenge, then replay it from levels screen. Timer should start fresh from 0 (timestamps were cleared on victory).

---

## Out of Scope

- Server-side timer validation (would require Firestore writes on challenge start — deferred to future anti-cheat hardening)
- Changing the number of challenges per level or challenge rotation on abandon
- Adding abandon-related badges (could be future work)
- Confirmation dialog on friend-challenge "Quitter" button (low priority, already has token cost as deterrent)
- i18n of new modal strings (can be added in a follow-up pass using `useT()`)
