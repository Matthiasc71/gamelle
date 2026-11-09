/**
 * Base embarquée dans l'app : recettes, catalogue d'ingrédients et grille de prix, lus au build
 * depuis data/ et validés par le schéma Zod au démarrage (valeurs par défaut comprises).
 */
import catalogue from '../../data/ciqual-map.json';
import prix from '../../data/prix-reference.json';
import { CiqualMap, GrillePrix, Recette } from '../domain/schema';
import { creerBase } from '../domain/types';

const modules = import.meta.glob('../../data/recipes/*.json', { eager: true, import: 'default' });

const recettes = Object.values(modules)
  .map((m) => Recette.parse(m))
  .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

export const BASE = creerBase(recettes, CiqualMap.parse(catalogue), GrillePrix.parse(prix));

/** Numéro de planche d'herbier, stable : ordre alphabétique des identifiants. */
export const PLANCHE: Record<string, number> = Object.fromEntries(
  [...recettes].sort((a, b) => a.id.localeCompare(b.id)).map((r, i) => [r.id, i + 1]),
);

/** Date de relevé la plus récente de la grille de prix (affichée dans les crédits). */
export const PRIX_RELEVES_LE = Object.values(BASE.prix)
  .map((p) => p.releve_le)
  .sort()
  .at(-1);
