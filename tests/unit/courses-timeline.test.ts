import { describe, expect, it } from 'vitest';
import { besoins, libelleConditionnement, listeCourses, texteListe } from '../../src/domain/courses';
import { CAPACITES, planifierSession } from '../../src/domain/timeline';
import type { Cuisson } from '../../src/domain/types';
import { baseReelle } from '../helpers';

const cuisson = (recetteId: string, parts: number, extra: Partial<Cuisson> = {}): Cuisson => ({
  id: `${recetteId}@t`, recetteId, jour: -1, creneau: null, parts, ...extra,
});

describe('liste de courses', () => {
  const base = baseReelle();

  it('met les besoins à l’échelle des parts', () => {
    // dahl : 300 g de lentilles corail pour 4 parts
    expect(besoins([cuisson('dahl-lentilles-corail-epinards', 4)], base).lentilles_corail).toBeUndefined();
    expect(besoins([cuisson('dahl-lentilles-corail-epinards', 4)], base)['lentilles-corail']).toBeCloseTo(300);
    expect(besoins([cuisson('dahl-lentilles-corail-epinards', 2)], base)['lentilles-corail']).toBeCloseTo(150);
    expect(besoins([cuisson('dahl-lentilles-corail-epinards', 2)], base, 2)['lentilles-corail']).toBeCloseTo(300);
    expect(besoins([cuisson('dahl-lentilles-corail-epinards', 4, { stock: true })], base)).toEqual({});
  });

  it('arrondit aux paquets entiers et déduit le stock et le placard', () => {
    const c = [cuisson('dahl-lentilles-corail-epinards', 4)];
    const sans = listeCourses(c, { base });
    const lentilles = sans.lignes.find((l) => l.ingredient === 'lentilles-corail')!;
    const paquet = base.prix['lentilles-corail'].conditionnement.quantite;
    expect(lentilles.paquets).toBe(Math.ceil(300 / paquet));
    expect(lentilles.coutCaisse).toBeCloseTo(lentilles.paquets * base.prix['lentilles-corail'].prix_eur, 2);
    expect(lentilles.coutUtilise).toBeLessThanOrEqual(lentilles.coutCaisse);

    const avecStock = listeCourses(c, { base, stock: { 'lentilles-corail': 300 } });
    expect(avecStock.lignes.find((l) => l.ingredient === 'lentilles-corail')!.paquets).toBe(0);

    const placard = listeCourses(c, { base, placardDeBase: ['huile-olive'] });
    const huile = placard.lignes.find((l) => l.ingredient === 'huile-olive')!;
    expect(huile.placard).toBe(true);
    expect(huile.coutCaisse).toBe(0);
    expect(huile.coutUtilise).toBeGreaterThan(0);
    expect(placard.totalCaisse).toBeLessThan(sans.totalCaisse);
  });

  it('applique un prix corrigé à la main', () => {
    const c = [cuisson('dahl-lentilles-corail-epinards', 4)];
    const l = listeCourses(c, { base, prixCorriges: { 'lentilles-corail': 0.5 } }).lignes.find((x) => x.ingredient === 'lentilles-corail')!;
    expect(l.prixCorrige).toBe(true);
    expect(l.coutCaisse).toBeCloseTo(l.paquets * 0.5, 2);
  });

  it('regroupe par rayon et produit un texte à partager', () => {
    const liste = listeCourses([cuisson('chili-con-carne', 4)], { base });
    const rayons = liste.parRayon.map((g) => g.rayon);
    expect(rayons).toEqual([...rayons].sort((a, b) => ['fruits-legumes', 'frais', 'viandes-poissons', 'epicerie', 'surgeles'].indexOf(a) - ['fruits-legumes', 'frais', 'viandes-poissons', 'epicerie', 'surgeles'].indexOf(b)));
    const texte = texteListe(liste);
    expect(texte).toMatch(/^Fruits et légumes :/);
    expect(texte).toMatch(/Total : \d+,\d\d €$/);
    const sansBoeuf = texteListe(liste, new Set(['boeuf-hache-5']));
    expect(sansBoeuf).not.toContain(base.prix['boeuf-hache-5'].produit);
    expect(libelleConditionnement({ conditionnement: { quantite: 1000, unite: 'g' } })).toBe('1 kg');
    expect(libelleConditionnement({ conditionnement: { quantite: 400, unite: 'ml' } })).toBe('40 cl');
  });
});

describe('timeline de la session batch', () => {
  const base = baseReelle();
  const recettes = ['chili-con-carne', 'lasagnes-courgette-boeuf', 'curry-boeuf-hache'].map((id) => base.parId[id]);
  const t = planifierSession(recettes);

  it('ne dépasse jamais la capacité des appareils ni une paire de mains', () => {
    const charge = (ressource: string, instant: number) =>
      t.etapes.filter((e) => {
        if (ressource === 'mains') {
          const mains = e.enFond ? Math.min(2, e.fin - e.debut) : e.actif ? e.fin - e.debut : 0;
          return e.debut <= instant && instant < e.debut + mains;
        }
        return e.equipement === ressource && e.debut <= instant && instant < e.fin;
      }).length;
    for (let m = 0; m < t.duree; m++)
      for (const [res, cap] of Object.entries(CAPACITES)) expect(charge(res, m + 0.5)).toBeLessThanOrEqual(cap);
  });

  it('respecte l’ordre des étapes de chaque recette', () => {
    for (const r of recettes) {
      const es = t.etapes.filter((e) => e.recetteId === r.id).sort((a, b) => a.index - b.index);
      expect(es).toHaveLength(r.etapes.length);
      for (let i = 1; i < es.length; i++) {
        const prec = es[i - 1];
        expect(es[i].debut).toBeGreaterThanOrEqual(prec.enFond ? prec.debut : prec.fin);
      }
    }
  });

  it('fait gagner du temps en parallélisant', () => {
    const sommeSeparee = recettes.reduce((s, r) => s + planifierSession([r]).duree, 0);
    expect(t.duree).toBeLessThan(sommeSeparee);
    expect(t.tempsActif).toBeLessThanOrEqual(t.duree);
  });
});
