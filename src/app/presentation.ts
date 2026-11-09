/** Mise en forme partagée par les écrans : quantités, badges des repas, coûts d'ingrédients. */
import { coutUtilise } from '../domain/pricing';
import type { DetailRepas } from '../domain/regles';
import type { IngredientRecette, Recette } from '../domain/schema';
import { BASE } from './base';

const nf = (d: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d });
export const nombre = (n: number, d = 0) => nf(d).format(n);

const FRACTIONS = new Map([[0.25, '¼'], [0.33, '⅓'], [0.5, '½'], [0.67, '⅔'], [0.75, '¾']]);

/** 0,5 → « ½ », 1,5 → « 1 ½ », 2 → « 2 ». */
export function pieces(n: number): string {
  const entier = Math.floor(n + 1e-9);
  const reste = Math.round((n - entier) * 100) / 100;
  if (reste === 0) return String(entier);
  const frac = FRACTIONS.get(reste);
  if (frac) return entier ? `${entier} ${frac}` : frac;
  return nombre(n, 1);
}

/** Quantité affichée d'un ingrédient pour un facteur de portions (1 = recette d'origine). */
export function quantite(ing: IngredientRecette, facteur = 1): string {
  if (ing.mesure_affichee && Math.abs(facteur - 1) < 1e-9) return ing.mesure_affichee;
  const q = ing.quantite * facteur;
  if (ing.unite === 'g') return q >= 1000 ? `${nombre(q / 1000, 2)} kg` : `${nombre(q < 10 ? Math.round(q * 2) / 2 : Math.round(q / 5) * 5, 1)} g`;
  if (ing.unite === 'ml') return q >= 1000 ? `${nombre(q / 1000, 2)} l` : q >= 100 ? `${nombre(q / 10, 1)} cl` : `${nombre(q, 0)} ml`;
  return pieces(Math.round(q * 4) / 4);
}

/** Coût des quantités utilisées (grille de prix), pour un facteur de portions. */
export function coutIngredient(ing: IngredientRecette, facteur = 1, prixCorriges: Record<string, number> = {}): number | null {
  const p = BASE.prix[ing.ingredient];
  if (!p) return null;
  const prix = ing.ingredient in prixCorriges ? { ...p, prix_eur: prixCorriges[ing.ingredient] } : p;
  try {
    return coutUtilise(ing, prix) * facteur;
  } catch {
    return null;
  }
}

/** « carotte » → « Carotte ». */
export const majuscule = (s: string) => s.charAt(0).toLocaleUpperCase('fr') + s.slice(1);

export const MOMENT = { midi: 'Midi', soir: 'Soir' } as const;

/** Badge d'un repas dans la semaine : « on cuisine ×4 · 35 min », « boîte 2/4 », « congelée »… */
export function badge(d: Pick<DetailRepas, 'statut' | 'part' | 'parts' | 'recette'>): string {
  const t = d.recette.temps.total_min;
  switch (d.statut) {
    case 'cuisine':
      return `on cuisine ×${d.parts} · ${t} min`;
    case 'boite':
      return `boîte ${d.part}/${d.parts}`;
    case 'congele':
      return `congelée · boîte ${d.part}/${d.parts}`;
    case 'express':
      return `${t} min`;
    case 'assemblage':
      return `sans cuisson · ${t} min`;
  }
}

/** Nom court pour l'étiquette d'herbier : les premiers mots avant « et », « , » ou « à ». */
export function nomCourt(r: Pick<Recette, 'nom'>): string {
  const coupe = r.nom.split(/,| et | à la | au | aux | façon /)[0].trim();
  const mots = coupe.split(' ');
  return mots.length > 4 ? mots.slice(0, 4).join(' ') : coupe;
}

export const TYPE_RECETTE = { batch: 'Batch', express: 'Express', assemblage: 'Sans cuisson' } as const;

export const NOM_EQUIPEMENT = { plaques: 'Plaques', four: 'Four', 'micro-ondes': 'Micro-ondes', 'rice-cooker': 'Rice cooker' } as const;

export const NOM_SOURCE = { article: "Lire l'article", tiktok: 'Vidéo TikTok', instagram: 'Post Instagram' } as const;
