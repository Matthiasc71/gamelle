/**
 * Session batch : fusionne les étapes de plusieurs recettes en une seule timeline.
 *
 * Ressources en parallèle : 2 feux, le four (2 plats à la fois), le rice cooker, le micro-ondes,
 * et une paire de mains. Une étape « active » occupe les mains toute sa durée ; une étape passive
 * (ça cuit seul) n'occupe que son appareil. Une étape « en fond » (riz au rice cooker) ne bloque pas
 * l'étape suivante de sa recette : elle ne prend les mains que 2 minutes pour la lancer.
 *
 * Ordonnancement glouton : à chaque tour, on place l'étape qui peut démarrer le plus tôt,
 * en départageant par la recette qui a le plus de travail restant.
 */
import type { Equipement, Recette } from './schema';

export const CAPACITES: Record<Equipement | 'mains', number> = {
  plaques: 2,
  four: 2,
  'rice-cooker': 1,
  'micro-ondes': 1,
  mains: 1,
};

const MAINS_EN_FOND = 2;

export type EtapePlanifiee = {
  recetteId: string;
  index: number;
  texte: string;
  debut: number;
  fin: number;
  equipement?: Equipement;
  actif: boolean;
  enFond: boolean;
};

export type Timeline = { etapes: EtapePlanifiee[]; duree: number; tempsActif: number };

type Intervalle = [number, number];

/** Premier instant ≥ t où `n` occupations simultanées max sont respectées sur [t, t + d[. */
function premierCreneauLibre(occupations: Intervalle[], capacite: number, t: number, d: number): number {
  if (d <= 0) return t;
  let debut = t;
  for (;;) {
    // instants où la charge change dans la fenêtre
    const points = [debut, ...occupations.flatMap(([a, b]) => [a, b]).filter((x) => x > debut && x < debut + d)].sort((a, b) => a - b);
    let conflit: number | null = null;
    for (const p of points) {
      const charge = occupations.filter(([a, b]) => a <= p && p < b).length;
      if (charge >= capacite) {
        // on décale jusqu'à la prochaine libération après p
        conflit = Math.min(...occupations.filter(([a, b]) => a <= p && p < b).map(([, b]) => b));
        break;
      }
    }
    if (conflit === null) return debut;
    debut = conflit;
  }
}

export function planifierSession(recettes: Recette[], capacites = CAPACITES): Timeline {
  const occ: Record<string, Intervalle[]> = Object.fromEntries(Object.keys(capacites).map((k) => [k, []]));
  const curseur = recettes.map(() => 0); // prochaine étape à placer
  const pret = recettes.map(() => 0); // instant où la prochaine étape peut commencer
  const finRecette = recettes.map(() => 0);
  const restant = (i: number) => recettes[i].etapes.slice(curseur[i]).reduce((s, e) => s + e.duree_min, 0);
  const etapes: EtapePlanifiee[] = [];

  const placer = (i: number, t0: number) => {
    const e = recettes[i].etapes[curseur[i]];
    const mains = e.en_fond ? Math.min(MAINS_EN_FOND, e.duree_min) : e.actif ? e.duree_min : 0;
    let t = t0;
    // cherche un instant où l'appareil ET les mains sont libres
    for (let garde = 0; garde < 200; garde++) {
      const tAppareil = e.equipement ? premierCreneauLibre(occ[e.equipement], capacites[e.equipement], t, e.duree_min) : t;
      const tMains = premierCreneauLibre(occ.mains, capacites.mains, tAppareil, mains);
      if (tMains === tAppareil) {
        t = tAppareil;
        break;
      }
      t = tMains;
    }
    return { e, t, mains };
  };

  for (;;) {
    const candidats = recettes.map((_, i) => i).filter((i) => curseur[i] < recettes[i].etapes.length);
    if (!candidats.length) break;
    let meilleur: { i: number; t: number } | null = null;
    for (const i of candidats) {
      const { t } = placer(i, pret[i]);
      if (!meilleur || t < meilleur.t || (t === meilleur.t && restant(i) > restant(meilleur.i))) meilleur = { i, t };
    }
    const { i } = meilleur!;
    const { e, t, mains } = placer(i, pret[i]);
    if (e.equipement) occ[e.equipement].push([t, t + e.duree_min]);
    if (mains > 0) occ.mains.push([t, t + mains]);
    etapes.push({
      recetteId: recettes[i].id, index: curseur[i], texte: e.texte, debut: t, fin: t + e.duree_min,
      equipement: e.equipement, actif: e.actif, enFond: !!e.en_fond,
    });
    finRecette[i] = Math.max(finRecette[i], t + e.duree_min);
    pret[i] = e.en_fond ? t + mains : t + e.duree_min;
    curseur[i]++;
  }
  etapes.sort((a, b) => a.debut - b.debut || a.fin - b.fin);
  return {
    etapes,
    duree: Math.max(0, ...finRecette),
    tempsActif: occ.mains.reduce((s, [a, b]) => s + b - a, 0),
  };
}
