/**
 * État de l'app : hooks de lecture (Dexie, en direct) et actions qui écrivent les données locales.
 * Le moteur (src/domain) reste pur : ce fichier fait le lien entre lui et IndexedDB.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ajouterJours, aujourdhuiLocal, lundiDeSemaine, semaineIso, semaineSuivante, semainesVisibles } from '../domain/dates';
import { evenementCuisson, FRIGO_VIDE, rejouer, stockDisponible, type EtatFrigo, type Evenement } from '../domain/frigo';
import { genererMenu, recettesDuMenu, type ParamsGeneration } from '../domain/planner';
import { coutsMenu, type ContexteMenu } from '../domain/regles';
import { empreinte } from '../domain/rng';
import { REGLAGES_DEFAUT, type Cuisson, type Menu, type Reglages } from '../domain/types';
import { BASE, estPerso } from './base';
import { db, type EvenementStocke, type Origine } from './db';

// ───────────────────────────── Horloge ─────────────────────────────

/** Date du jour (surchargée par ?date=AAAA-MM-JJ pour les démonstrations et les tests). */
export function maintenant(): Date {
  const forcee = new URLSearchParams(location.search).get('date');
  if (forcee && /^\d{4}-\d{2}-\d{2}$/.test(forcee)) {
    const d = new Date(`${forcee}T12:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}
export const aujourdhui = () => aujourdhuiLocal(maintenant());

// ───────────────────────────── Réglages et préférences ─────────────────────────────

export type Theme = 'auto' | 'clair' | 'sombre';
export type Preferences = { grain: boolean; accueilFait: boolean; theme: Theme };
const PREFS_DEFAUT: Preferences = { grain: true, accueilFait: false, theme: 'auto' };

export function useReglages(): Reglages | undefined {
  return useLiveQuery(async () => {
    const r = (await db.kv.get('reglages'))?.valeur as Partial<Reglages> | undefined;
    return { ...REGLAGES_DEFAUT, ...r };
  }, []);
}

export async function enregistrerReglages(r: Partial<Reglages>) {
  const actuels = ((await db.kv.get('reglages'))?.valeur as Partial<Reglages> | undefined) ?? {};
  await db.kv.put({ cle: 'reglages', valeur: { ...actuels, ...r } });
}

export function usePreferences(): Preferences | undefined {
  return useLiveQuery(async () => ({ ...PREFS_DEFAUT, ...((await db.kv.get('preferences'))?.valeur as Partial<Preferences>) }), []);
}

export async function enregistrerPreferences(p: Partial<Preferences>) {
  const actuelles = ((await db.kv.get('preferences'))?.valeur as Partial<Preferences> | undefined) ?? {};
  await db.kv.put({ cle: 'preferences', valeur: { ...actuelles, ...p } });
}

export const cleReglages = (r: Reglages) => String(empreinte(JSON.stringify(r)));

// ───────────────────────────── Favoris et prix ─────────────────────────────

export function useFavoris(): Set<string> | undefined {
  return useLiveQuery(async () => new Set((await db.favoris.toArray()).map((f) => f.id)), []);
}

/** Ajoute ou retire un favori ; renvoie true si la recette est maintenant gardée. */
export async function basculerFavori(id: string): Promise<boolean> {
  if (await db.favoris.get(id)) {
    await db.favoris.delete(id);
    return false;
  }
  await db.favoris.put({ id, ajoute_le: new Date().toISOString() });
  return true;
}

export function useAvis(): Record<string, 'aime' | 'bof'> | undefined {
  return useLiveQuery(async () => Object.fromEntries((await db.avis.toArray()).map((a) => [a.id, a.avis])), []);
}

/** Donne (ou retire, si c'est le même) un avis sur une recette. */
export async function donnerAvis(id: string, avis: 'aime' | 'bof'): Promise<'aime' | 'bof' | null> {
  const avant = await db.avis.get(id);
  if (avant?.avis === avis) {
    await db.avis.delete(id);
    return null;
  }
  await db.avis.put({ id, avis, quand: new Date().toISOString() });
  return avis;
}

/** Tickets de caisse saisis : écart moyen entre ce que l'app estimait et ce qui a été payé. */
export function useTickets() {
  return useLiveQuery(async () => {
    const tous = await db.tickets.toArray();
    const ok = tous.filter((t) => t.estime > 0 && t.paye > 0);
    const ratio = ok.length ? ok.reduce((s, t) => s + t.paye / t.estime, 0) / ok.length : null;
    return { tous, ratio: ratio && ratio > 0.5 && ratio < 1.5 ? ratio : null };
  }, []);
}

export async function enregistrerTicket(semaine: string, paye: number, estime: number) {
  await db.tickets.put({ semaine, paye, estime, quand: new Date().toISOString() });
}

export function usePrixCorriges(): Record<string, number> | undefined {
  return useLiveQuery(async () => Object.fromEntries((await db.prix.toArray()).map((p) => [p.ingredient, p.prix])), []);
}

export async function corrigerPrix(ingredient: string, prix: number | null) {
  if (prix === null || !(prix > 0)) await db.prix.delete(ingredient);
  else await db.prix.put({ ingredient, prix: Math.round(prix * 100) / 100 });
}

// ───────────────────────────── Frigo ─────────────────────────────

export function useEvenements(): EvenementStocke[] | undefined {
  return useLiveQuery(() => db.evenements.orderBy('id').toArray(), []);
}

export const etatFrigo = (evs: EvenementStocke[]): EtatFrigo => rejouer(evs.map((e) => e.ev), BASE, FRIGO_VIDE);

export function useFrigo(): EtatFrigo | undefined {
  const evs = useEvenements();
  return useMemo(() => (evs ? etatFrigo(evs) : undefined), [evs]);
}

/**
 * Stock pris en compte pour les courses de la semaine `semaine` : tout ce qui précède la semaine,
 * plus ce que l'on a déclaré « déjà au frigo » ou corrigé à la main pendant la semaine.
 * Les achats cochés de la semaine n'en font pas partie (sinon la ligne disparaîtrait de la liste).
 */
export function stockPourCourses(evs: EvenementStocke[], semaine: string) {
  const retenus = evs.filter((e) => e.semaine < semaine || (e.semaine === semaine && (e.origine === 'deja' || e.origine === 'manuel')));
  return stockDisponible(etatFrigo(retenus), ajouterJours(lundiDeSemaine(semaine), -2));
}

async function ajouterEvenement(semaine: string, origine: Origine, cle: string, ev: Evenement) {
  await db.evenements.add({ quand: new Date().toISOString(), semaine, origine, cle, ev });
}

async function retirerEvenements(semaine: string, origine: Origine, cle: string) {
  await db.evenements.where({ semaine, origine, cle }).delete();
}

/** Cocher un article : il entre au frigo avec la quantité des paquets achetés. */
export async function cocher(semaine: string, ingredient: string, quantite: number, coche: boolean) {
  await db.transaction('rw', db.coches, db.evenements, async () => {
    const cle = `${semaine}|${ingredient}`;
    await retirerEvenements(semaine, 'courses', ingredient);
    if (!coche) return db.coches.delete(cle);
    await db.coches.put({ cle, semaine, ingredient });
    if (quantite > 0) await ajouterEvenement(semaine, 'courses', ingredient, { type: 'achat', ingredient, quantite, date: aujourdhui() });
  });
}

/** « Déjà au frigo » : la quantité nécessaire est déclarée présente, la ligne ne coûte plus rien. */
export async function declarerDejaAuFrigo(semaine: string, ingredient: string, quantite: number, present: boolean) {
  await db.transaction('rw', db.evenements, async () => {
    await retirerEvenements(semaine, 'deja', ingredient);
    if (present && quantite > 0)
      await ajouterEvenement(semaine, 'deja', ingredient, {
        type: 'correction',
        ingredient,
        lieu: BASE.catalogue[ingredient]?.rangement ?? 'placard',
        delta: quantite,
        date: ajouterJours(lundiDeSemaine(semaine), -2),
      });
  });
}

/** Date réelle d'une cuisson du menu (dimanche précédent pour la session batch). */
export const dateCuisson = (menu: Menu, c: Cuisson) => ajouterJours(menu.lundi, c.jour);

export async function marquerCuisine(menu: Menu, cuisson: Cuisson, reglages: Reglages, fait: boolean) {
  await db.transaction('rw', db.evenements, async () => {
    await retirerEvenements(menu.semaine, 'cuisine', cuisson.id);
    if (fait)
      await ajouterEvenement(
        menu.semaine,
        'cuisine',
        cuisson.id,
        evenementCuisson(menu, cuisson, BASE, dateCuisson(menu, cuisson), reglages.personnes, reglages.placardDeBase),
      );
  });
}

/** Repas mangé : la boîte correspondante (au frigo d'abord) quitte l'inventaire. */
export async function marquerMange(semaine: string, creneau: number, cuissonId: string, fait: boolean) {
  await db.transaction('rw', db.evenements, async () => {
    const cle = String(creneau);
    await retirerEvenements(semaine, 'mange', cle);
    if (!fait) return;
    const etat = etatFrigo(await db.evenements.orderBy('id').toArray());
    const boites = etat.boites.filter((b) => b.cuissonId === cuissonId).sort((a, b) => (a.lieu === b.lieu ? 0 : a.lieu === 'frigo' ? -1 : 1));
    await ajouterEvenement(semaine, 'mange', cle, { type: 'mange', boiteId: boites[0]?.id ?? '' });
  });
}

export async function corrigerFrigo(ev: Evenement) {
  await ajouterEvenement(semaineIso(aujourdhui()).cle, 'manuel', ev.type, ev);
}

// ───────────────────────────── Semaine affichée ─────────────────────────────

export type SemaineVue = { semaine: string; choisir: (s: string) => void };
export const SemaineContexte = createContext<SemaineVue>({ semaine: '', choisir: () => {} });
export const useSemaineVue = () => useContext(SemaineContexte);

export function useSemaines(reglages?: Reglages) {
  const r = reglages ?? REGLAGES_DEFAUT;
  return semainesVisibles(maintenant(), r.jourDeblocage, r.heureDeblocage);
}

// ───────────────────────────── Menus ─────────────────────────────

let worker: Worker | null = null;
let compteur = 0;
const attentes = new Map<number, (r: { menu?: Menu; erreur?: string }) => void>();

function calculer(params: Omit<ParamsGeneration, 'base'>): Promise<Menu> {
  if (typeof Worker === 'undefined') return Promise.resolve(genererMenu({ ...params, base: BASE }));
  if (!worker) {
    worker = new Worker(new URL('./generateur.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; menu?: Menu; erreur?: string }>) => {
      attentes.get(e.data.id)?.(e.data);
      attentes.delete(e.data.id);
    };
  }
  const id = ++compteur;
  return new Promise((ok, ko) => {
    attentes.set(id, (r) => (r.menu ? ok(r.menu) : ko(new Error(r.erreur))));
    worker!.postMessage({ id, params, perso: BASE.recettes.filter((r) => estPerso(r.id)) });
  });
}

/** Recettes servies les semaines précédentes (la plus récente d'abord), d'après les menus gardés. */
async function historiqueAvant(semaine: string, n: number): Promise<string[][]> {
  const out: string[][] = [];
  for (let i = 1; i <= n; i++) {
    const m = await db.menus.get(semaineSuivante(semaine, -i));
    out.push(m ? recettesDuMenu(m.menu) : []);
  }
  return out;
}

/** Contexte complet du moteur pour une semaine (stock, historique, favoris, prix corrigés). */
export async function contexteMenu(semaine: string, reglages: Reglages): Promise<ContexteMenu> {
  const [evs, historique, favoris, prix, avis] = await Promise.all([
    db.evenements.orderBy('id').toArray(),
    historiqueAvant(semaine, reglages.historiqueSemaines),
    db.favoris.toArray(),
    db.prix.toArray(),
    db.avis.toArray(),
  ]);
  return {
    base: BASE,
    reglages,
    historique,
    stock: stockPourCourses(evs, semaine),
    favoris: favoris.map((f) => f.id),
    prixCorriges: Object.fromEntries(prix.map((p) => [p.ingredient, p.prix])),
    avis: Object.fromEntries(avis.map((a) => [a.id, a.avis])),
  };
}

const enCours = new Map<string, Promise<void>>();

export function generer(semaine: string, reglages: Reglages): Promise<void> {
  const cle = `${semaine}|${cleReglages(reglages)}`;
  if (!enCours.has(cle))
    enCours.set(
      cle,
      (async () => {
        const ctx = await contexteMenu(semaine, reglages);
        const { base: _b, ...params } = ctx;
        const menu = await calculer({ ...params, semaine });
        await db.menus.put({ semaine, menu, cle: cleReglages(reglages), modifie: false, genere_le: new Date().toISOString() });
      })().finally(() => enCours.delete(cle)),
    );
  return enCours.get(cle)!;
}

export type EtatMenu =
  | { etat: 'chargement' }
  | { etat: 'generation' }
  | { etat: 'erreur'; message: string }
  | { etat: 'pret'; menu: Menu; modifie: boolean; anciensReglages: boolean };

/** Menu d'une semaine : lu dans IndexedDB, généré (dans un worker) s'il n'existe pas encore. */
export function useMenu(semaine: string, reglages?: Reglages): EtatMenu {
  const stocke = useLiveQuery(async () => (await db.menus.get(semaine)) ?? null, [semaine]);
  const activite = useLiveQuery(async () => (await db.evenements.where('semaine').equals(semaine).count()) + (await db.coches.where('semaine').equals(semaine).count()), [semaine]);
  const [erreur, setErreur] = useState<string | null>(null);
  const cle = reglages ? cleReglages(reglages) : '';
  const aRegenerer = !!reglages && stocke !== undefined && activite !== undefined && (stocke === null || (stocke.cle !== cle && !stocke.modifie && activite === 0));

  useEffect(() => {
    if (aRegenerer && reglages) generer(semaine, reglages).catch((e) => setErreur(String(e)));
  }, [aRegenerer, semaine, reglages]);

  if (erreur) return { etat: 'erreur', message: erreur };
  if (stocke === undefined || !reglages) return { etat: 'chargement' };
  if (stocke === null || aRegenerer) return { etat: 'generation' };
  return { etat: 'pret', menu: stocke.menu, modifie: stocke.modifie, anciensReglages: stocke.cle !== cle };
}

/** Contexte du moteur en direct pour une semaine (pour les calculs d'affichage). */
export function useContexte(semaine: string, reglages?: Reglages): ContexteMenu | undefined {
  const evs = useEvenements();
  const prix = usePrixCorriges();
  const favoris = useFavoris();
  const avis = useAvis();
  const historique = useLiveQuery(async () => (reglages ? historiqueAvant(semaine, reglages.historiqueSemaines) : undefined), [semaine, reglages?.historiqueSemaines]);
  return useMemo(() => {
    if (!reglages || !evs || !prix || !favoris || !historique || !avis) return undefined;
    return { base: BASE, reglages, historique, stock: stockPourCourses(evs, semaine), prixCorriges: prix, favoris: [...favoris], avis };
  }, [reglages, evs, prix, favoris, historique, semaine, avis]);
}

/** Applique un nouveau menu (échange, remplacement) et l'inscrit dans l'historique pour « Annuler ». */
export async function appliquerMenu(avant: Menu, apres: Menu, libelle: string): Promise<number> {
  return db.transaction('rw', db.menus, db.echanges, async () => {
    const m = await db.menus.get(avant.semaine);
    await db.menus.put({ ...(m ?? { cle: '', genere_le: new Date().toISOString() }), semaine: avant.semaine, menu: apres, modifie: true });
    return db.echanges.add({ semaine: avant.semaine, quand: new Date().toISOString(), libelle, avant, apres });
  });
}

export async function annulerEchange(id: number) {
  await db.transaction('rw', db.menus, db.echanges, async () => {
    const e = await db.echanges.get(id);
    if (!e) return;
    const m = await db.menus.get(e.semaine);
    const autres = await db.echanges.where('semaine').equals(e.semaine).count();
    await db.menus.put({ ...m!, menu: e.avant, modifie: autres > 1 });
    await db.echanges.delete(id);
  });
}

/**
 * Refait le menu d'une semaine en visant un budget précis (sans toucher aux réglages des autres semaines).
 * Le menu obtenu est marqué « modifié » et reste annulable.
 */
export async function viserBudget(semaine: string, reglages: Reglages, vise: number): Promise<{ menu: Menu; cout: number; avant: number | null; garde: boolean }> {
  const avant = await db.menus.get(semaine);
  const r: Reglages = { ...reglages, budgetCible: vise, budget: [Math.min(reglages.budget[0], vise), vise] };
  const ctx = await contexteMenu(semaine, r);
  const { base: _b, ...params } = ctx;
  const menu = await calculer({ ...params, semaine, essais: 500 });
  const cout = coutsMenu(menu, ctx).totalCaisse;
  const coutAvant = avant ? coutsMenu(avant.menu, ctx).totalCaisse : null;
  // la recherche est aléatoire : on ne remplace jamais un menu par un plus cher
  if (avant && coutAvant !== null && cout >= coutAvant - 0.01) return { menu: avant.menu, cout: coutAvant, avant: coutAvant, garde: true };
  if (avant) await appliquerMenu(avant.menu, menu, `Menu refait pour viser ${vise} €`);
  else await db.menus.put({ semaine, menu, cle: cleReglages(reglages), modifie: true, genere_le: new Date().toISOString() });
  return { menu, cout, avant: coutAvant, garde: false };
}

/** Régénère un menu de zéro (le menu actuel reste annulable). */
export async function regenerer(semaine: string, reglages: Reglages) {
  const avant = await db.menus.get(semaine);
  await generer(semaine, reglages);
  if (avant?.modifie) {
    const apres = await db.menus.get(semaine);
    await db.echanges.add({ semaine, quand: new Date().toISOString(), libelle: 'Menu régénéré', avant: avant.menu, apres: apres!.menu });
  }
}
