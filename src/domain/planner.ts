/**
 * Générateur de menu hebdomadaire, local et déterministe (graine = semaine ISO + réglages).
 *
 * Structure : 2 plats batch cuisinés à la session du dimanche + 1 plat batch un soir de semaine,
 * 3 ou 4 parts chacun (10 à 12 repas), complétés par 2 à 4 repas express ou assemblage.
 *
 * Pour chaque essai : tirage pondéré des recettes (prix, stock, favoris), puis placement sur les
 * 14 créneaux par échanges successifs (calories par jour, protéines, sécurité frigo/congélateur,
 * pas deux fois de suite). On garde le meilleur menu qui respecte toutes les règles.
 * Si la base ne suffit pas, on assouplit d'abord la saison puis l'historique, et on le dit.
 */
import { ajouterJours, lundiDeSemaine, moisDeSemaine } from './dates';
import { empreinte, hasard, type Hasard } from './rng';
import { coutsMenu, estBatch, frigoJours, sessionDimanche, verifierMenu, violationsDures, type ContexteMenu, type Violation } from './regles';
import type { Recette } from './schema';
import { jourDe, momentDe, NB_CRENEAUX, type Cuisson, type Menu, type Repas } from './types';

export type ParamsGeneration = ContexteMenu & { semaine: string; essais?: number };

type Niveau = { saison: boolean; historique: number; libelle?: string };

const NIVEAUX = (h: number): Niveau[] => [
  { saison: true, historique: h },
  { saison: false, historique: h, libelle: 'Des recettes hors saison ont été ajoutées : pas assez de recettes de saison.' },
  { saison: false, historique: 1, libelle: 'Des recettes servies il y a 2 ou 3 semaines reviennent : la base est encore petite.' },
  { saison: false, historique: 0, libelle: 'Des recettes de la semaine dernière reviennent : la base est encore petite.' },
];

/** Unité à placer : une part de cuisson. */
type Unite = { cuisson: Cuisson; recette: Recette };

function penaliteArrangement(slots: Unite[], ctx: ContexteMenu): number {
  const g = ctx.reglages;
  let p = 0;
  for (let i = 0; i < NB_CRENEAUX; i++) {
    const { cuisson: c, recette: r } = slots[i];
    if (!r.creneaux.includes(momentDe(i))) p += 1000;
    // express et assemblages (creneau -1 tant qu'ils ne sont pas placés) : cuisinés au créneau même
    if (c.creneau !== i && c.creneau !== -1) {
      const ecart = jourDe(i) - c.jour;
      if (ecart < 0 || (c.creneau !== null && i < c.creneau)) p += 1000;
      else if (ecart > frigoJours(r)) p += r.conservation.congelable ? 3 : 1000;
    }
    if (i + 1 < NB_CRENEAUX && slots[i + 1].recette.id === r.id) p += 1000;
  }
  for (let j = 0; j < 7; j++) {
    const a = slots[2 * j].recette.nutrition_par_part;
    const b = slots[2 * j + 1].recette.nutrition_par_part;
    const kcal = a.kcal + b.kcal;
    if (kcal < g.kcalJour[0]) p += 200 + 2 * (g.kcalJour[0] - kcal);
    if (kcal > g.kcalJour[1]) p += 200 + 2 * (kcal - g.kcalJour[1]);
    const prot = a.proteines_g + b.proteines_g;
    if (prot < g.protJourMin) p += 200 + 5 * (g.protJourMin - prot);
  }
  return p;
}

/** Place les unités sur les créneaux par améliorations successives (échanges de deux créneaux). */
function placer(unites: Unite[], fixes: Map<number, Unite>, rng: Hasard, ctx: ContexteMenu): { slots: Unite[]; penalite: number } {
  const libres = rng.melanger(unites);
  const slots: Unite[] = [];
  for (let i = 0; i < NB_CRENEAUX; i++) slots.push(fixes.get(i) ?? libres.pop()!);
  const mobiles = [...Array(NB_CRENEAUX).keys()].filter((i) => !fixes.has(i));
  let pen = penaliteArrangement(slots, ctx);
  for (let passe = 0; passe < 8 && pen > 0; passe++) {
    let ameliore = false;
    for (let a = 0; a < mobiles.length; a++)
      for (let b = a + 1; b < mobiles.length; b++) {
        const i = mobiles[a];
        const j = mobiles[b];
        if (slots[i].cuisson === slots[j].cuisson) continue;
        [slots[i], slots[j]] = [slots[j], slots[i]];
        const np = penaliteArrangement(slots, ctx);
        if (np < pen) {
          pen = np;
          ameliore = true;
        } else [slots[i], slots[j]] = [slots[j], slots[i]];
      }
    if (!ameliore) break;
  }
  return { slots, penalite: pen };
}

/** Poids de tirage d'une recette : moins chère, utilise le stock, favori → plus probable. */
function poids(r: Recette, ctx: ContexteMenu): number {
  const stock = ctx.stock ?? {};
  const utiliseStock = r.ingredients.filter((i) => !i.optionnel && (stock[i.ingredient] ?? 0) > 0).length;
  const favori = ctx.reglages.favorisInclus && ctx.favoris?.includes(r.id) ? 3 : 1;
  return (favori * (1 + 0.5 * utiliseStock)) / (0.5 + r.cout_par_part_eur) ** 2;
}

function tirerDistinctes(pool: Recette[], n: number, rng: Hasard, ctx: ContexteMenu, interdites = new Set<string>()): Recette[] | null {
  const dispo = pool.filter((r) => !interdites.has(r.id));
  if (dispo.length < n) return null;
  const choisies: Recette[] = [];
  const reste = [...dispo];
  for (let k = 0; k < n; k++) {
    const r = rng.choisir(reste, reste.map((x) => poids(x, ctx)));
    choisies.push(r);
    reste.splice(reste.indexOf(r), 1);
  }
  return choisies;
}

function construireMenu(semaine: string, lundi: string, slots: Unite[], cuissons: Cuisson[], graine: number, relachements: string[]): Menu {
  const repas: Repas[] = slots.map((u, creneau) => ({ creneau, recetteId: u.recette.id, cuissonId: u.cuisson.id }));
  // les express sont cuisinés au créneau où ils sont servis
  for (const r of repas) {
    const c = cuissons.find((x) => x.id === r.cuissonId)!;
    if (c.creneau === -1) {
      c.creneau = r.creneau;
      c.jour = jourDe(r.creneau);
    }
  }
  const ordre = (c: Cuisson) => (c.jour < 0 ? -100 : 0) + (c.creneau ?? 0);
  return { semaine, lundi, cuissons: [...cuissons].sort((a, b) => ordre(a) - ordre(b)), repas, relachements, graine };
}

/** Durée de session par paire de recettes (le calcul de timeline revient souvent). */
const memoSession = new Map<string, number>();

type Resultat = { menu: Menu; score: number; dures: Violation[]; cout: number };

function essai(p: ParamsGeneration, rng: Hasard, lundi: string, graine: number, niveau: Niveau, pools: { batch: Recette[]; rapides: Recette[] }): Resultat | null {
  const g = p.reglages;
  const nbRapides = rng.entier(2, 4);
  const parts = [4, 4, 4];
  // 2 rapides → 12 parts de batch, 3 → 11, 4 → 10 : autant de plats passent à 3 parts
  for (const k of rng.melanger([0, 1, 2]).slice(0, nbRapides - 2)) parts[k] = 3;
  const batchs = tirerDistinctes(pools.batch, 3, rng, p);
  if (!batchs) return null;
  // le plat du soir de semaine : le plus court à préparer des trois
  batchs.sort((a, b) => b.temps.total_min - a.temps.total_min);
  const jourSemaine = rng.choisir([1, 2, 2, 3]);
  const cuissons: Cuisson[] = batchs.map((r, k) => ({
    id: `${r.id}@${k < 2 ? 'dim' : `j${jourSemaine}`}`,
    recetteId: r.id,
    jour: k < 2 ? -1 : jourSemaine,
    creneau: k < 2 ? null : jourSemaine * 2 + 1,
    parts: parts[k],
  }));
  const rapides = tirerDistinctes(pools.rapides, nbRapides, rng, p, new Set(batchs.map((b) => b.id)));
  if (!rapides) return null;
  rapides.forEach((r, k) => cuissons.push({ id: `${r.id}@x${k}`, recetteId: r.id, jour: -1, creneau: -1, parts: 1 }));

  // budget et durée de session ne dépendent pas du placement : on filtre tôt
  const brouillon: Menu = { semaine: p.semaine, lundi, cuissons, repas: [], relachements: [], graine };
  const cout = coutsMenu(brouillon, p).totalCaisse;
  const cleSession = cuissons.filter((c) => c.jour < 0 && c.creneau === null).map((c) => c.recetteId).sort().join('+');
  let session = memoSession.get(cleSession);
  if (session === undefined) memoSession.set(cleSession, (session = sessionDimanche(brouillon, p.base).duree));
  if (session > g.sessionBatchMax_min) return null;

  const unites: Unite[] = [];
  const fixes = new Map<number, Unite>();
  for (const c of cuissons) {
    const r = p.base.parId[c.recetteId];
    for (let k = 0; k < c.parts; k++) {
      const u = { cuisson: c, recette: r };
      if (k === 0 && c.creneau !== null && c.creneau >= 0) fixes.set(c.creneau, u);
      else unites.push(u);
    }
  }
  const { slots, penalite } = placer(unites, fixes, rng, p);
  const menu = construireMenu(p.semaine, lundi, slots, cuissons, graine, []);
  const dures = violationsDures(verifierMenu(menu, { ...p, historique: p.historique?.slice(0, niveau.historique) }));
  const tempsSemaine = batchs[2].temps.total_min;
  const score =
    dures.length * 1_000_000 + penalite + 20 * cout + 50 * Math.max(0, cout - g.budgetCible) + 1000 * Math.max(0, cout - g.budget[1]) +
    2 * Math.max(0, session - 60) + Math.max(0, tempsSemaine - 45);
  return { menu, score, dures, cout };
}

export function genererMenu(p: ParamsGeneration): Menu {
  const g = p.reglages;
  const lundi = lundiDeSemaine(p.semaine);
  const mois = moisDeSemaine(lundi);
  const graine = empreinte(`${p.semaine}|${JSON.stringify(g)}`);
  const rng = hasard(graine);
  const essais = p.essais ?? 160;
  const favoris = new Set(g.favorisInclus ? p.favoris ?? [] : []);
  const compatibles = p.base.recettes.filter(
    (r) =>
      r.equipement.every((e) => g.equipement.includes(e)) &&
      !r.ingredients.some((i) => !i.optionnel && g.exclus.includes(i.ingredient)) &&
      r.nutrition_par_part.kcal >= g.kcalRepas[0] && r.nutrition_par_part.kcal <= g.kcalRepas[1] &&
      r.nutrition_par_part.proteines_g >= g.protRepasMin,
  );

  let meilleur = null as Resultat | null;
  const relachements: string[] = [];
  for (const niveau of NIVEAUX(g.historiqueSemaines)) {
    if (niveau.libelle) relachements.push(niveau.libelle);
    const recentes = new Set((p.historique ?? []).slice(0, niveau.historique).flat());
    const pool = compatibles.filter((r) => (!niveau.saison || r.saison.includes(mois)) && (!recentes.has(r.id) || favoris.has(r.id)));
    const pools = { batch: pool.filter(estBatch), rapides: pool.filter((r) => !estBatch(r)) };
    for (let k = 0; k < essais; k++) {
      const res = essai(p, rng, lundi, graine, niveau, pools);
      if (res && (!meilleur || res.score < meilleur.score)) meilleur = { ...res, menu: { ...res.menu, relachements: [...relachements] } };
    }
    // on s'arrête dès qu'un menu respecte toutes les règles, budget compris
    if (meilleur && meilleur.dures.length === 0 && meilleur.cout <= g.budget[1]) return meilleur.menu;
  }
  if (!meilleur) throw new Error('Aucun menu possible avec ces réglages et cette base de recettes.');
  const notes = [...meilleur.menu.relachements];
  if (meilleur.cout > g.budget[1])
    notes.push(
      `Budget dépassé : ${meilleur.cout.toFixed(2).replace('.', ',')} € en caisse pour ${g.budget[1]} € maximum. ` +
        'Ce sont surtout des paquets entiers (riz, viande, condiments) dont les restes serviront les semaines suivantes.',
    );
  if (meilleur.dures.length) notes.push('Aucun menu ne respecte toutes les règles : voici le plus proche.');
  return { ...meilleur.menu, relachements: notes };
}

/** Recettes servies dans un menu (pour l'historique). */
export const recettesDuMenu = (menu: Menu) => [...new Set(menu.repas.map((r) => r.recetteId))];

/** Date (AAAA-MM-JJ) d'un créneau. */
export const dateCreneau = (menu: Menu, creneau: number) => ajouterJours(menu.lundi, jourDe(creneau));

