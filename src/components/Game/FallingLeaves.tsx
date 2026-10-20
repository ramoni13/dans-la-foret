// ============================================================
// FALINGLEAVES — Particules en arrière-plan du jeu
// Thèmes : feuilles (défaut), papillons, oiseaux
// 100% Animated natif, aucune dépendance externe
// ============================================================

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions, Platform } from 'react-native';
import { usePlayerStore, VisualEffect } from '../../store/playerStore';

const native = Platform.OS !== 'web';

// ── Emojis par thème ─────────────────────────────────────────
// Papillons : uniquement des papillons (pas de fleurs)
// Oiseaux   : uniquement des oiseaux (pas de plumes)
const THEME_EMOJIS: Record<VisualEffect, string[]> = {
  leaves:      ['🍃', '🍂', '🌿', '🍁'],
  butterflies: ['🦋'],
  birds:       ['🐦', '🕊️', '🐦‍⬛', '🦅', '🦉', '🦜'],
  none:        [],
};

// Oiseaux dont l'emoji est naturellement orienté vers la droite.
// 🕊️ regarde à droite → à inverser quand il va vers la gauche.
// Tous les autres (🐦, 🐦‍⬛, 🦅, 🦉, 🦜) regardent à gauche par défaut.
const BIRD_EMOJIS_FACING_RIGHT = new Set(['🕊️']);

const PARTICLE_COUNT = native ? 10 : 7;
const BIRD_COUNT     = native ? 7  : 5;

// ── Types ─────────────────────────────────────────────────────

interface LeafParticle {
  kind:    'leaf';
  x:       Animated.Value;
  y:       Animated.Value;
  rotate:  Animated.Value;
  opacity: Animated.Value;
  emoji:   string;
  size:    number;
  startX:  number;
  delay:   number;
  duration: number;
}

interface ButterflyParticle {
  kind:    'butterfly';
  // Position courante (absolue depuis coin supérieur gauche)
  posX:    Animated.Value;
  posY:    Animated.Value;
  opacity: Animated.Value;
  emoji:   string;
  size:    number;
  delay:   number;
  hue:     number;  // rotation de teinte 0-359 pour varier la couleur du papillon
}

interface BirdParticle {
  kind:     'bird';
  x:        Animated.Value;  // translation horizontale depuis startX
  bobY:     Animated.Value;  // ondulation verticale (battement d'ailes)
  opacity:  Animated.Value;
  scaleX:   Animated.Value;  // +1 = orienté droite (arrivée gauche), -1 = orienté gauche (arrivée droite)
  emoji:    string;
  size:     number;
  delay:    number;
  duration: number;
  fromLeft: boolean;
  startY:   number;
}

type Particle = LeafParticle | ButterflyParticle | BirdParticle;

// ── Fabrique feuilles ─────────────────────────────────────────

function createLeafParticle(i: number, emojis: string[]): LeafParticle {
  const { width } = Dimensions.get('screen');
  return {
    kind:     'leaf',
    x:        new Animated.Value(0),
    y:        new Animated.Value(-60),
    rotate:   new Animated.Value(0),
    opacity:  new Animated.Value(0),
    emoji:    emojis[i % emojis.length],
    size:     native ? 20 + Math.floor(Math.random() * 14) : 16 + Math.floor(Math.random() * 12),
    startX:   Math.random() * width,
    delay:    i * 1200 + Math.random() * 800,
    duration: 4000 + Math.random() * 3000,
  };
}

// ── Fabrique papillons ────────────────────────────────────────

// Palettes de teintes réparties sur le spectre pour maximiser la diversité visuelle
const BUTTERFLY_HUES = [0, 30, 60, 120, 180, 210, 270, 300, 340];

function createButterflyParticle(i: number, emojis: string[]): ButterflyParticle {
  return {
    kind:    'butterfly',
    posX:    new Animated.Value(0),
    posY:    new Animated.Value(0),
    opacity: new Animated.Value(0),
    emoji:   emojis[i % emojis.length],
    size:    native ? 20 + Math.floor(Math.random() * 10) : 16 + Math.floor(Math.random() * 8),
    delay:   i * 1100 + Math.random() * 700,
    hue:     BUTTERFLY_HUES[i % BUTTERFLY_HUES.length],
  };
}

// ── Fabrique oiseaux ──────────────────────────────────────────

function createBirdParticle(i: number, emojis: string[]): BirdParticle {
  const { height } = Dimensions.get('screen');
  // Direction aléatoire indépendante de l'index
  const fromLeft = Math.random() < 0.5;
  // Emoji aléatoire parmi ceux disponibles
  const emoji = emojis[Math.floor(Math.random() * emojis.length)];
  return {
    kind:     'bird',
    x:        new Animated.Value(0),
    bobY:     new Animated.Value(0),
    opacity:  new Animated.Value(0),
    scaleX:   new Animated.Value(1), // calculé dynamiquement dans animateBird
    emoji,
    size:     native ? 24 + Math.floor(Math.random() * 12) : 19 + Math.floor(Math.random() * 10),
    delay:    i * 2400 + Math.random() * 1600,
    duration: 6000 + Math.random() * 4000,
    fromLeft,
    startY:   height * (0.05 + Math.random() * 0.4),
  };
}

// ── Animation feuille ─────────────────────────────────────────

function animateLeaf(p: LeafParticle, onDone: () => void) {
  const { width, height } = Dimensions.get('screen');
  const swayX = (Math.random() - 0.5) * 100;
  p.startX = Math.random() * width;
  p.x.setValue(0);
  p.y.setValue(-80);
  p.rotate.setValue(0);
  p.opacity.setValue(0);

  Animated.sequence([
    Animated.delay(p.delay),
    Animated.parallel([
      Animated.timing(p.opacity, {
        toValue: native ? 0.9 : 0.75,
        duration: 500,
        useNativeDriver: native,
      }),
      Animated.timing(p.y, {
        toValue: height + 100,
        duration: p.duration,
        useNativeDriver: native,
      }),
      Animated.sequence([
        Animated.timing(p.x, { toValue: swayX,      duration: p.duration / 3, useNativeDriver: native }),
        Animated.timing(p.x, { toValue: -swayX / 2, duration: p.duration / 3, useNativeDriver: native }),
        Animated.timing(p.x, { toValue: swayX / 3,  duration: p.duration / 3, useNativeDriver: native }),
      ]),
      Animated.timing(p.rotate, {
        toValue: 4,
        duration: p.duration,
        useNativeDriver: native,
      }),
      Animated.sequence([
        Animated.delay(p.duration * 0.8),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: p.duration * 0.2,
          useNativeDriver: native,
        }),
      ]),
    ]),
  ]).start(onDone);
}

// ── Animation papillon ────────────────────────────────────────
// Le papillon entre depuis un bord quelconque et se déplace en
// ondulant vers une zone cible au centre de l'écran, en tracant
// une trajectoire sinusoïdale (sinon le mouvement paraît rectiligne).
// Il repart ensuite vers le bord opposé.
//
// Implémentation : on décompose le trajet en N petits segments
// dont chaque segment dévie perpendiculairement à la direction
// principale → donne un vol en zigzag doux caractéristique du papillon.

function animateButterfly(p: ButterflyParticle, onDone: () => void) {
  const { width, height } = Dimensions.get('screen');

  // Choisir un côté d'entrée aléatoire
  const side = Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3;
  let startX = 0, startY = 0;
  switch (side) {
    case 0: startX = Math.random() * width; startY = -50; break;          // haut
    case 1: startX = Math.random() * width; startY = height + 50; break;  // bas
    case 2: startX = -50; startY = height * (0.1 + Math.random() * 0.8); break; // gauche
    case 3: startX = width + 50; startY = height * (0.1 + Math.random() * 0.8); break; // droite
  }

  // Zone cible : centre mou (évite les bords)
  const targetX = width  * (0.15 + Math.random() * 0.7);
  const targetY = height * (0.15 + Math.random() * 0.65);

  // Durées douces — pas de phase rectiligne rapide
  const segCount    = 6 + Math.floor(Math.random() * 4);   // 6-9 segments de zigzag
  const totalFlyIn  = 5000 + Math.random() * 3000;          // 5-8 s pour entrer
  const hoverTime   = 3000 + Math.random() * 3000;          // 3-6 s de vol sur place
  const totalFlyOut = 4000 + Math.random() * 2000;          // 4-6 s pour sortir
  const segDur      = totalFlyIn / segCount;

  const perpDirX = -(targetY - startY);  // vecteur perpendiculaire à la direction principale
  const perpDirY =   targetX - startX;
  const perpLen  = Math.sqrt(perpDirX * perpDirX + perpDirY * perpDirY) || 1;
  const perpNX   = perpDirX / perpLen;
  const perpNY   = perpDirY / perpLen;
  const waveAmp  = 30 + Math.random() * 40; // amplitude du zigzag (pixels)

  // Construire la séquence de zigzag pour posX et posY
  const xSegs: Animated.CompositeAnimation[] = [];
  const ySegs: Animated.CompositeAnimation[] = [];

  for (let s = 0; s < segCount; s++) {
    const t = (s + 1) / segCount;
    const baseX = startX + (targetX - startX) * t;
    const baseY = startY + (targetY - startY) * t;
    const sign  = s % 2 === 0 ? 1 : -1;
    // Amplitude décroît vers la fin pour arriver "posé"
    const amp   = waveAmp * (1 - t * 0.5) * sign;
    xSegs.push(Animated.timing(p.posX, { toValue: baseX + perpNX * amp, duration: segDur, useNativeDriver: native }));
    ySegs.push(Animated.timing(p.posY, { toValue: baseY + perpNY * amp, duration: segDur, useNativeDriver: native }));
  }

  // Phase de vol sur place : oscillation douce en zigzag autour de la cible
  const hoverSegCount = 8 + Math.floor(Math.random() * 6);
  const hoverSegDur   = hoverTime / hoverSegCount;
  const hoverAmp      = 15 + Math.random() * 25;
  const hoverXSegs: Animated.CompositeAnimation[] = [];
  const hoverYSegs: Animated.CompositeAnimation[] = [];

  for (let s = 0; s < hoverSegCount; s++) {
    const sign  = s % 2 === 0 ? 1 : -1;
    const angle = (s / hoverSegCount) * Math.PI * 2;
    hoverXSegs.push(Animated.timing(p.posX, {
      toValue: targetX + Math.cos(angle) * hoverAmp * sign,
      duration: hoverSegDur,
      useNativeDriver: native,
    }));
    hoverYSegs.push(Animated.timing(p.posY, {
      toValue: targetY + Math.sin(angle) * hoverAmp * 0.6,
      duration: hoverSegDur,
      useNativeDriver: native,
    }));
  }

  // Phase de sortie : retourne vers le bord (avec un peu de zigzag)
  const outSegCount = 4 + Math.floor(Math.random() * 3);
  const outSegDur   = totalFlyOut / outSegCount;
  const outXSegs: Animated.CompositeAnimation[] = [];
  const outYSegs: Animated.CompositeAnimation[] = [];

  for (let s = 0; s < outSegCount; s++) {
    const t = (s + 1) / outSegCount;
    const baseX = targetX + (startX - targetX) * t;
    const baseY = targetY + (startY - targetY) * t;
    const sign  = s % 2 === 0 ? -1 : 1;
    const amp   = waveAmp * 0.4 * sign * (1 - t * 0.6);
    outXSegs.push(Animated.timing(p.posX, { toValue: baseX + perpNX * amp, duration: outSegDur, useNativeDriver: native }));
    outYSegs.push(Animated.timing(p.posY, { toValue: baseY + perpNY * amp, duration: outSegDur, useNativeDriver: native }));
  }

  p.posX.setValue(startX);
  p.posY.setValue(startY);
  p.opacity.setValue(0);

  Animated.sequence([
    Animated.delay(p.delay),
    // Fade in
    Animated.timing(p.opacity, { toValue: 0.85, duration: 600, useNativeDriver: native }),
    // Vol en zigzag vers la cible
    Animated.parallel([
      Animated.sequence(xSegs),
      Animated.sequence(ySegs),
    ]),
    // Vol sur place en zigzag doux
    Animated.parallel([
      Animated.sequence(hoverXSegs),
      Animated.sequence(hoverYSegs),
    ]),
    // Sortie en zigzag + fade out simultanés
    Animated.parallel([
      Animated.sequence(outXSegs),
      Animated.sequence(outYSegs),
      Animated.sequence([
        Animated.delay(totalFlyOut * 0.6),
        Animated.timing(p.opacity, { toValue: 0, duration: totalFlyOut * 0.4, useNativeDriver: native }),
      ]),
    ]),
  ]).start(onDone);
}

// ── Animation oiseau ──────────────────────────────────────────
// Traverse l'écran horizontalement de gauche à droite ou droite à gauche.
// L'emoji est orienté selon la direction :
//   - arrivée de gauche  → scaleX +1 (orienté vers la droite)
//   - arrivée de droite  → scaleX -1 (orienté vers la gauche)
// Ondulation verticale douce simulant les battements d'ailes.

function animateBird(p: BirdParticle, onDone: () => void) {
  const { width } = Dimensions.get('screen');

  const startX = p.fromLeft ? -(p.size + 10) : width + p.size + 10;
  const endX   = p.fromLeft ? width + p.size + 10 : -(p.size + 10);
  const startY = p.startY + (Math.random() - 0.5) * 50;

  // Orientation : les emojis "facing right" par défaut ont besoin d'un flip
  // supplémentaire pour regarder dans le sens du vol.
  // fromLeft=true  → l'oiseau va vers la droite → emoji "facing left" = OK (+1), "facing right" = flip (-1)
  // fromLeft=false → l'oiseau va vers la gauche → emoji "facing left" = flip (-1), "facing right" = OK (+1)
  const facingRight = BIRD_EMOJIS_FACING_RIGHT.has(p.emoji);
  const dirSign = p.fromLeft ? 1 : -1; // +1 = regarder droite, -1 = regarder gauche
  const emojiNative = facingRight ? 1 : -1; // orientation naturelle emoji (+1 = droite, -1 = gauche)
  const finalScaleX = dirSign === emojiNative ? 1 : -1;

  p.x.setValue(startX);
  p.bobY.setValue(0);
  p.opacity.setValue(0);
  p.scaleX.setValue(finalScaleX);

  const totalDuration = p.duration;

  // Ondulation verticale : cycles lents et amples → battements d'ailes
  const waveSpeed = 700 + Math.random() * 400;   // durée d'un demi-cycle (ms)
  const waveAmp   = 20 + Math.random() * 22;     // amplitude en pixels
  const waveCount = Math.ceil(totalDuration / waveSpeed);

  const waveSeq = Array.from({ length: waveCount }, (_, i) =>
    Animated.timing(p.bobY, {
      toValue: i % 2 === 0 ? -waveAmp : waveAmp,
      duration: waveSpeed,
      useNativeDriver: native,
    })
  );

  const fadeDuration = Math.min(500, totalDuration * 0.12);

  Animated.sequence([
    Animated.delay(p.delay),
    Animated.parallel([
      // Fade in/out encadrant la traversée
      Animated.sequence([
        Animated.timing(p.opacity, { toValue: native ? 0.9 : 0.8, duration: fadeDuration, useNativeDriver: native }),
        Animated.delay(totalDuration - fadeDuration * 2),
        Animated.timing(p.opacity, { toValue: 0, duration: fadeDuration, useNativeDriver: native }),
      ]),
      // Traversée horizontale continue (vitesse constante)
      Animated.timing(p.x, { toValue: endX, duration: totalDuration, useNativeDriver: native }),
      // Battements d'ailes (ondulation verticale)
      Animated.sequence(waveSeq),
    ]),
  ]).start(onDone);
}

// ── Composant principal ───────────────────────────────────────

export function FallingLeaves() {
  const visualEffect = usePlayerStore(s => s.visualEffect);

  const emojis = THEME_EMOJIS[visualEffect] ?? THEME_EMOJIS.leaves;

  // Créer les particules selon le thème actif (ref stable au montage)
  const particles = useRef<Particle[]>(
    emojis.length === 0 ? [] :
    visualEffect === 'butterflies'
      ? Array.from({ length: PARTICLE_COUNT }, (_, i) => createButterflyParticle(i, emojis))
      : visualEffect === 'birds'
        ? Array.from({ length: BIRD_COUNT }, (_, i) => createBirdParticle(i, emojis))
        : Array.from({ length: PARTICLE_COUNT }, (_, i) => createLeafParticle(i, emojis))
  ).current;

  // Re-assign emojis si le thème change (même instance)
  useEffect(() => {
    if (emojis.length === 0) return;
    particles.forEach((p, i) => {
      p.emoji = emojis[i % emojis.length];
    });
  }, [visualEffect]);

  useEffect(() => {
    if (emojis.length === 0 || particles.length === 0) return;

    const timeouts: ReturnType<typeof setTimeout>[] = [];

    particles.forEach((particle, i) => {
      const initialDelay = i * 700;
      const t = setTimeout(() => {
        if (particle.kind === 'leaf') {
          particle.delay = 0;
          const loop = () => animateLeaf(particle, loop);
          loop();
        } else if (particle.kind === 'butterfly') {
          particle.delay = 0;
          const loop = () => animateButterfly(particle, loop);
          loop();
        } else {
          particle.delay = 0;
          const loop = () => animateBird(particle, loop);
          loop();
        }
      }, initialDelay);
      timeouts.push(t);
    });

    return () => {
      timeouts.forEach(clearTimeout);
      particles.forEach(p => {
        p.opacity.stopAnimation();
        if (p.kind === 'leaf') {
          p.x.stopAnimation();
          p.y.stopAnimation();
          p.rotate.stopAnimation();
        } else if (p.kind === 'butterfly') {
          p.posX.stopAnimation();
          p.posY.stopAnimation();
        } else {
          p.x.stopAnimation();
          p.bobY.stopAnimation();
        }
      });
    };
  }, []);

  if (visualEffect === 'none' || emojis.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((particle, i) => {
        if (particle.kind === 'leaf') {
          return (
            <Animated.Text
              key={i}
              style={[
                styles.particleTop,
                {
                  left:     particle.startX,
                  fontSize: particle.size,
                  opacity:  particle.opacity,
                  transform: [
                    { translateX: particle.x },
                    { translateY: particle.y },
                    { rotate: particle.rotate.interpolate({
                      inputRange:  [0, 3],
                      outputRange: ['0deg', '540deg'],
                    })},
                  ],
                },
              ]}
            >
              {particle.emoji}
            </Animated.Text>
          );
        }

        if (particle.kind === 'butterfly') {
          // Sur web : filter hue-rotate() pour varier la couleur de l'emoji papillon.
          // Sur natif : pas de filter disponible, on garde l'emoji tel quel
          // (la variation de taille et d'opacité suffit à donner une impression de diversité).
          const webFilter = !native
            ? ({ filter: `hue-rotate(${particle.hue}deg)` } as any)
            : undefined;
          return (
            <Animated.View
              key={i}
              style={[
                styles.particleAbs,
                webFilter,
                {
                  opacity:   particle.opacity,
                  transform: [
                    { translateX: particle.posX },
                    { translateY: particle.posY },
                  ],
                },
              ]}
            >
              <Text style={{ fontSize: particle.size }}>{particle.emoji}</Text>
            </Animated.View>
          );
        }

        // oiseau — scaleX calculé dans animateBird selon direction + orientation naturelle emoji
        return (
          <Animated.Text
            key={i}
            style={[
              styles.particleAbs,
              {
                fontSize: particle.size,
                opacity:  particle.opacity,
                transform: [
                  { translateX: particle.x },
                  { translateY: Animated.add(
                      new Animated.Value(particle.startY),
                      particle.bobY
                    ) },
                  { scaleX: particle.scaleX },
                ],
              },
            ]}
          >
            {particle.emoji}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
    elevation: 5,
  },
  // Feuilles : ancrées en haut, startX fixe via left
  particleTop: {
    position: 'absolute',
    top: 0,
  },
  // Papillons et oiseaux : translateX/translateY depuis (0,0)
  particleAbs: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
