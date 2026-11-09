import { describe, expect, it } from 'vitest';
import { ecartKcal, ErreurNutrition, nutritionParPart, type TableCiqual } from '../../src/domain/nutrition';
import { achat, coutParPart, ErreurPrix, quantiteEnUniteConditionnement } from '../../src/domain/pricing';
import { euros, jourCourt, kcal } from '../../src/domain/format';

// Valeurs de Ciqual 2025 (pour 100 g) ; 36017 a ses fibres retirées et 99999 est fictif, pour tester les cas limites
const table: TableCiqual = {
  '20535': ['Lentille corail, sèche', 'légumineuses', 328, 27.7, 44.9, 0.8, 15.4],
  '20034': ['Oignon, cru', 'légumes', 39, 1.1, 6.25, 0.62, 1.7],
  '36017': ['Poulet, filet sans peau cru (fibres retirées pour le test)', 'viandes crues', 110, 23.4, 0, 1.5, null],
  '99999': ['Aliment fictif incomplet', 'test', null, 1, 1, 1, 1],
};

describe('nutritionParPart', () => {
  it('somme les ingrédients au prorata du poids et divise par les parts', () => {
    const { nutrition } = nutritionParPart(
      [
        { ciqual_code: '20535', poids_g: 200, optionnel: false, nom_affiche: 'lentilles' },
        { ciqual_code: '20034', poids_g: 100, optionnel: false, nom_affiche: 'oignon' },
      ],
      2,
      table,
    );
    // (328×2 + 39) / 2 = 347,5 → 348
    expect(nutrition.kcal).toBe(348);
    expect(nutrition.proteines_g).toBe(28.3); // (27,7×2 + 1,1) / 2 = 28,25 → arrondi au dixième
    expect(nutrition.methode).toBe('ciqual-2025');
  });

  it('ignore les ingrédients optionnels', () => {
    const { nutrition } = nutritionParPart(
      [
        { ciqual_code: '20034', poids_g: 100, optionnel: false, nom_affiche: 'oignon' },
        { ciqual_code: '20535', poids_g: 500, optionnel: true, nom_affiche: 'lentilles' },
      ],
      1,
      table,
    );
    expect(nutrition.kcal).toBe(39);
  });

  it('compte 0 les fibres absentes et le signale', () => {
    const r = nutritionParPart([{ ciqual_code: '36017', poids_g: 100, optionnel: false, nom_affiche: 'poulet' }], 1, table);
    expect(r.nutrition.fibres_g).toBe(0);
    expect(r.avertissements).toHaveLength(1);
  });

  it('refuse un code inconnu ou une valeur énergétique absente', () => {
    expect(() =>
      nutritionParPart([{ ciqual_code: '1', poids_g: 10, optionnel: false, nom_affiche: 'x' }], 1, table),
    ).toThrow(ErreurNutrition);
    expect(() =>
      nutritionParPart([{ ciqual_code: '99999', poids_g: 10, optionnel: false, nom_affiche: 'x' }], 1, table),
    ).toThrow(ErreurNutrition);
  });

  it('calcule l’écart relatif des kcal annoncées', () => {
    expect(ecartKcal(460, 400)).toBeCloseTo(0.15);
  });
});

describe('prix', () => {
  const lentilles = { conditionnement: { quantite: 500, unite: 'g' as const }, prix_eur: 1.59 };
  const oeufs = { conditionnement: { quantite: 6, unite: 'pièce' as const }, poids_piece_g: 55, prix_eur: 1.89 };
  const lait = { conditionnement: { quantite: 400, unite: 'ml' as const }, prix_eur: 1.2 };

  it('convertit dans l’unité du conditionnement', () => {
    expect(quantiteEnUniteConditionnement({ quantite: 240, unite: 'g', poids_g: 240, nom_affiche: 'l' }, lentilles)).toBe(240);
    expect(quantiteEnUniteConditionnement({ quantite: 2, unite: 'pièce', poids_g: 110, nom_affiche: 'o' }, oeufs)).toBe(2);
    expect(quantiteEnUniteConditionnement({ quantite: 110, unite: 'g', poids_g: 110, nom_affiche: 'o' }, oeufs)).toBe(2);
    expect(() =>
      quantiteEnUniteConditionnement({ quantite: 100, unite: 'g', poids_g: 100, nom_affiche: 'lait' }, lait),
    ).toThrow(ErreurPrix);
  });

  it('calcule le coût par part sans arrondir au paquet', () => {
    const c = coutParPart(
      [
        { ingredient: 'lentilles', quantite: 250, unite: 'g', poids_g: 250, nom_affiche: 'l' },
        { ingredient: 'oeufs', quantite: 4, unite: 'pièce', poids_g: 220, nom_affiche: 'o' },
      ],
      4,
      { lentilles, oeufs },
    );
    // (0,795 + 1,26) / 4 = 0,51375 → 0,51
    expect(c).toBe(0.51);
  });

  it('arrondit aux paquets entiers et calcule le reste', () => {
    expect(achat(700, 0, lentilles)).toEqual({ paquets: 2, cout_caisse_eur: 3.18, reste: 300, cout_utilise_eur: 2.23 });
    expect(achat(700, 300, lentilles).paquets).toBe(1);
    expect(achat(200, 300, lentilles)).toMatchObject({ paquets: 0, cout_caisse_eur: 0, reste: 100 });
    // pas de 2e paquet pour une erreur d'arrondi flottant
    expect(achat(0.1 + 0.2 + 499.7, 0, lentilles).paquets).toBe(1);
  });
});

describe('formats français', () => {
  it('formate kcal, euros et jours', () => {
    expect(kcal(1010).replace(/\s/g, ' ')).toBe('1 010 kcal');
    expect(euros(0.99)).toBe('0,99 €');
    expect(jourCourt(new Date(2026, 10, 16))).toBe('lun. 16');
  });
});
