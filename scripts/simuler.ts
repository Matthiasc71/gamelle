/**
 * Simule N semaines (52 par défaut) avec la vraie base et écrit reports/simulation.md :
 * coût en caisse, coût des portions mangées, durée de session et règles assouplies.
 *
 *   npm run simuler            (52 semaines depuis la semaine prochaine)
 *   npm run simuler -- 12 2026-W47
 *   npm run simuler -- 52 2026-W47 --essai --sans id1,id2   (sans écrire le rapport, base privée de ces recettes :
 *   pour tester l'effet d'une recette sur le budget, depuis plusieurs semaines de départ)
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { semaineIso, ajouterJours, libelleSemaine } from '../src/domain/dates';
import { Recette } from '../src/domain/schema';
import { creerBase, REGLAGES_DEFAUT } from '../src/domain/types';
import { aujourdhui, lireJson, ROOT } from './lib/data';
import { simuler } from './lib/simulation';

const args = process.argv.slice(2);
const essai = args.includes('--essai');
const iSans = args.indexOf('--sans');
const sans = new Set(iSans >= 0 ? args[iSans + 1].split(',') : []);
const positionnels = args.filter((a, i) => !a.startsWith('--') && (iSans < 0 || i !== iSans + 1));
const n = Number(positionnels[0] ?? 52);
const depart = positionnels[1] ?? semaineIso(ajouterJours(aujourdhui(), 7)).cle;
const recettes = readdirSync(join(ROOT, 'data/recipes'))
  .map((f) => Recette.parse(lireJson(`data/recipes/${f}`)))
  .filter((r) => !sans.has(r.id));
const base = creerBase(recettes, lireJson('data/ciqual-map.json'), lireJson('data/prix-reference.json'));
const t0 = Date.now();
const semaines = simuler(base, REGLAGES_DEFAUT, depart, n);
const eur = (x: number) => x.toFixed(2).replace('.', ',') + ' €';
const moy = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const caisses = semaines.map((s) => s.caisse);
const regime = caisses.slice(Math.min(4, caisses.length - 1));
const dansBudget = semaines.filter((s) => s.caisse <= REGLAGES_DEFAUT.budget[1]).length;

if (essai) {
  console.log(`${depart} · ${recettes.length} recettes · moyenne ${eur(moy(caisses))} · dans le budget ${dansBudget}/${n}`);
  process.exit(0);
}

writeFileSync(
  join(ROOT, 'reports/simulation.md'),
  `# Simulation de ${n} semaines (${aujourdhui()})

Départ : ${libelleSemaine(semaines[0].menu.lundi)}. ${recettes.length} recettes, réglages par défaut
(budget ${REGLAGES_DEFAUT.budget.join('–')} €, placard de base : ${REGLAGES_DEFAUT.placardDeBase.length} ingrédients).
Les restes de paquets passent à la semaine suivante ; la viande crue restante est congelée.

- Coût en caisse moyen : **${eur(moy(caisses))}** (${eur(moy(regime))} hors 4 premières semaines, quand le placard est rempli).
- Coût des portions mangées moyen : **${eur(moy(semaines.map((s) => s.mange)))}**.
- Semaines dans le budget (≤ ${REGLAGES_DEFAUT.budget[1]} € en caisse) : **${dansBudget} / ${n}**.
- Règles dures enfreintes : **${semaines.reduce((s, x) => s + x.violations.filter((v) => !['saison', 'historique', 'budget'].includes(v.code)).length, 0)}**.

| Semaine | En caisse | Mangé | Session dim. | Règles assouplies |
|---|---|---|---|---|
${semaines
  .map(
    (s) =>
      `| ${s.menu.semaine} | ${eur(s.caisse)} | ${eur(s.mange)} | ${s.session} min | ${[...new Set(s.violations.map((v) => v.code))].join(', ') || '—'} |`,
  )
  .join('\n')}
`,
);
console.log(`${n} semaines simulées en ${((Date.now() - t0) / 1000).toFixed(1)} s → reports/simulation.md ; dans le budget : ${dansBudget}/${n}`);
