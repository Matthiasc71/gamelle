/**
 * Modifier un menu : retirer des repas, ajouter une cuisson, proposer 3 alternatives à un repas.
 * Toutes les fonctions sont pures : elles renvoient un nouveau menu (l'ancien sert à « Annuler »).
 */
import { moisDeSemaine } from './dates';
import { coutsMenu, estBatch, verifierMenu, type ContexteMenu, type Violation } from './regles';
import type { Recette } from './schema';
import { jourDe, momentDe, type Cuisson, type Menu, type Repas } from './types';

/** Retire les repas de ces créneaux ; les cuissons concernées perdent une part (ou disparaissent). */
export function retirerRepas(menu: Menu, creneaux: number[]): { menu: Menu; retires: Repas[] } {
  const set = new Set(creneaux);
  const retires = menu.repas.filter((r) => set.has(r.creneau));
  const moins: Record<string, number> = {};
  for (const r of retires) moins[r.cuissonId] = (moins[r.cuissonId] ?? 0) + 1;
  const cuissons = menu.cuissons
    .map((c) => (moins[c.id] ? { ...c, parts: c.parts - moins[c.id] } : c))
    .filter((c) => c.parts > 0);
  return { menu: { ...menu, cuissons, repas: menu.repas.filter((r) => !set.has(r.creneau)) }, retires };
}

/** Ajoute une cuisson et ses repas (les créneaux doivent être libres). */
export function ajouterCuisson(menu: Menu, cuisson: Cuisson, creneaux: number[]): Menu {
  const repas = [...menu.repas, ...creneaux.map((creneau) => ({ creneau, recetteId: cuisson.recetteId, cuissonId: cuisson.id }))].sort(
    (a, b) => a.creneau - b.creneau,
  );
  return { ...menu, cuissons: [...menu.cuissons, cuisson], repas };
}

/** Identifiant de cuisson unique dans le menu. */
export function idCuisson(menu: Menu, base: string): string {
  let id = base;
  for (let k = 2; menu.cuissons.some((c) => c.id === id); k++) id = `${base}~${k}`;
  return id;
}

/** Remplace le repas d'un créneau par une recette cuisinée sur place (express ou assemblage). */
export function remplacerRepas(menu: Menu, creneau: number, recetteId: string): Menu {
  const { menu: m } = retirerRepas(menu, [creneau]);
  const c: Cuisson = { id: idCuisson(m, `${recetteId}@c${creneau}`), recetteId, jour: jourDe(creneau), creneau, parts: 1 };
  return ajouterCuisson(m, c, [creneau]);
}

/**
 * Une règle déjà enfreinte avant le changement n'est pas un nouvel avertissement, même si son
 * message change (montant du budget, kcal) : on compare la règle et les créneaux concernés.
 */
const cle = (v: Violation) => (v.creneaux?.length ? `${v.code}|${[...v.creneaux].sort((a, b) => a - b).join(',')}` : v.code);

/** Violations présentes dans `apres` et absentes de `avant`. */
export function nouvellesViolations(avant: Violation[], apres: Violation[]): Violation[] {
  const vus = new Set(avant.map(cle));
  return apres.filter((v) => !vus.has(cle(v)));
}

export type Alternative = {
  recette: Recette;
  menu: Menu;
  /** Différence de coût en caisse pour la semaine (euros). */
  deltaCout: number;
  /** Règles qui ne seraient plus respectées. */
  avertissements: Violation[];
};

/**
 * Trois alternatives à un repas : même type de créneau (midi/soir), calories à ±10 %,
 * rapides à cuisiner (express ou assemblage), qui ne cassent aucune règle si possible.
 */
export function alternatives(menu: Menu, creneau: number, ctx: ContexteMenu, n = 3): Alternative[] {
  const actuel = menu.repas.find((r) => r.creneau === creneau);
  if (!actuel) return [];
  const r0 = ctx.base.parId[actuel.recetteId];
  const kcal0 = r0.nutrition_par_part.kcal;
  const moment = momentDe(creneau);
  const mois = moisDeSemaine(menu.lundi);
  const avant = verifierMenu(menu, ctx, mois);
  const coutAvant = coutsMenu(menu, ctx).totalCaisse;
  const voisins = new Set(menu.repas.filter((r) => Math.abs(r.creneau - creneau) === 1).map((r) => r.recetteId));
  const recentes = new Set((ctx.historique ?? []).slice(0, ctx.reglages.historiqueSemaines).flat());

  const candidats = ctx.base.recettes.filter(
    (r) =>
      !estBatch(r) &&
      r.id !== r0.id &&
      !voisins.has(r.id) &&
      r.creneaux.includes(moment) &&
      Math.abs(r.nutrition_par_part.kcal - kcal0) <= kcal0 * 0.1 &&
      r.equipement.every((e) => ctx.reglages.equipement.includes(e)) &&
      !r.ingredients.some((i) => !i.optionnel && ctx.reglages.exclus.includes(i.ingredient)),
  );
  const notes = candidats.map((r) => {
    const m = remplacerRepas(menu, creneau, r.id);
    const avert = nouvellesViolations(avant, verifierMenu(m, ctx, mois));
    const deltaCout = Math.round((coutsMenu(m, ctx).totalCaisse - coutAvant) * 100) / 100;
    const penalite = avert.length * 100 + (r.saison.includes(mois) ? 0 : 5) + (recentes.has(r.id) ? 5 : 0) + deltaCout;
    return { recette: r, menu: m, deltaCout, avertissements: avert, penalite };
  });
  return notes
    .sort((a, b) => a.penalite - b.penalite || a.recette.nom.localeCompare(b.recette.nom, 'fr'))
    .slice(0, n)
    .map(({ penalite: _p, ...alt }) => alt);
}
