/**
 * Calcul nutritionnel à partir de la table Ciqual (Anses).
 * Valeurs Ciqual pour 100 g, dans l'état où l'ingrédient est pesé (cru, cuit, égoutté).
 */
import type { IngredientRecette, Nutrition } from './schema';

/** [nom, groupe, kcal, protéines, glucides, lipides, fibres] pour 100 g ; null = absent de Ciqual. */
export type LigneCiqual = [string, string, ...(number | null)[]];
export type TableCiqual = Record<string, LigneCiqual>;

export class ErreurNutrition extends Error {}

const r1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Nutrition par part. Les ingrédients optionnels sont exclus.
 * Lève une erreur si un code est inconnu ou si kcal/protéines/glucides/lipides manquent.
 * Des fibres absentes comptent 0 et sont signalées dans `avertissements`.
 */
export function nutritionParPart(
  ingredients: Pick<IngredientRecette, 'ciqual_code' | 'poids_g' | 'optionnel' | 'nom_affiche'>[],
  portions: number,
  table: TableCiqual,
): { nutrition: Nutrition; avertissements: string[] } {
  if (portions <= 0) throw new ErreurNutrition('portions doit être > 0');
  const tot = [0, 0, 0, 0, 0];
  const avertissements: string[] = [];
  for (const ing of ingredients) {
    if (ing.optionnel) continue;
    const ligne = table[ing.ciqual_code];
    if (!ligne) throw new ErreurNutrition(`Code Ciqual inconnu ${ing.ciqual_code} (${ing.nom_affiche})`);
    const vals = ligne.slice(2, 7) as (number | null)[];
    vals.forEach((v, i) => {
      if (v === null || v === undefined) {
        if (i === 4) {
          avertissements.push(`fibres absentes de Ciqual pour ${ligne[0]} : comptées 0`);
          return;
        }
        throw new ErreurNutrition(`Valeur absente dans Ciqual pour ${ligne[0]} (${ing.ciqual_code})`);
      }
      tot[i] += (v * ing.poids_g) / 100;
    });
  }
  return {
    nutrition: {
      kcal: Math.round(tot[0] / portions),
      proteines_g: r1(tot[1] / portions),
      glucides_g: r1(tot[2] / portions),
      lipides_g: r1(tot[3] / portions),
      fibres_g: r1(tot[4] / portions),
      methode: 'ciqual-2025',
    },
    avertissements,
  };
}

/** Écart relatif entre calories annoncées par la source et calories recalculées. */
export function ecartKcal(annoncees: number, calculees: number): number {
  return Math.abs(annoncees - calculees) / calculees;
}

export const SEUIL_ECART_KCAL = 0.15;
