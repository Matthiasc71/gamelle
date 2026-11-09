/**
 * Échanger un repas de la semaine avec un favori.
 *
 * - Favori express ou assemblage : un créneau, classé par compatibilité (calories, budget, règles).
 * - Favori batch : on choisit le jour de cuisson (session du dimanche ou un soir de semaine) et
 *   l'app remplit ses parts : d'abord les créneaux tenables au frigo (J+3 max), puis le congélateur
 *   si la recette se congèle, sans deux repas identiques de suite.
 * L'app montre les plats retirés et les règles cassées (avertissements), mais laisse valider.
 */
import { moisDeSemaine } from './dates';
import { coutsMenu, estBatch, frigoJours, verifierMenu, type ContexteMenu, type Violation } from './regles';
import { ajouterCuisson, idCuisson, nouvellesViolations, remplacerRepas, retirerRepas } from './remplacement';
import { jourDe, momentDe, NB_CRENEAUX, type Cuisson, type Menu, type Repas } from './types';

export type PlanEchange = {
  recetteId: string;
  /** Jour de cuisson (-1 = session du dimanche) et créneaux servis. */
  jourCuisson: number;
  creneaux: number[];
  retires: Repas[];
  menu: Menu;
  avertissements: Violation[];
  deltaCout: number;
  /** Indicateurs de compatibilité pour l'affichage. */
  compat: { kcal: boolean; budget: boolean; conservation: boolean };
};

function evaluer(avant: Menu, apres: Menu, recetteId: string, jourCuisson: number, creneaux: number[], retires: Repas[], ctx: ContexteMenu): PlanEchange {
  const mois = moisDeSemaine(avant.lundi);
  const avert = nouvellesViolations(verifierMenu(avant, ctx, mois), verifierMenu(apres, ctx, mois));
  const deltaCout = Math.round((coutsMenu(apres, ctx).totalCaisse - coutsMenu(avant, ctx).totalCaisse) * 100) / 100;
  return {
    recetteId, jourCuisson, creneaux, retires, menu: apres, avertissements: avert, deltaCout,
    compat: {
      kcal: !avert.some((v) => v.code === 'kcal-jour' || v.code === 'prot-jour' || v.code === 'kcal-repas'),
      budget: !avert.some((v) => v.code === 'budget'),
      conservation: !avert.some((v) => v.code === 'securite'),
    },
  };
}

/** Plan manuel : le favori remplace les repas de ces créneaux, cuisiné le jour `jourCuisson`. */
export function planEchange(menu: Menu, recetteId: string, creneaux: number[], ctx: ContexteMenu, jourCuisson?: number): PlanEchange {
  const r = ctx.base.parId[recetteId];
  const tri = [...creneaux].sort((a, b) => a - b);
  if (!estBatch(r) || tri.length === 1 && jourCuisson === undefined) {
    // express / assemblage : chaque créneau est cuisiné sur place
    let m = menu;
    const retires: Repas[] = [];
    for (const c of tri) {
      retires.push(menu.repas.find((x) => x.creneau === c)!);
      m = remplacerRepas(m, c, recetteId);
    }
    return evaluer(menu, m, recetteId, jourDe(tri[0]), tri, retires, ctx);
  }
  const jour = jourCuisson ?? -1;
  const { menu: sans, retires } = retirerRepas(menu, tri);
  const cuisson: Cuisson = {
    id: idCuisson(sans, `${recetteId}@${jour < 0 ? 'dim' : `j${jour}`}`),
    recetteId,
    jour,
    creneau: jour < 0 ? null : jour * 2 + 1,
    parts: tri.length,
  };
  return evaluer(menu, ajouterCuisson(sans, cuisson, tri), recetteId, jour, tri, retires, ctx);
}

/** Créneaux proposés automatiquement pour un batch cuisiné le jour `jour`. */
export function creneauxBatch(menu: Menu, recetteId: string, jour: number, ctx: ContexteMenu, parts?: number): number[] {
  const r = ctx.base.parId[recetteId];
  const n = parts ?? Math.min(r.portions_base, ctx.reglages.maxParSemaine);
  const debut = jour < 0 ? 0 : jour * 2 + 1;
  const possibles: number[] = [];
  for (let c = debut; c < NB_CRENEAUX; c++) {
    if (!r.creneaux.includes(momentDe(c))) continue;
    const ecart = jourDe(c) - jour;
    if (ecart > frigoJours(r) && !r.conservation.congelable) continue;
    possibles.push(c);
  }
  // le soir de cuisson d'abord, puis le frigo (dans l'ordre), puis le congélateur ;
  // on préfère remplacer des repas express plutôt que les parts d'un autre batch
  const estExpress = (c: number) => {
    const rp = menu.repas.find((x) => x.creneau === c);
    return rp ? !estBatch(ctx.base.parId[rp.recetteId]) : true;
  };
  const rang = (c: number) =>
    (c === debut && jour >= 0 ? -1000 : 0) + (jourDe(c) - jour <= frigoJours(r) ? 0 : 100) + (estExpress(c) ? 0 : 20) + c;
  const choisis: number[] = [];
  for (const c of [...possibles].sort((a, b) => rang(a) - rang(b))) {
    if (choisis.length >= n) break;
    if (choisis.some((x) => Math.abs(x - c) === 1)) continue; // jamais deux fois de suite
    choisis.push(c);
  }
  return choisis.sort((a, b) => a - b);
}

/** Meilleurs plans pour mettre un favori dans la semaine, du plus compatible au moins compatible. */
export function proposerCreneaux(menu: Menu, recetteId: string, ctx: ContexteMenu, n = 5): PlanEchange[] {
  const r = ctx.base.parId[recetteId];
  const plans: PlanEchange[] = [];
  if (estBatch(r)) {
    for (const jour of [-1, 0, 1, 2, 3, 4]) {
      const creneaux = creneauxBatch(menu, recetteId, jour, ctx);
      if (creneaux.length) plans.push(planEchange(menu, recetteId, creneaux, ctx, jour));
    }
  } else {
    for (let c = 0; c < NB_CRENEAUX; c++)
      if (r.creneaux.includes(momentDe(c)) && menu.repas.find((x) => x.creneau === c)?.recetteId !== recetteId)
        plans.push(planEchange(menu, recetteId, [c], ctx));
  }
  const kcal = r.nutrition_par_part.kcal;
  const ecartKcal = (p: PlanEchange) =>
    p.retires.reduce((s, x) => s + Math.abs(ctx.base.parId[x.recetteId].nutrition_par_part.kcal - kcal), 0) / p.retires.length;
  return plans
    .sort((a, b) => a.avertissements.length - b.avertissements.length || a.deltaCout - b.deltaCout || ecartKcal(a) - ecartKcal(b))
    .slice(0, n);
}

/** Entrée de l'historique des échanges de la semaine. */
export type EntreeEchange = { date: string; recetteId: string; creneaux: number[]; retires: string[] };
export const entreeEchange = (p: PlanEchange, date: string): EntreeEchange => ({
  date, recetteId: p.recetteId, creneaux: p.creneaux, retires: p.retires.map((r) => r.recetteId),
});
