/**
 * Prix : conversion des quantités de recette dans l'unité du conditionnement,
 * coût des portions mangées, et arrondi aux paquets entiers (coût en caisse).
 */
import type { IngredientRecette, PrixReference } from './schema';

export class ErreurPrix extends Error {}

type IngPrix = Pick<IngredientRecette, 'quantite' | 'unite' | 'poids_g' | 'nom_affiche'>;
type Cond = Pick<PrixReference, 'conditionnement' | 'poids_piece_g' | 'prix_eur'>;

/** Quantité d'un ingrédient exprimée dans l'unité de son conditionnement. */
export function quantiteEnUniteConditionnement(ing: IngPrix, prix: Cond): number {
  const u = prix.conditionnement.unite;
  if (u === ing.unite) return ing.quantite;
  if (u === 'g') return ing.poids_g;
  if (u === 'pièce') {
    if (!prix.poids_piece_g) throw new ErreurPrix(`poids_piece_g manquant pour ${ing.nom_affiche}`);
    return ing.poids_g / prix.poids_piece_g;
  }
  // u === 'ml' et ingrédient pesé en g : on n'invente pas de densité
  throw new ErreurPrix(`Impossible de convertir ${ing.unite} en ${u} pour ${ing.nom_affiche}`);
}

/** Prix d'une unité (1 g, 1 ml ou 1 pièce) du conditionnement. */
export const prixUnitaire = (prix: Cond) => prix.prix_eur / prix.conditionnement.quantite;

/** Coût de la quantité utilisée (sans arrondi au paquet). */
export function coutUtilise(ing: IngPrix, prix: Cond): number {
  return quantiteEnUniteConditionnement(ing, prix) * prixUnitaire(prix);
}

/** Coût par part d'une recette (portions mangées), en euros, arrondi au centime. */
export function coutParPart(
  ingredients: (IngPrix & { ingredient: string; optionnel?: boolean })[],
  portions: number,
  grille: Record<string, Cond>,
): number {
  let total = 0;
  for (const ing of ingredients) {
    if (ing.optionnel) continue;
    const prix = grille[ing.ingredient];
    if (!prix) throw new ErreurPrix(`Pas de prix pour ${ing.ingredient}`);
    total += coutUtilise(ing, prix);
  }
  return Math.round((total / portions) * 100) / 100;
}

/** Tolérance pour éviter d'acheter un 2e paquet pour 0,5 g d'écart d'arrondi. */
const EPS = 1e-6;

/**
 * Achat nécessaire pour couvrir un besoin, compte tenu du stock déjà présent.
 * Toutes les quantités sont dans l'unité du conditionnement.
 */
export function achat(besoin: number, stock: number, prix: Cond) {
  const manque = Math.max(0, besoin - stock);
  const taille = prix.conditionnement.quantite;
  const paquets = manque <= EPS ? 0 : Math.ceil(manque / taille - EPS);
  const achete = paquets * taille;
  return {
    paquets,
    cout_caisse_eur: Math.round(paquets * prix.prix_eur * 100) / 100,
    /** Ce qui reste après avoir utilisé le besoin (stock + achat − besoin). */
    reste: Math.max(0, stock + achete - besoin),
    cout_utilise_eur: Math.round(besoin * prixUnitaire(prix) * 100) / 100,
  };
}
