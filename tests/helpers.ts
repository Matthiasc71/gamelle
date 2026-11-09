import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Recette } from '../src/domain/schema';
import { creerBase, REGLAGES_DEFAUT, type Base } from '../src/domain/types';
import type { ContexteMenu } from '../src/domain/regles';

const ROOT = join(__dirname, '..');
const lire = (f: string) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));

let cache: Base | null = null;
/** La vraie base du dépôt (recettes validées, catalogue, grille de prix). */
export function baseReelle(): Base {
  if (!cache) {
    const recettes = readdirSync(join(ROOT, 'data/recipes')).map((f) => Recette.parse(lire(`data/recipes/${f}`)));
    cache = creerBase(recettes, lire('data/ciqual-map.json'), lire('data/prix-reference.json'));
  }
  return cache;
}

export const ctxDefaut = (extra: Partial<ContexteMenu> = {}): ContexteMenu => ({ base: baseReelle(), reglages: REGLAGES_DEFAUT, ...extra });
