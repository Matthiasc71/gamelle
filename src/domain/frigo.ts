/**
 * Frigo : inventaire vivant (frigo, congélateur, placard) tenu par une suite d'événements.
 *
 * - article coché dans les courses → achat (quantité du paquet) ;
 * - recette cuisinée → ingrédients déduits, boîtes ajoutées (frigo jusqu'à J+3, sinon congélateur) ;
 * - repas mangé → boîte retirée ;
 * - corrections à la main (±, supprimer).
 * Les quantités sont dans l'unité du conditionnement de la grille de prix (g, ml ou pièces).
 */
import { besoins } from './courses';
import { ajouterJours, ecartJours } from './dates';
import { detailsRepas, frigoJours } from './regles';
import type { Base, Cuisson, Menu, Stock } from './types';

export type Lieu = 'frigo' | 'congelateur' | 'placard';

export type Article = { ingredient: string; quantite: number; lieu: Lieu; ajoute_le: string; peremption: string };
export type Boite = { id: string; recetteId: string; cuissonId: string; lieu: 'frigo' | 'congelateur'; cuisine_le: string; limite: string };
export type EtatFrigo = { articles: Article[]; boites: Boite[] };

export const FRIGO_VIDE: EtatFrigo = { articles: [], boites: [] };

/** Durée de conservation d'un plat cuisiné congelé. */
export const CONGELATEUR_JOURS = 90;

export type Evenement =
  | { type: 'achat'; ingredient: string; quantite: number; date: string }
  | {
      type: 'cuisine';
      cuissonId: string;
      recetteId: string;
      date: string;
      /** Ingrédients consommés (unité du conditionnement). */
      consommation: Record<string, number>;
      boites: { lieu: 'frigo' | 'congelateur'; nombre: number }[];
    }
  | { type: 'mange'; boiteId: string }
  | { type: 'correction'; ingredient: string; lieu: Lieu; delta: number; date: string }
  | { type: 'supprimer'; ingredient: string; lieu: Lieu }
  | { type: 'deplacer-boite'; boiteId: string; lieu: 'frigo' | 'congelateur'; date: string };

const EPS = 1e-6;

function ajouterArticle(articles: Article[], base: Base, ingredient: string, quantite: number, date: string, lieu?: Lieu): Article[] {
  const cat = base.catalogue[ingredient];
  const l: Lieu = lieu ?? cat?.rangement ?? 'placard';
  const jours = l === 'congelateur' ? Math.max(cat?.conservation_jours ?? 0, CONGELATEUR_JOURS) : cat?.conservation_jours ?? 30;
  return [...articles, { ingredient, quantite, lieu: l, ajoute_le: date, peremption: ajouterJours(date, jours) }];
}

/** Retire une quantité d'un ingrédient, en commençant par ce qui périme le plus tôt. */
function retirer(articles: Article[], ingredient: string, quantite: number, lieu?: Lieu): Article[] {
  let reste = quantite;
  const ordre = [...articles].sort((a, b) => a.peremption.localeCompare(b.peremption));
  const out = new Map<Article, number>();
  for (const a of ordre) {
    if (a.ingredient !== ingredient || (lieu && a.lieu !== lieu) || reste <= EPS) continue;
    const pris = Math.min(a.quantite, reste);
    out.set(a, a.quantite - pris);
    reste -= pris;
  }
  return articles.map((a) => (out.has(a) ? { ...a, quantite: out.get(a)! } : a)).filter((a) => a.quantite > EPS);
}

export function appliquer(etat: EtatFrigo, ev: Evenement, base: Base): EtatFrigo {
  switch (ev.type) {
    case 'achat':
      return { ...etat, articles: ajouterArticle(etat.articles, base, ev.ingredient, ev.quantite, ev.date) };
    case 'cuisine': {
      let articles = etat.articles;
      for (const [ing, q] of Object.entries(ev.consommation)) articles = retirer(articles, ing, q);
      const boites = [...etat.boites];
      let k = 0;
      for (const { lieu, nombre } of ev.boites)
        for (let i = 0; i < nombre; i++)
          boites.push({
            id: `${ev.cuissonId}#${++k}`,
            recetteId: ev.recetteId,
            cuissonId: ev.cuissonId,
            lieu,
            cuisine_le: ev.date,
            limite: ajouterJours(ev.date, lieu === 'frigo' ? frigoJours(base.parId[ev.recetteId]) : CONGELATEUR_JOURS),
          });
      return { articles, boites };
    }
    case 'mange':
      return { ...etat, boites: etat.boites.filter((b) => b.id !== ev.boiteId) };
    case 'correction':
      return ev.delta >= 0
        ? { ...etat, articles: ajouterArticle(etat.articles, base, ev.ingredient, ev.delta, ev.date, ev.lieu) }
        : { ...etat, articles: retirer(etat.articles, ev.ingredient, -ev.delta, ev.lieu) };
    case 'supprimer':
      return { ...etat, articles: etat.articles.filter((a) => !(a.ingredient === ev.ingredient && a.lieu === ev.lieu)) };
    case 'deplacer-boite':
      return {
        ...etat,
        boites: etat.boites.map((b) =>
          b.id === ev.boiteId
            ? { ...b, lieu: ev.lieu, limite: ev.lieu === 'congelateur' ? ajouterJours(ev.date, CONGELATEUR_JOURS) : b.limite }
            : b,
        ),
      };
  }
}

export const rejouer = (evenements: Evenement[], base: Base, depart = FRIGO_VIDE) =>
  evenements.reduce((e, ev) => appliquer(e, ev, base), depart);

/** Stock utilisable à une date (articles non périmés), par ingrédient. */
export function stockDisponible(etat: EtatFrigo, date: string): Stock {
  const s: Stock = {};
  for (const a of etat.articles) if (a.peremption >= date) s[a.ingredient] = (s[a.ingredient] ?? 0) + a.quantite;
  return s;
}

/** Articles et boîtes qui arrivent à leur date limite d'ici `jours` jours. */
export function aUtiliserVite(etat: EtatFrigo, date: string, jours = 2) {
  return {
    articles: etat.articles.filter((a) => a.lieu !== 'placard' && ecartJours(date, a.peremption) <= jours),
    boites: etat.boites.filter((b) => b.lieu === 'frigo' && ecartJours(date, b.limite) <= jours),
  };
}

/**
 * Passage à la semaine suivante : on jette ce qui est périmé et on congèle les restes de viande
 * ou de poisson crus qui ne tiendraient pas jusqu'à la semaine suivante.
 */
export function finDeSemaine(etat: EtatFrigo, date: string, base: Base): EtatFrigo {
  const articles: Article[] = [];
  for (const a of etat.articles) {
    if (a.peremption < date) continue;
    const cat = base.catalogue[a.ingredient];
    if (a.lieu === 'frigo' && cat?.rayon === 'viandes-poissons' && ecartJours(date, a.peremption) < 7)
      articles.push({ ...a, lieu: 'congelateur', peremption: ajouterJours(date, CONGELATEUR_JOURS) });
    else articles.push(a);
  }
  return { articles, boites: etat.boites.filter((b) => b.limite >= date) };
}

// ───────────────────── Liens avec le menu et la liste de courses ─────────────────────

/** Événement « cuisiné » d'une cuisson du menu : consommation et boîtes (frigo ou congélateur). */
export function evenementCuisson(menu: Menu, cuisson: Cuisson, base: Base, date: string, personnes = 1, placard: string[] = []): Evenement {
  const conso = besoins([cuisson], base, personnes);
  for (const id of placard) delete conso[id];
  const det = detailsRepas(menu, base).filter((d) => d.cuisson.id === cuisson.id && d.statut !== 'cuisine' && d.statut !== 'express' && d.statut !== 'assemblage');
  const frigo = det.filter((d) => d.statut === 'boite').length;
  const congel = det.filter((d) => d.statut === 'congele').length;
  return {
    type: 'cuisine',
    cuissonId: cuisson.id,
    recetteId: cuisson.recetteId,
    date,
    consommation: conso,
    boites: (
      [
        { lieu: 'frigo', nombre: frigo },
        { lieu: 'congelateur', nombre: congel },
      ] as const
    ).filter((b) => b.nombre > 0),
  };
}

export type EtatCourses = {
  /** Ingrédient → besoin, réservé (déjà au frigo), à racheter. */
  lignes: { ingredient: string; besoin: number; reserve: number; aRacheter: number }[];
  /** Stock présent mais plus prévu dans le menu (acheté pour un plat retiré) : à utiliser. */
  aUtiliser: Article[];
};

/**
 * État des courses après un échange quand les courses sont déjà faites : ce qui est au frigo
 * est réservé pour le menu, seuls les manquants vont dans la mini-liste « à racheter », et les
 * restes qui ne servent plus sont signalés « à utiliser ».
 */
export function etatCourses(menu: Menu, etat: EtatFrigo, base: Base, date: string, personnes = 1, placard: string[] = []): EtatCourses {
  const a_faire = menu.cuissons.filter((c) => !c.stock);
  const b = besoins(a_faire, base, personnes);
  for (const id of placard) delete b[id];
  const stock = stockDisponible(etat, date);
  const lignes = Object.entries(b).map(([ingredient, besoin]) => {
    const reserve = Math.min(besoin, stock[ingredient] ?? 0);
    return { ingredient, besoin, reserve, aRacheter: Math.max(0, besoin - reserve) };
  });
  const aUtiliser = etat.articles.filter((a) => a.lieu !== 'placard' && a.peremption >= date && !(a.ingredient in b));
  return { lignes, aUtiliser };
}

// ───────────────────── Idées pour finir les restes ─────────────────────

export type IdeeRestes = { recetteId: string; utilise: string[]; part: number };

/**
 * Recettes qui finissent le mieux ce qu'il reste (frigo, congélateur, paquets entamés ; hors placard de base) :
 * nombre d'ingrédients en stock utilisés, puis part du besoin couverte, puis rapidité.
 */
export function ideesRestes(etat: EtatFrigo, base: Base, date: string, placard: string[] = [], n = 3): IdeeRestes[] {
  const stock: Stock = {};
  for (const a of etat.articles)
    if (a.peremption >= date && !placard.includes(a.ingredient)) stock[a.ingredient] = (stock[a.ingredient] ?? 0) + a.quantite;
  if (!Object.keys(stock).length) return [];
  const idees = base.recettes.map((r) => {
    const ings = r.ingredients.filter((i) => !i.optionnel && !placard.includes(i.ingredient));
    const utilises = ings.filter((i) => (stock[i.ingredient] ?? 0) > 0);
    const part = ings.length ? utilises.length / ings.length : 0;
    return { recetteId: r.id, utilise: [...new Set(utilises.map((i) => i.ingredient))], part, vitesse: r.temps.total_min };
  });
  return idees
    .filter((x) => x.utilise.length > 0)
    .sort((a, b) => b.utilise.length - a.utilise.length || b.part - a.part || a.vitesse - b.vitesse)
    .slice(0, n)
    .map(({ vitesse: _v, ...x }) => x);
}
