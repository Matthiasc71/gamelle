/**
 * Base embarquée dans l'app : recettes, catalogue d'ingrédients et grille de prix,
 * validés au build par le schéma Zod (scripts/lib/vite-donnees.ts).
 */
import donnees from 'virtual:gamelle-donnees';
import type { IngredientCatalogue } from '../domain/schema';
import { creerBase } from '../domain/types';

const recettes = [...donnees.recettes].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

export const BASE = creerBase(recettes, donnees.catalogue as Record<string, IngredientCatalogue>, donnees.prix);

/** Numéro de planche d'herbier, stable : ordre alphabétique des identifiants. */
export const PLANCHE: Record<string, number> = Object.fromEntries(
  [...recettes].sort((a, b) => a.id.localeCompare(b.id)).map((r, i) => [r.id, i + 1]),
);

/** Date de relevé la plus récente de la grille de prix (affichée dans les crédits). */
export const PRIX_RELEVES_LE = Object.values(BASE.prix)
  .map((p) => p.releve_le)
  .sort()
  .at(-1);
