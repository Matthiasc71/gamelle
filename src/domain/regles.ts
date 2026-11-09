/**
 * Règles d'un menu hebdomadaire et détail de chaque repas (cuisiné, en boîte, congelé…).
 * Utilisé par le générateur, par les avertissements d'échange et par les tests.
 */
import { listeCourses } from './courses';
import { FAMILLE_PROTEINE } from './constantes';
import type { Recette } from './schema';
import { planifierSession, type Timeline } from './timeline';
import { jourDe, momentDe, NB_CRENEAUX, type Base, type Cuisson, type Menu, type Reglages, type Stock } from './types';

/** Jours de frigo autorisés après la cuisson (J+3 au maximum). */
export const FRIGO_MAX_JOURS = 3;

export type ContexteMenu = {
  base: Base;
  reglages: Reglages;
  /** Recettes servies les semaines précédentes, la plus récente d'abord. */
  historique?: string[][];
  stock?: Stock;
  prixCorriges?: Record<string, number>;
  favoris?: string[];
};

export type StatutRepas = 'cuisine' | 'boite' | 'congele' | 'express' | 'assemblage';

export type DetailRepas = {
  creneau: number;
  jour: number;
  moment: 'midi' | 'soir';
  recette: Recette;
  cuisson: Cuisson;
  statut: StatutRepas;
  /** Numéro de la part (1..parts) et nombre de parts de la cuisson. */
  part: number;
  parts: number;
  /** Jours écoulés depuis la cuisson (0 = cuisiné le jour même). */
  joursDepuisCuisson: number;
};

export const estBatch = (r: Recette) => r.type === 'batch';

/** Jours de frigo autorisés pour une recette. */
export const frigoJours = (r: Recette) => Math.min(FRIGO_MAX_JOURS, r.conservation.frigo_jours);

/** Statut d'un repas tiré d'une cuisson donnée. */
export function statutRepas(r: Recette, c: Cuisson, creneau: number): StatutRepas {
  if (c.creneau === creneau) return r.type === 'assemblage' ? 'assemblage' : r.type === 'express' ? 'express' : 'cuisine';
  if (c.stock) return 'congele';
  return jourDe(creneau) - c.jour <= frigoJours(r) ? 'boite' : 'congele';
}

export function detailsRepas(menu: Menu, base: Base): DetailRepas[] {
  const parId = Object.fromEntries(menu.cuissons.map((c) => [c.id, c]));
  const rangs: Record<string, number> = {};
  return menu.repas.map((rp) => {
    const c = parId[rp.cuissonId];
    const r = base.parId[rp.recetteId];
    rangs[c.id] = (rangs[c.id] ?? 0) + 1;
    return {
      creneau: rp.creneau,
      jour: jourDe(rp.creneau),
      moment: momentDe(rp.creneau),
      recette: r,
      cuisson: c,
      statut: statutRepas(r, c, rp.creneau),
      part: rangs[c.id],
      parts: c.parts,
      joursDepuisCuisson: jourDe(rp.creneau) - c.jour,
    };
  });
}

export type CodeRegle =
  | 'creneaux' | 'parts' | 'securite' | 'moment' | 'consecutif' | 'max-semaine' | 'kcal-repas' | 'kcal-jour'
  | 'prot-repas' | 'prot-jour' | 'budget' | 'familles' | 'batch-nombre' | 'express-nombre' | 'soirs-cuisine'
  | 'session' | 'equipement' | 'exclu' | 'historique' | 'saison';

export type Violation = { code: CodeRegle; message: string; creneaux?: number[] };

/**
 * Règles qui peuvent être assouplies (et signalées dans `menu.relachements`) :
 * saison et historique quand la base ne suffit pas, budget quand le placard est vide
 * (paquets entiers à acheter la première semaine).
 */
export const REGLES_SOUPLES: CodeRegle[] = ['historique', 'saison', 'budget'];

export const sessionDimanche = (menu: Menu, base: Base): Timeline =>
  planifierSession(menu.cuissons.filter((c) => c.jour < 0 && !c.stock).map((c) => base.parId[c.recetteId]));

export const coutsMenu = (menu: Menu, ctx: ContexteMenu) =>
  listeCourses(menu.cuissons, {
    base: ctx.base,
    stock: ctx.stock,
    placardDeBase: ctx.reglages.placardDeBase,
    personnes: ctx.reglages.personnes,
    prixCorriges: ctx.prixCorriges,
  });

/** Toutes les règles non respectées par un menu. */
export function verifierMenu(menu: Menu, ctx: ContexteMenu, mois?: number): Violation[] {
  const { base, reglages: g } = ctx;
  const v: Violation[] = [];
  const det = detailsRepas(menu, base);

  // Structure : 14 créneaux distincts, chaque cuisson consommée exactement par ses parts
  const vus = new Set(menu.repas.map((r) => r.creneau));
  if (menu.repas.length !== NB_CRENEAUX || vus.size !== NB_CRENEAUX) v.push({ code: 'creneaux', message: 'Le menu doit compter 14 repas distincts.' });
  for (const c of menu.cuissons) {
    const n = menu.repas.filter((r) => r.cuissonId === c.id).length;
    if (n !== c.parts) v.push({ code: 'parts', message: `${base.parId[c.recetteId].nom} : ${c.parts} parts prévues, ${n} repas.` });
  }

  for (const d of det) {
    const r = d.recette;
    if (!r.creneaux.includes(d.moment))
      v.push({ code: 'moment', message: `${r.nom} se mange plutôt le ${r.creneaux.join(' ou ')}.`, creneaux: [d.creneau] });
    if (!d.cuisson.stock) {
      const avant = d.joursDepuisCuisson < 0 || (d.cuisson.creneau !== null && d.creneau < d.cuisson.creneau);
      if (avant) v.push({ code: 'securite', message: `${r.nom} est servi avant d'être cuisiné.`, creneaux: [d.creneau] });
      if (d.statut === 'congele' && !r.conservation.congelable)
        v.push({ code: 'securite', message: `${r.nom} ne se congèle pas et dépasserait J+${frigoJours(r)} au frigo.`, creneaux: [d.creneau] });
    }
    if (r.nutrition_par_part.kcal < g.kcalRepas[0] || r.nutrition_par_part.kcal > g.kcalRepas[1])
      v.push({ code: 'kcal-repas', message: `${r.nom} : ${r.nutrition_par_part.kcal} kcal hors de ${g.kcalRepas.join('–')}.`, creneaux: [d.creneau] });
    if (r.nutrition_par_part.proteines_g < g.protRepasMin)
      v.push({ code: 'prot-repas', message: `${r.nom} : moins de ${g.protRepasMin} g de protéines.`, creneaux: [d.creneau] });
    if (!r.equipement.every((e) => g.equipement.includes(e))) v.push({ code: 'equipement', message: `${r.nom} demande un appareil absent.`, creneaux: [d.creneau] });
    if (r.ingredients.some((i) => !i.optionnel && g.exclus.includes(i.ingredient)))
      v.push({ code: 'exclu', message: `${r.nom} contient un aliment exclu.`, creneaux: [d.creneau] });
    if (mois && !r.saison.includes(mois)) v.push({ code: 'saison', message: `${r.nom} n'est pas de saison.`, creneaux: [d.creneau] });
  }

  for (let i = 0; i + 1 < det.length; i++)
    if (det[i].recette.id === det[i + 1].recette.id)
      v.push({ code: 'consecutif', message: `${det[i].recette.nom} deux repas de suite.`, creneaux: [det[i].creneau, det[i + 1].creneau] });

  const compte: Record<string, number> = {};
  for (const d of det) compte[d.recette.id] = (compte[d.recette.id] ?? 0) + 1;
  for (const [id, n] of Object.entries(compte))
    if (n > g.maxParSemaine) v.push({ code: 'max-semaine', message: `${base.parId[id].nom} servi ${n} fois (max ${g.maxParSemaine}).` });

  for (let j = 0; j < 7; j++) {
    const jour = det.filter((d) => d.jour === j);
    const kcal = jour.reduce((s, d) => s + d.recette.nutrition_par_part.kcal, 0);
    const prot = jour.reduce((s, d) => s + d.recette.nutrition_par_part.proteines_g, 0);
    if (kcal < g.kcalJour[0] || kcal > g.kcalJour[1])
      v.push({ code: 'kcal-jour', message: `Jour ${j + 1} : ${kcal} kcal hors de ${g.kcalJour.join('–')}.`, creneaux: jour.map((d) => d.creneau) });
    if (prot < g.protJourMin)
      v.push({ code: 'prot-jour', message: `Jour ${j + 1} : ${Math.round(prot)} g de protéines (min ${g.protJourMin}).`, creneaux: jour.map((d) => d.creneau) });
  }

  const familles = new Set(det.map((d) => FAMILLE_PROTEINE[d.recette.proteine_principale]));
  if (familles.size < g.famillesProteinesMin)
    v.push({ code: 'familles', message: `${familles.size} familles de protéines (min ${g.famillesProteinesMin}).` });

  const batchs = menu.cuissons.filter((c) => !c.stock && estBatch(base.parId[c.recetteId]));
  if (batchs.length < 2 || batchs.length > 3) v.push({ code: 'batch-nombre', message: `${batchs.length} plats en batch (2 à 3 attendus).` });
  const express = det.filter((d) => d.statut === 'express' || d.statut === 'assemblage').length;
  if (express < 2 || express > 4) v.push({ code: 'express-nombre', message: `${express} repas express ou assemblage (2 à 4 attendus).` });
  const soirs = new Set(batchs.filter((c) => c.jour >= 0).map((c) => c.jour)).size;
  if (soirs > g.soirsCuisineMax) v.push({ code: 'soirs-cuisine', message: `${soirs} soirs de cuisine en semaine (max ${g.soirsCuisineMax}).` });

  const session = sessionDimanche(menu, base);
  if (session.duree > g.sessionBatchMax_min)
    v.push({ code: 'session', message: `Session du dimanche de ${session.duree} min (max ${g.sessionBatchMax_min}).` });

  const cout = coutsMenu(menu, ctx).totalCaisse;
  if (cout > g.budget[1]) v.push({ code: 'budget', message: `${cout.toFixed(2).replace('.', ',')} € en caisse (max ${g.budget[1]} €).` });

  const recentes = new Set((ctx.historique ?? []).slice(0, g.historiqueSemaines).flat());
  const favoris = new Set(g.favorisInclus ? ctx.favoris ?? [] : []);
  for (const id of Object.keys(compte))
    if (recentes.has(id) && !favoris.has(id))
      v.push({ code: 'historique', message: `${base.parId[id].nom} déjà servi ces ${g.historiqueSemaines} dernières semaines.` });

  return v;
}

export const violationsDures = (v: Violation[]) => v.filter((x) => !REGLES_SOUPLES.includes(x.code));
