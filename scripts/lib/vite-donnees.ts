/**
 * Module virtuel « virtual:gamelle-donnees » : recettes, catalogue et grille de prix lus dans data/,
 * validés par le schéma Zod au build (le build échoue si une donnée est invalide), puis embarqués
 * en JSON compact. L'app n'a ainsi besoin ni de Zod ni de valider quoi que ce soit au démarrage.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { CiqualMap, GrillePrix, Recette } from '../../src/domain/schema';

const ID = 'virtual:gamelle-donnees';
const RESOLU = '\0' + ID;

export function donnees(racine: string): Plugin {
  const dossier = join(racine, 'data');
  return {
    name: 'gamelle-donnees',
    resolveId: (id) => (id === ID ? RESOLU : undefined),
    load(id) {
      if (id !== RESOLU) return;
      const lire = (f: string) => {
        this.addWatchFile(f);
        return JSON.parse(readFileSync(f, 'utf8'));
      };
      const fichiers = readdirSync(join(dossier, 'recipes')).filter((f) => f.endsWith('.json'));
      const recettes = fichiers.map((f) => {
        const r = Recette.parse(lire(join(dossier, 'recipes', f)));
        // les vignettes oEmbed ne sont jamais affichées (pas de requête tierce) : inutile de les embarquer
        return { ...r, sources: r.sources.map(({ oembed: _o, ...s }) => s) };
      });
      const catalogue = Object.fromEntries(
        Object.entries(CiqualMap.parse(lire(join(dossier, 'ciqual-map.json')))).map(([k, { ciqual_nom: _n, note: _no, ...c }]) => [k, c]),
      );
      const prix = GrillePrix.parse(lire(join(dossier, 'prix-reference.json')));
      // lignes Ciqual des seuls ingrédients du catalogue : calcul des recettes ajoutées sur le téléphone
      const table = lire(join(dossier, 'ciqual/ciqual-2025.min.json')).aliments as Record<string, unknown[]>;
      const ciqual = Object.fromEntries(Object.values(catalogue).map((c) => [c.ciqual_code, table[c.ciqual_code]]));
      const json = JSON.stringify({ recettes, catalogue, prix, ciqual });
      return `export default JSON.parse(${JSON.stringify(json)});`;
    },
  };
}
