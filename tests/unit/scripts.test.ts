import { describe, expect, it } from 'vitest';
import { parseCiqualCell } from '../../scripts/ciqual-import';
import { comparables, mediane, prixParUnite, type Correspondance } from '../../scripts/prices-fetch';
import { extraireJsonLd, typeDeSource } from '../../scripts/lib/sources';
import { extraireTableauJson } from '../../scripts/lib/http';

describe('cellules Ciqual', () => {
  it('lit nombres, traces, seuils et absences', () => {
    expect(parseCiqualCell('12,3')).toEqual({ v: 12.3 });
    expect(parseCiqualCell(4)).toEqual({ v: 4 });
    expect(parseCiqualCell('traces')).toEqual({ v: 0, qualif: 'traces' });
    expect(parseCiqualCell('< 0,5')).toEqual({ v: 0.25, qualif: 'inf' });
    expect(parseCiqualCell('-')).toEqual({ v: 0, qualif: 'manquant' });
    expect(() => parseCiqualCell('n.d.')).toThrow();
  });
});

describe('prix Open Prices', () => {
  const sac: Correspondance = { produit: 'Lentilles 500 g', conditionnement: { quantite: 500, unite: 'g' } };
  const piece: Correspondance = { produit: 'Courgette', conditionnement: { quantite: 1, unite: 'pièce' }, poids_piece_g: 250 };

  it('convertit un prix au kilo ou un produit emballé en prix par unité de conditionnement', () => {
    expect(prixParUnite({ price: 3, price_per: 'KILOGRAM', date: '' }, sac)).toBeCloseTo(0.003);
    expect(prixParUnite({ price: 2, price_per: 'KILOGRAM', date: '' }, piece)).toBeCloseTo(0.5);
    expect(prixParUnite({ price: 0.8, price_per: 'UNIT', date: '' }, piece)).toBe(0.8);
    expect(prixParUnite({ price: 1.5, date: '', product: { product_quantity: 500, product_quantity_unit: 'g' } }, sac)).toBeCloseTo(0.003);
    // pas de quantité connue : on ne devine pas
    expect(prixParUnite({ price: 1.5, date: '', product: { product_quantity: null } }, sac)).toBeNull();
  });

  it('écarte les relevés remisés, mal nommés ou de taille trop différente', () => {
    const c: Correspondance = { ...sac, open_prices: { mots: ['corail'], exclure: ['bio'] } };
    const p = (nom: string, q: number, remise = false) => ({ price: 1, date: '', price_is_discounted: remise, product: { product_name: nom, product_quantity: q } });
    const garde = comparables([p('Lentilles corail', 500), p('Lentilles corail bio', 500), p('Lentilles vertes', 500), p('Lentilles corail', 5000), p('Lentilles Corail', 400, true)], c);
    expect(garde).toHaveLength(1);
  });

  it('calcule une médiane', () => {
    expect(mediane([3, 1, 2])).toBe(2);
    expect(mediane([4, 1, 2, 3])).toBe(2.5);
  });
});

describe('sources', () => {
  it('reconnaît le type de lien', () => {
    expect(typeDeSource('https://www.tiktok.com/@a/video/1')).toBe('tiktok');
    expect(typeDeSource('https://www.instagram.com/p/abc/')).toBe('instagram');
    expect(typeDeSource('https://cuisine-addict.com/chili-con-carne/')).toBe('article');
  });

  it('extrait une recette schema.org, même dans un @graph', () => {
    const html = `<script type="application/ld+json">{"@graph":[{"@type":"WebPage"},{"@type":"Recipe","name":"Dahl","recipeYield":"4","recipeIngredient":["300 g lentilles"],"recipeInstructions":[{"@type":"HowToStep","text":"Rincer"}],"nutrition":{"calories":"378 kcal"}}]}</script>`;
    expect(extraireJsonLd(html)).toMatchObject({ nom: 'Dahl', portions: '4', ingredients: ['300 g lentilles'], etapes: ['Rincer'], kcal: '378 kcal' });
    expect(extraireJsonLd('<p>rien</p>')).toBeNull();
  });

  it('extrait un tableau JSON imbriqué dans une page', () => {
    expect(extraireTableauJson('x "hits":[{"a":"]"},{"b":[1,2]}] y', '"hits":[')).toEqual([{ a: ']' }, { b: [1, 2] }]);
  });
});
