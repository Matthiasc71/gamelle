/**
 * Recalcule pour chaque recette la nutrition par part (Ciqual 2025) et le coût par part
 * (grille data/prix-reference.json), met à jour `verifications`, et écrit reports/nutrition.md.
 *
 *   npm run compute
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ecartKcal, nutritionParPart, SEUIL_ECART_KCAL } from '../src/domain/nutrition';
import { coutParPart } from '../src/domain/pricing';
import type { IngredientRecette, PrixReference } from '../src/domain/schema';
import { aujourdhui, ecrireJson, lireJson, recettesBrutes, ROOT, tableCiqual } from './lib/data';

const table = tableCiqual();
const grille = lireJson<Record<string, PrixReference>>('data/prix-reference.json');
const lignes: string[] = [];
const alertes: string[] = [];
let erreurs = 0;

for (const { fichier, data } of recettesBrutes()) {
  const ings = data.ingredients as IngredientRecette[];
  const portions = data.portions_base as number;
  const verifs = (data.verifications ?? {}) as Record<string, unknown>;
  try {
    const { nutrition, avertissements } = nutritionParPart(ings, portions, table);
    data.nutrition_par_part = nutrition;
    verifs.nutrition_ok = true;
    const annoncees = data.kcal_annoncees_par_part as number | undefined;
    let ecartTxt = '—';
    if (annoncees) {
      const e = ecartKcal(annoncees, nutrition.kcal);
      ecartTxt = `${annoncees} (${e > 0 ? '' : ''}${Math.round(e * 100)} %)`;
      if (e > SEUIL_ECART_KCAL)
        alertes.push(
          `- **${data.slug}** : la source annonce ${annoncees} kcal/part, Ciqual donne ${nutrition.kcal} (écart ${Math.round(e * 100)} %). ` +
            `Vérifié : ${(verifs.notes as string) || 'à expliquer dans verifications.notes'}`,
        );
    }
    for (const a of avertissements) alertes.push(`- ${data.slug} : ${a}`);
    lignes.push(
      `| ${data.slug} | ${portions} | ${nutrition.kcal} | ${nutrition.proteines_g} | ${nutrition.glucides_g} | ${nutrition.lipides_g} | ${nutrition.fibres_g} | ${ecartTxt} |`,
    );
  } catch (e) {
    erreurs++;
    verifs.nutrition_ok = false;
    alertes.push(`- **${data.slug}** : ERREUR nutrition — ${(e as Error).message}`);
  }
  try {
    data.cout_par_part_eur = coutParPart(ings, portions, grille);
    verifs.prix_ok = true;
  } catch (e) {
    erreurs++;
    verifs.prix_ok = false;
    alertes.push(`- **${data.slug}** : ERREUR prix — ${(e as Error).message}`);
  }
  data.verifications = verifs;
  ecrireJson(fichier, data);
}

writeFileSync(
  join(ROOT, 'reports/nutrition.md'),
  `# Nutrition recalculée avec Ciqual 2025 (${aujourdhui()})

Source : Anses. Table de composition nutritionnelle des aliments Ciqual 2025 (doi:10.57745/RDMHWY).
Valeurs par part, ingrédients optionnels exclus. Écart signalé au-delà de ${SEUIL_ECART_KCAL * 100} %.

## Alertes

${alertes.length ? alertes.join('\n') : 'Aucune.'}

## Détail

| Recette | Parts | kcal | Prot. g | Gluc. g | Lip. g | Fibres g | kcal annoncées (écart) |
|---|---|---|---|---|---|---|---|
${lignes.join('\n')}
`,
);
console.log(`${lignes.length} recettes calculées, ${erreurs} erreurs`);
if (erreurs) process.exitCode = 1;
