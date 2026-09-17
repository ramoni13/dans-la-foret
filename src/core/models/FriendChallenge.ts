// ============================================================
// MODÈLE DU MODE DÉFI ENTRE AMIS
// ============================================================

export interface FriendChallenge {
  id: string;
  challengeId: string; // Référence au défi de base

  challenger: ChallengeParticipant & {
    completionTime: number;  // Temps en ms (déjà joué)
    bonusUsed: string[];     // IDs des bonus utilisés
    completedAt: string;
  };

  challenged: ChallengeParticipant & {
    completionTime?: number; // Null si pas encore joué
    bonusUsed?: string[];
    completedAt?: string;
    status: ChallengeStatus;
  };

  result?: {
    winnerId: string;
    timeDifference: number; // En ms
  };

  expiresAt: string;  // ISO date — expire après 48h
  shareLink: string;  // Deep link de partage
  createdAt: string;
}

export interface ChallengeParticipant {
  userId: string;
  username: string;
  avatarUrl?: string;
}

export type ChallengeStatus =
  | 'pending'
  | 'accepted'
  | 'completed'
  | 'expired';
