/** Hasard reproductible : même graine → même suite de nombres (menus déterministes). */

/** Empreinte 32 bits d'une chaîne (FNV-1a). */
export function empreinte(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type Hasard = {
  /** Réel dans [0, 1[. */
  suivant(): number;
  /** Entier dans [min, max]. */
  entier(min: number, max: number): number;
  /** Un élément au hasard (pondéré si des poids sont donnés). */
  choisir<T>(liste: readonly T[], poids?: readonly number[]): T;
  melanger<T>(liste: readonly T[]): T[];
};

/** Générateur mulberry32. */
export function hasard(graine: number): Hasard {
  let a = graine >>> 0;
  const suivant = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    suivant,
    entier: (min, max) => min + Math.floor(suivant() * (max - min + 1)),
    choisir(liste, poids) {
      if (liste.length === 0) throw new Error('liste vide');
      if (!poids) return liste[Math.floor(suivant() * liste.length)];
      const total = poids.reduce((s, p) => s + p, 0);
      let x = suivant() * total;
      for (let i = 0; i < liste.length; i++) {
        x -= poids[i];
        if (x < 0) return liste[i];
      }
      return liste[liste.length - 1];
    },
    melanger(liste) {
      const l = [...liste];
      for (let i = l.length - 1; i > 0; i--) {
        const j = Math.floor(suivant() * (i + 1));
        [l[i], l[j]] = [l[j], l[i]];
      }
      return l;
    },
  };
}
