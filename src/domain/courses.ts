/**
 * Liste de courses : besoins de la semaine, déduction du stock, arrondi aux paquets réels,
 * coût en caisse (paquets entiers achetés) et coût des portions mangées.
 */
import { achat, prixUnitaire, quantiteEnUniteConditionnement } from './pricing';
import { RAYONS } from './constantes';
import type { PrixReference, Rayon, Recette } from './schema';
import type { Base, Cuisson, Stock } from './types';
import { euros } from './format';

/** Facteur d'échelle des ingrédients d'une cuisson. */
export const facteurCuisson = (c: Pick<Cuisson, 'parts'>, r: Pick<Recette, 'portions_base'>, personnes = 1) =>
  (c.parts * personnes) / r.portions_base;

/** Besoins en ingrédients (unité du conditionnement) pour un ensemble de cuissons. */
export function besoins(cuissons: Cuisson[], base: Base, personnes = 1): Record<string, number> {
  const b: Record<string, number> = {};
  for (const c of cuissons) {
    if (c.stock) continue;
    const r = base.parId[c.recetteId];
    if (!r) throw new Error(`Recette inconnue : ${c.recetteId}`);
    const f = facteurCuisson(c, r, personnes);
    for (const ing of r.ingredients) {
      if (ing.optionnel) continue;
      const prix = base.prix[ing.ingredient];
      // sans prix (garniture facultative) : on compte en grammes, sans conversion
      const q = prix ? quantiteEnUniteConditionnement(ing, prix) : ing.poids_g;
      b[ing.ingredient] = (b[ing.ingredient] ?? 0) + q * f;
    }
  }
  return b;
}

export type LigneCourses = {
  ingredient: string;
  nom: string;
  rayon: Rayon;
  produit: string;
  conditionnement: string;
  /** Quantités dans l'unité du conditionnement. */
  besoin: number;
  enStock: number;
  paquets: number;
  prixPaquet: number;
  coutCaisse: number;
  coutUtilise: number;
  /** Fait partie du placard de base : jamais acheté. */
  placard: boolean;
  /** Prix estimé (médiane France) ou corrigé à la main. */
  prixEstime: boolean;
  prixCorrige: boolean;
  sansPrix: boolean;
};

export type ListeCourses = {
  lignes: LigneCourses[];
  parRayon: { rayon: Rayon; lignes: LigneCourses[] }[];
  totalCaisse: number;
  totalUtilise: number;
};

export type ContexteCourses = {
  base: Base;
  stock?: Stock;
  placardDeBase?: string[];
  personnes?: number;
  /** Prix d'un paquet corrigé par l'utilisateur (prioritaire). */
  prixCorriges?: Record<string, number>;
};

const nf = (n: number, d = 0) => n.toLocaleString('fr-FR', { maximumFractionDigits: d });

export function libelleConditionnement(p: Pick<PrixReference, 'conditionnement'>): string {
  const { quantite: q, unite: u } = p.conditionnement;
  if (u === 'g') return q >= 1000 ? `${nf(q / 1000, 2)} kg` : `${nf(q)} g`;
  if (u === 'ml') return q >= 1000 ? `${nf(q / 1000, 2)} L` : `${nf(q / 10, 1)} cl`;
  return q > 1 ? `${nf(q)} pièces` : '1 pièce';
}

const arrondi = (x: number) => Math.round(x * 100) / 100;

export function listeCourses(cuissons: Cuisson[], ctx: ContexteCourses): ListeCourses {
  const { base, stock = {}, placardDeBase = [], personnes = 1, prixCorriges = {} } = ctx;
  const b = besoins(cuissons, base, personnes);
  const placard = new Set(placardDeBase);
  const lignes: LigneCourses[] = [];
  for (const [id, besoin] of Object.entries(b)) {
    const cat = base.catalogue[id];
    const ref = base.prix[id];
    if (!ref) {
      lignes.push({
        ingredient: id, nom: cat?.nom ?? id, rayon: cat?.rayon ?? 'epicerie', produit: cat?.nom ?? id, conditionnement: '',
        besoin, enStock: 0, paquets: 0, prixPaquet: 0, coutCaisse: 0, coutUtilise: 0,
        placard: false, prixEstime: false, prixCorrige: false, sansPrix: true,
      });
      continue;
    }
    const corrige = prixCorriges[id];
    const prix = corrige !== undefined ? { ...ref, prix_eur: corrige } : ref;
    const auPlacard = placard.has(id);
    const enStock = auPlacard ? besoin : stock[id] ?? 0;
    const a = achat(besoin, enStock, prix);
    lignes.push({
      ingredient: id,
      nom: cat?.nom ?? id,
      rayon: cat?.rayon ?? 'epicerie',
      produit: ref.produit,
      conditionnement: libelleConditionnement(ref),
      besoin,
      enStock,
      paquets: a.paquets,
      prixPaquet: prix.prix_eur,
      coutCaisse: a.cout_caisse_eur,
      coutUtilise: arrondi(besoin * prixUnitaire(prix)),
      placard: auPlacard,
      prixEstime: ref.methode === 'open-prices-france',
      prixCorrige: corrige !== undefined,
      sansPrix: false,
    });
  }
  lignes.sort((x, y) => RAYONS.indexOf(x.rayon) - RAYONS.indexOf(y.rayon) || x.nom.localeCompare(y.nom, 'fr'));
  return {
    lignes,
    parRayon: RAYONS.map((rayon) => ({ rayon, lignes: lignes.filter((l) => l.rayon === rayon && l.paquets > 0) })).filter((g) => g.lignes.length),
    totalCaisse: arrondi(lignes.reduce((s, l) => s + l.coutCaisse, 0)),
    totalUtilise: arrondi(lignes.reduce((s, l) => s + l.coutUtilise, 0)),
  };
}

export const NOMS_RAYONS: Record<Rayon, string> = {
  'fruits-legumes': 'Fruits et légumes',
  frais: 'Frais',
  'viandes-poissons': 'Viandes et poissons',
  epicerie: 'Épicerie',
  surgeles: 'Surgelés',
};

/** Texte à partager (Rappels, Notes, Messages) : une ligne par article, articles cochés exclus. */
export function texteListe(liste: ListeCourses, coches: ReadonlySet<string> = new Set()): string {
  const out: string[] = [];
  for (const g of liste.parRayon) {
    const lignes = g.lignes.filter((l) => !coches.has(l.ingredient));
    if (!lignes.length) continue;
    out.push(`${NOMS_RAYONS[g.rayon]} :`);
    for (const l of lignes) out.push(`${l.paquets > 1 ? `${l.paquets} × ` : ''}${l.produit} (${euros(l.coutCaisse)})`);
    out.push('');
  }
  out.push(`Total : ${euros(liste.totalCaisse)}`);
  return out.join('\n');
}
