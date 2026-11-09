/**
 * Simulation de plusieurs semaines d'affilée : génération du menu, courses, cuisine,
 * stock et historique reportés d'une semaine sur l'autre. Sert aux tests de propriétés
 * et au rapport reports/simulation.md.
 */
import { ajouterJours, lundiDeSemaine, moisDeSemaine, semaineSuivante } from '../../src/domain/dates';
import { appliquer, evenementCuisson, finDeSemaine, FRIGO_VIDE, stockDisponible, type EtatFrigo } from '../../src/domain/frigo';
import { genererMenu, recettesDuMenu } from '../../src/domain/planner';
import { coutsMenu, sessionDimanche, verifierMenu, type Violation } from '../../src/domain/regles';
import type { Base, Menu, Reglages } from '../../src/domain/types';

export type SemaineSimulee = {
  menu: Menu;
  violations: Violation[];
  caisse: number;
  mange: number;
  session: number;
};

export function simuler(base: Base, reglages: Reglages, depart: string, nombre: number, essais?: number): SemaineSimulee[] {
  let etat: EtatFrigo = FRIGO_VIDE;
  const historique: string[][] = [];
  const out: SemaineSimulee[] = [];
  let semaine = depart;
  for (let w = 0; w < nombre; w++) {
    const lundi = lundiDeSemaine(semaine);
    const samedi = ajouterJours(lundi, -2);
    const ctx = { base, reglages, historique: [...historique], stock: stockDisponible(etat, samedi) };
    const menu = genererMenu({ ...ctx, semaine, essais });
    const liste = coutsMenu(menu, ctx);
    for (const l of liste.lignes)
      if (l.paquets > 0)
        etat = appliquer(etat, { type: 'achat', ingredient: l.ingredient, quantite: l.paquets * base.prix[l.ingredient].conditionnement.quantite, date: samedi }, base);
    for (const c of menu.cuissons)
      etat = appliquer(etat, evenementCuisson(menu, c, base, ajouterJours(lundi, c.jour), reglages.personnes, reglages.placardDeBase), base);
    // toutes les boîtes de la semaine sont mangées
    etat = finDeSemaine({ ...etat, boites: [] }, ajouterJours(lundi, 5), base);
    out.push({
      menu,
      violations: verifierMenu(menu, ctx, moisDeSemaine(lundi)),
      caisse: liste.totalCaisse,
      mange: liste.totalUtilise,
      session: sessionDimanche(menu, base).duree,
    });
    historique.unshift(recettesDuMenu(menu));
    semaine = semaineSuivante(semaine);
  }
  return out;
}
