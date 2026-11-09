/**
 * Contrôle complet de la base de recettes. Écrit reports/validation.md.
 *
 *   npm run validate               (hors ligne : schéma, catalogue, Ciqual, prix, règles, fraîcheur des vérifications)
 *   npm run validate -- --reseau   (revérifie aussi chaque lien, comme npm run links)
 *
 * Code de sortie 1 si une erreur bloque la recette.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { nutritionParPart } from '../src/domain/nutrition';
import { coutParPart } from '../src/domain/pricing';
import { CiqualMap, GrillePrix, Recette, FAMILLE_PROTEINE, type Recette as TRecette } from '../src/domain/schema';
import { aujourdhui, lireJson, recettesBrutes, ROOT, tableCiqual } from './lib/data';

/** Règles du profil (section 2 du cahier des charges). */
export const REGLES = { kcalMin: 380, kcalMax: 650, protMin: 20, legumesMin_g: 80, fraicheurLiens_j: 45 };

if (process.argv.includes('--reseau')) {
  execFileSync('npx', ['tsx', join(ROOT, 'scripts/verify-links.ts')], { stdio: 'inherit' });
}

const table = tableCiqual();
const catalogue = CiqualMap.parse(lireJson('data/ciqual-map.json'));
const grille = GrillePrix.parse(lireJson('data/prix-reference.json'));
const erreurs: string[] = [];
const avert: string[] = [];
const ok: TRecette[] = [];
const ids = new Set<string>();

// Catalogue : le libellé Ciqual recopié doit correspondre au code
for (const [id, c] of Object.entries(catalogue)) {
  const l = table[c.ciqual_code];
  if (!l) erreurs.push(`catalogue ${id} : code Ciqual ${c.ciqual_code} inconnu`);
  else if (l[0] !== c.ciqual_nom) erreurs.push(`catalogue ${id} : libellé « ${c.ciqual_nom} » ≠ Ciqual « ${l[0]} »`);
  if (!grille[id]) avert.push(`catalogue ${id} : pas de prix dans la grille`);
}

for (const { fichier, data } of recettesBrutes()) {
  const nom = basename(fichier);
  const p = Recette.safeParse(data);
  if (!p.success) {
    erreurs.push(`${nom} : schéma — ${p.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(' ; ')}`);
    continue;
  }
  const r = p.data;
  const e = (m: string) => erreurs.push(`${r.slug} : ${m}`);
  if (nom !== `${r.slug}.json`) e(`le fichier doit s'appeler ${r.slug}.json`);
  if (ids.has(r.id)) e('identifiant en double');
  ids.add(r.id);

  let legumes = 0;
  for (const ing of r.ingredients) {
    const c = catalogue[ing.ingredient];
    if (!c) {
      e(`ingrédient « ${ing.ingredient} » absent de data/ciqual-map.json`);
      continue;
    }
    if (c.ciqual_code !== ing.ciqual_code) e(`${ing.ingredient} : code ${ing.ciqual_code} ≠ catalogue ${c.ciqual_code}`);
    if (c.rayon !== ing.rayon) e(`${ing.ingredient} : rayon ${ing.rayon} ≠ catalogue ${c.rayon}`);
    if (!grille[ing.ingredient] && !ing.optionnel) e(`${ing.ingredient} : pas de prix`);
    if (c.legume && !ing.optionnel) legumes += ing.poids_g;
  }

  // Les valeurs stockées doivent être exactement celles recalculées
  try {
    const n = nutritionParPart(r.ingredients, r.portions_base, table).nutrition;
    if (JSON.stringify(n) !== JSON.stringify(r.nutrition_par_part)) e('nutrition_par_part pas à jour : lancer npm run compute');
    if (n.kcal < REGLES.kcalMin || n.kcal > REGLES.kcalMax) e(`${n.kcal} kcal par part, hors de ${REGLES.kcalMin}–${REGLES.kcalMax}`);
    if (n.proteines_g < REGLES.protMin) e(`${n.proteines_g} g de protéines par part (< ${REGLES.protMin})`);
  } catch (x) {
    e(`nutrition : ${(x as Error).message}`);
  }
  try {
    if (coutParPart(r.ingredients, r.portions_base, grille) !== r.cout_par_part_eur) e('cout_par_part_eur pas à jour : lancer npm run compute');
  } catch (x) {
    e(`prix : ${(x as Error).message}`);
  }
  if (legumes / r.portions_base < REGLES.legumesMin_g)
    e(`${Math.round(legumes / r.portions_base)} g de légumes par part (< ${REGLES.legumesMin_g} g)`);

  if (r.type === 'batch' && r.portions_base > r.conservation.frigo_jours + 1 && !r.conservation.congelable)
    e(`batch de ${r.portions_base} parts non congelable mais frigo ${r.conservation.frigo_jours} j : des parts dépasseraient J+3`);

  const age = (d: string) => (Date.now() - Date.parse(d)) / 86400_000;
  for (const s of r.sources)
    if (age(s.verifie_le) > REGLES.fraicheurLiens_j) avert.push(`${r.slug} : source vérifiée il y a plus de ${REGLES.fraicheurLiens_j} j (${s.url})`);
  if (!r.verifications.source_ok || !r.verifications.nutrition_ok || !r.verifications.prix_ok) e('verifications incomplètes');
  if (r.kcal_annoncees_par_part && !r.verifications.notes) avert.push(`${r.slug} : kcal annoncées sans note de vérification`);
  ok.push(r);
}

// Statistiques de répartition
const n = ok.length || 1;
const pct = (k: number) => `${Math.round((k / n) * 100)} %`;
const parType = (t: string) => ok.filter((r) => r.type === t).length;
const video = ok.filter((r) => r.sources.some((s) => s.type !== 'article')).length;
const familles = new Map<string, number>();
for (const r of ok) familles.set(FAMILLE_PROTEINE[r.proteine_principale], (familles.get(FAMILLE_PROTEINE[r.proteine_principale]) ?? 0) + 1);
const cuisines = new Set(ok.map((r) => r.cuisine));
if (video / n < 0.4) avert.push(`sources vidéo : ${pct(video)} des recettes (objectif ≥ 40 %)`);

writeFileSync(
  join(ROOT, 'reports/validation.md'),
  `# Validation de la base (${aujourdhui()})

${ok.length} recettes valides, ${erreurs.length} erreurs, ${avert.length} avertissements.

## Répartition

| | Nombre | Part | Objectif |
|---|---|---|---|
| Batch | ${parType('batch')} | ${pct(parType('batch'))} | ~50 % |
| Express | ${parType('express')} | ${pct(parType('express'))} | ~35 % |
| Assemblage | ${parType('assemblage')} | ${pct(parType('assemblage'))} | ~15 % |
| Avec TikTok / Instagram | ${video} | ${pct(video)} | ≥ 40 % |

Familles de protéines : ${[...familles].map(([f, k]) => `${f} ${k}`).join(', ')}.
Cuisines : ${[...cuisines].sort().join(', ')}.

## Erreurs

${erreurs.length ? erreurs.map((x) => `- ${x}`).join('\n') : 'Aucune.'}

## Avertissements

${avert.length ? avert.map((x) => `- ${x}`).join('\n') : 'Aucun.'}
`,
);
console.log(`${ok.length} recettes valides · ${erreurs.length} erreurs · ${avert.length} avertissements (reports/validation.md)`);
for (const x of erreurs) console.log(`  ✗ ${x}`);
if (erreurs.length) process.exitCode = 1;
