/** Chargement des données du dépôt pour les scripts. */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TableCiqual } from '../../src/domain/nutrition';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const DIR_RECETTES = join(ROOT, 'data/recipes');

export const lireJson = <T = unknown>(chemin: string): T => JSON.parse(readFileSync(join(ROOT, chemin), 'utf8')) as T;

export function tableCiqual(): TableCiqual {
  return lireJson<{ aliments: TableCiqual }>('data/ciqual/ciqual-2025.min.json').aliments;
}

/** Fichiers de recettes bruts (non validés), triés par nom. */
export function recettesBrutes(): { fichier: string; data: Record<string, unknown> }[] {
  return readdirSync(DIR_RECETTES)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ fichier: join(DIR_RECETTES, f), data: JSON.parse(readFileSync(join(DIR_RECETTES, f), 'utf8')) }));
}

/** Écrit un JSON lisible, avec un retour à la ligne final. */
export const ecrireJson = (chemin: string, data: unknown) => writeFileSync(chemin, JSON.stringify(data, null, 2) + '\n');

export const aujourdhui = () => new Date().toISOString().slice(0, 10);
