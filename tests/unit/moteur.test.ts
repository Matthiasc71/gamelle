import { describe, expect, it } from 'vitest';
import { listeCourses } from '../../src/domain/courses';
import { lundiDeSemaine, moisDeSemaine } from '../../src/domain/dates';
import { creneauxBatch, planEchange, proposerCreneaux } from '../../src/domain/echange';
import { appliquer, aUtiliserVite, etatCourses, evenementCuisson, finDeSemaine, FRIGO_VIDE, rejouer, stockDisponible } from '../../src/domain/frigo';
import { genererMenu } from '../../src/domain/planner';
import { detailsRepas, frigoJours, verifierMenu, violationsDures } from '../../src/domain/regles';
import { alternatives, remplacerRepas } from '../../src/domain/remplacement';
import { jourDe, momentDe, REGLAGES_DEFAUT, type Menu } from '../../src/domain/types';
import { baseReelle, ctxDefaut } from '../helpers';

const ctx = ctxDefaut();
const base = baseReelle();
const SEMAINE = '2026-W47';
const menu = genererMenu({ ...ctx, semaine: SEMAINE });

/** Structure : 14 créneaux, chaque cuisson servie autant de fois que ses parts. */
function structureOk(m: Menu) {
  expect(m.repas.map((r) => r.creneau)).toEqual([...Array(14).keys()]);
  for (const c of m.cuissons) expect(m.repas.filter((r) => r.cuissonId === c.id)).toHaveLength(c.parts);
  for (const r of m.repas) expect(m.cuissons.some((c) => c.id === r.cuissonId)).toBe(true);
}

describe('générateur de menu', () => {
  it('est déterministe et change chaque semaine', () => {
    expect(genererMenu({ ...ctx, semaine: SEMAINE })).toEqual(menu);
    const autre = genererMenu({ ...ctx, semaine: '2026-W48' });
    expect(autre.repas.map((r) => r.recetteId)).not.toEqual(menu.repas.map((r) => r.recetteId));
  });

  it('respecte toutes les règles dures', () => {
    structureOk(menu);
    expect(violationsDures(verifierMenu(menu, ctx, moisDeSemaine(menu.lundi)))).toEqual([]);
  });

  it('suit le rythme : 2 batchs le dimanche, 1 soir de semaine, 2 à 4 repas rapides', () => {
    const batchs = menu.cuissons.filter((c) => base.parId[c.recetteId].type === 'batch');
    expect(batchs.filter((c) => c.jour === -1)).toHaveLength(2);
    expect(batchs.filter((c) => c.jour >= 0)).toHaveLength(1);
    const rapides = menu.repas.filter((r) => base.parId[r.recetteId].type !== 'batch').length;
    expect(rapides).toBeGreaterThanOrEqual(2);
    expect(rapides).toBeLessThanOrEqual(4);
  });

  it('marque les boîtes : frigo jusqu’à J+3, congélateur au-delà, cuisine le soir de semaine', () => {
    for (const d of detailsRepas(menu, base)) {
      if (d.recette.type !== 'batch') continue;
      if (d.creneau === d.cuisson.creneau) expect(d.statut).toBe('cuisine');
      else if (d.joursDepuisCuisson <= frigoJours(d.recette)) expect(d.statut).toBe('boite');
      else {
        expect(d.statut).toBe('congele');
        expect(d.recette.conservation.congelable).toBe(true);
      }
      // jamais servi avant d'être cuisiné
      expect(d.joursDepuisCuisson).toBeGreaterThanOrEqual(0);
    }
  });

  it('respecte les aliments exclus et l’équipement', () => {
    const sansFour = { ...REGLAGES_DEFAUT, equipement: ['plaques', 'micro-ondes', 'rice-cooker'] as const };
    const m = genererMenu({ ...ctx, reglages: { ...sansFour, equipement: [...sansFour.equipement] }, semaine: SEMAINE });
    for (const r of m.repas) expect(base.parId[r.recetteId].equipement).not.toContain('four');
    const m2 = genererMenu({ ...ctx, reglages: { ...REGLAGES_DEFAUT, exclus: ['poulet-filet'] }, semaine: SEMAINE });
    for (const r of m2.repas) expect(base.parId[r.recetteId].ingredients.map((i) => i.ingredient)).not.toContain('poulet-filet');
  });

  it('écarte les recettes des 3 dernières semaines quand la base le permet, et le dit sinon', () => {
    const historique = [menu.repas.map((r) => r.recetteId)];
    const m = genererMenu({ ...ctx, historique, semaine: '2026-W48' });
    const recentes = new Set(historique.flat());
    const repris = m.repas.filter((r) => recentes.has(r.recetteId));
    if (repris.length) expect(m.relachements.join(' ')).toMatch(/reviennent/);
  });
});

describe('remplacement d’un repas', () => {
  it('propose 3 alternatives du même type de créneau à ±10 % de calories', () => {
    for (const creneau of [0, 5, 13]) {
      const alts = alternatives(menu, creneau, ctx);
      const r0 = base.parId[menu.repas[creneau].recetteId];
      expect(alts.length).toBeGreaterThan(0);
      expect(alts.length).toBeLessThanOrEqual(3);
      for (const a of alts) {
        expect(a.recette.creneaux).toContain(momentDe(creneau));
        expect(Math.abs(a.recette.nutrition_par_part.kcal - r0.nutrition_par_part.kcal)).toBeLessThanOrEqual(r0.nutrition_par_part.kcal * 0.1);
        expect(a.menu.repas[creneau].recetteId).toBe(a.recette.id);
        structureOk(a.menu);
      }
    }
  });

  it('ne modifie pas le menu d’origine (pour pouvoir annuler)', () => {
    const avant = JSON.stringify(menu);
    const batch = menu.repas.find((r) => base.parId[r.recetteId].type === 'batch')!;
    const m = remplacerRepas(menu, batch.creneau, 'wrap-thon-avocat');
    expect(JSON.stringify(menu)).toBe(avant);
    // la part retirée n'est plus cuisinée : la cuisson perd une part
    const c0 = menu.cuissons.find((c) => c.id === batch.cuissonId)!;
    const c1 = m.cuissons.find((c) => c.id === batch.cuissonId);
    expect(c1?.parts ?? 0).toBe(c0.parts - 1);
    structureOk(m);
  });
});

describe('échange avec un favori', () => {
  it('place un favori express au meilleur créneau et liste le plat retiré', () => {
    const plans = proposerCreneaux(menu, 'chakchouka-feta', ctx);
    expect(plans.length).toBeGreaterThan(0);
    const p = plans[0];
    expect(p.creneaux).toHaveLength(1);
    expect(p.retires).toHaveLength(1);
    expect(p.menu.repas[p.creneaux[0]].recetteId).toBe('chakchouka-feta');
    structureOk(p.menu);
    // les plans sont triés : les moins d'avertissements d'abord
    for (let i = 1; i < plans.length; i++) expect(plans[i].avertissements.length).toBeGreaterThanOrEqual(plans[i - 1].avertissements.length);
  });

  it('remplit les parts d’un favori batch sans dépasser J+3 au frigo ni le servir deux fois de suite', () => {
    const id = base.recettes.find((r) => r.type === 'batch' && !menu.repas.some((x) => x.recetteId === r.id))!.id;
    for (const jour of [-1, 2]) {
      const creneaux = creneauxBatch(menu, id, jour, ctx);
      expect(creneaux.length).toBeGreaterThan(0);
      for (let i = 1; i < creneaux.length; i++) expect(creneaux[i] - creneaux[i - 1]).toBeGreaterThan(1);
      const p = planEchange(menu, id, creneaux, ctx, jour);
      structureOk(p.menu);
      expect(p.retires.map((r) => r.creneau)).toEqual(creneaux);
      for (const d of detailsRepas(p.menu, base).filter((x) => x.recette.id === id)) {
        expect(d.joursDepuisCuisson).toBeGreaterThanOrEqual(0);
        if (d.statut === 'congele') expect(d.recette.conservation.congelable).toBe(true);
        else if (d.statut === 'boite') expect(jourDe(d.creneau) - jour).toBeLessThanOrEqual(3);
      }
    }
  });

  it('avertit quand l’échange casse une règle, sans l’empêcher', () => {
    // le même plat 5 fois dans la semaine : au-delà du maximum de 4
    const creneaux = [0, 2, 4, 6, 8];
    const p = planEchange(menu, 'wrap-thon-avocat', creneaux, ctx);
    expect(p.avertissements.some((v) => v.code === 'max-semaine')).toBe(true);
    expect(p.menu.repas.filter((r) => r.recetteId === 'wrap-thon-avocat')).toHaveLength(5);
  });
});

describe('frigo', () => {
  const lundi = lundiDeSemaine(SEMAINE);

  it('ajoute les achats, déduit les ingrédients cuisinés et gère les boîtes', () => {
    const dahl = { id: 'dahl@dim', recetteId: 'dahl-lentilles-corail-epinards', jour: -1, creneau: null, parts: 4 };
    let e = appliquer(FRIGO_VIDE, { type: 'achat', ingredient: 'lentilles-corail', quantite: 500, date: '2026-11-14' }, base);
    expect(stockDisponible(e, '2026-11-15')['lentilles-corail']).toBe(500);
    const m: Menu = {
      semaine: SEMAINE, lundi, cuissons: [dahl], graine: 0, relachements: [],
      repas: [0, 2, 6, 9].map((creneau) => ({ creneau, recetteId: dahl.recetteId, cuissonId: dahl.id })),
    };
    const ev = evenementCuisson(m, dahl, base, '2026-11-15');
    e = appliquer(e, ev, base);
    expect(stockDisponible(e, '2026-11-15')['lentilles-corail']).toBeCloseTo(200);
    expect(e.boites.filter((b) => b.lieu === 'frigo')).toHaveLength(2); // lundi midi, mardi midi
    expect(e.boites.filter((b) => b.lieu === 'congelateur')).toHaveLength(2); // jeudi midi, vendredi soir
    e = appliquer(e, { type: 'mange', boiteId: e.boites[0].id }, base);
    expect(e.boites).toHaveLength(3);
    e = appliquer(e, { type: 'correction', ingredient: 'lentilles-corail', lieu: 'placard', delta: -50, date: '2026-11-16' }, base);
    expect(stockDisponible(e, '2026-11-16')['lentilles-corail']).toBeCloseTo(150);
  });

  it('signale ce qui périme et congèle la viande crue restante en fin de semaine', () => {
    const e = rejouer([
      { type: 'achat', ingredient: 'poulet-filet', quantite: 1000, date: '2026-11-14' },
      { type: 'achat', ingredient: 'riz-basmati', quantite: 1000, date: '2026-11-14' },
    ], base);
    expect(aUtiliserVite(e, '2026-11-15').articles.map((a) => a.ingredient)).toContain('poulet-filet');
    const fin = finDeSemaine(e, '2026-11-15', base);
    expect(fin.articles.find((a) => a.ingredient === 'poulet-filet')!.lieu).toBe('congelateur');
    expect(stockDisponible(fin, '2026-11-30')['poulet-filet']).toBe(1000);
  });

  it('échange avant les courses : la liste se met à jour (retirés sortent, favori entre, moins le stock)', () => {
    const plan = proposerCreneaux(menu, 'chakchouka-feta', ctx)[0];
    const retire = base.parId[plan.retires[0].recetteId];
    const avant = listeCourses(menu.cuissons, { base, placardDeBase: REGLAGES_DEFAUT.placardDeBase });
    const apres = listeCourses(plan.menu.cuissons, { base, placardDeBase: REGLAGES_DEFAUT.placardDeBase, stock: { 'pulpe-tomate': 400 } });
    const ids = (l: typeof avant) => new Set(l.lignes.filter((x) => x.paquets > 0).map((x) => x.ingredient));
    // un ingrédient propre au plat retiré disparaît de la liste
    const propres = retire.ingredients.map((i) => i.ingredient).filter((i) => !plan.menu.cuissons.some((c) => base.parId[c.recetteId].ingredients.some((x) => x.ingredient === i)));
    for (const i of propres) expect(ids(apres).has(i)).toBe(false);
    // la tomate du favori est déjà au frigo : rien à acheter
    expect(apres.lignes.find((x) => x.ingredient === 'pulpe-tomate')?.paquets ?? 0).toBe(0);
    expect(ids(avant).size).toBeGreaterThan(0);
  });

  it('échange après les courses : stock réservé, manquants à racheter, restes à utiliser', () => {
    // courses faites pour le menu d'origine
    const liste = listeCourses(menu.cuissons, { base, placardDeBase: REGLAGES_DEFAUT.placardDeBase });
    const etat = rejouer(
      liste.lignes.filter((l) => l.paquets > 0).map((l) => ({
        type: 'achat' as const, ingredient: l.ingredient, quantite: l.paquets * base.prix[l.ingredient].conditionnement.quantite, date: '2026-11-14',
      })),
      base,
    );
    const plan = proposerCreneaux(menu, 'galette-thon-oeufs-crudites', ctx)[0];
    const ec = etatCourses(plan.menu, etat, base, '2026-11-15', 1, REGLAGES_DEFAUT.placardDeBase);
    for (const l of ec.lignes) {
      expect(l.reserve + l.aRacheter).toBeCloseTo(l.besoin);
      expect(l.reserve).toBeLessThanOrEqual(stockDisponible(etat, '2026-11-15')[l.ingredient] ?? 0);
    }
    // le thon de la galette manque probablement : il est dans la mini-liste à racheter
    const thon = ec.lignes.find((l) => l.ingredient === 'thon-naturel');
    if (!liste.lignes.some((l) => l.ingredient === 'thon-naturel' && l.paquets > 0)) expect(thon!.aRacheter).toBeGreaterThan(0);
    // ce qui avait été acheté pour le plat retiré seulement est signalé « à utiliser »
    const retire = base.parId[plan.retires[0].recetteId];
    const besoinsApres = new Set(ec.lignes.map((l) => l.ingredient));
    const orphelins = retire.ingredients.map((i) => i.ingredient).filter((i) => !besoinsApres.has(i) && (stockDisponible(etat, '2026-11-15')[i] ?? 0) > 0 && base.catalogue[i].rangement !== 'placard');
    for (const i of orphelins) expect(ec.aUtiliser.map((a) => a.ingredient)).toContain(i);
  });
});
