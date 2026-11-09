/**
 * Base embarquée dans l'app : recettes, catalogue d'ingrédients et grille de prix,
 * validés au build par le schéma Zod (scripts/lib/vite-donnees.ts).
 */
import donnees from 'virtual:gamelle-donnees';
import type { IngredientCatalogue, Recette } from '../domain/schema';
import { creerBase } from '../domain/types';

const recettes = [...donnees.recettes].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

export const BASE = creerBase(recettes, donnees.catalogue as Record<string, IngredientCatalogue>, donnees.prix);

/** Lignes Ciqual des ingrédients du catalogue (calcul des recettes ajoutées sur le téléphone). */
export const CIQUAL = donnees.ciqual;

export const estPerso = (id: string) => id.startsWith('perso-');

/** Ajoute (ou met à jour) des recettes saisies sur le téléphone dans la base en mémoire. */
export function ajouterRecettesPerso(perso: Recette[]) {
  for (const r of perso) {
    const i = BASE.recettes.findIndex((x) => x.id === r.id);
    if (i >= 0) BASE.recettes[i] = r;
    else BASE.recettes.push(r);
    BASE.parId[r.id] = r;
  }
}

export function retirerRecettePerso(id: string) {
  const i = BASE.recettes.findIndex((x) => x.id === id);
  if (i >= 0) BASE.recettes.splice(i, 1);
  delete BASE.parId[id];
}

/** Numéro de planche d'herbier, stable : ordre alphabétique des identifiants. */
export const PLANCHE: Record<string, number> = Object.fromEntries(
  [...recettes].sort((a, b) => a.id.localeCompare(b.id)).map((r, i) => [r.id, i + 1]),
);

/** Date de relevé la plus récente de la grille de prix (affichée dans les crédits). */
export const PRIX_RELEVES_LE = Object.values(BASE.prix)
  .map((p) => p.releve_le)
  .sort()
  .at(-1);
