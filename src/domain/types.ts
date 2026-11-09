/** Types du moteur de menu : réglages, menu, cuissons, repas, base de données embarquée. */
import type { Equipement, IngredientCatalogue, PrixReference, Recette } from './schema';

export type Moment = 'midi' | 'soir';
export const NB_CRENEAUX = 14;
/** Créneau 0..13 : jour = créneau >> 1 (0 = lundi), pair = midi, impair = soir. */
export const jourDe = (creneau: number) => creneau >> 1;
export const momentDe = (creneau: number): Moment => (creneau % 2 ? 'soir' : 'midi');
export const creneauDe = (jour: number, moment: Moment) => jour * 2 + (moment === 'soir' ? 1 : 0);

export type Reglages = {
  /** Énergie visée pour déj + dîner, par jour. */
  kcalJour: [number, number];
  kcalRepas: [number, number];
  protRepasMin: number;
  protJourMin: number;
  /** Budget en caisse pour la semaine, et cible (on vise le bas de la fourchette). */
  budget: [number, number];
  budgetCible: number;
  personnes: number;
  equipement: Equipement[];
  /** Ingrédients du catalogue à exclure. */
  exclus: string[];
  favorisInclus: boolean;
  /** Ingrédients toujours au placard (huile, épices…) : ni achetés ni comptés en caisse. */
  placardDeBase: string[];
  jourDeblocage: number;
  heureDeblocage: number;
  soirsCuisineMax: number;
  sessionBatchMax_min: number;
  historiqueSemaines: number;
  maxParSemaine: number;
  famillesProteinesMin: number;
  /** kcal laissées libres pour le petit-déjeuner et les en-cas (affichage). */
  kcalLibres: number;
};

export const REGLAGES_DEFAUT: Reglages = {
  kcalJour: [950, 1150],
  kcalRepas: [380, 650],
  protRepasMin: 20,
  protJourMin: 50,
  budget: [25, 35],
  budgetCible: 30,
  personnes: 1,
  equipement: ['plaques', 'four', 'micro-ondes', 'rice-cooker'],
  exclus: [],
  favorisInclus: false,
  placardDeBase: [
    'huile-olive', 'vinaigre', 'curry', 'cumin', 'paprika', 'curcuma', 'herbes-provence', 'origan',
    'ail-poudre', 'gingembre-poudre', 'bouillon-legumes', 'bouillon-volaille', 'farine', 'sucre-roux',
    'moutarde', 'miel', 'sauce-soja', 'vinaigre-balsamique',
  ],
  jourDeblocage: 6,
  heureDeblocage: 8,
  soirsCuisineMax: 2,
  sessionBatchMax_min: 75,
  historiqueSemaines: 3,
  maxParSemaine: 4,
  famillesProteinesMin: 3,
  kcalLibres: 300,
};

/** Une cuisson : un plat préparé une fois pour une ou plusieurs parts. */
export type Cuisson = {
  id: string;
  recetteId: string;
  /** -1 = session du dimanche précédent ; 0..6 = le jour (lundi = 0) au créneau `creneau`. */
  jour: number;
  /** Créneau où l'on cuisine (soir pour un batch en semaine, créneau du repas pour un express). */
  creneau: number | null;
  /** Parts préparées (une part = un repas pour le foyer). */
  parts: number;
  /** Boîtes déjà au congélateur au début de la semaine (pas de courses, pas de cuisine). */
  stock?: boolean;
};

export type Repas = { creneau: number; recetteId: string; cuissonId: string };

export type Menu = {
  semaine: string;
  lundi: string;
  cuissons: Cuisson[];
  /** 14 repas, triés par créneau. */
  repas: Repas[];
  /** Règles assouplies faute de recettes disponibles (affichées à l'utilisateur). */
  relachements: string[];
  graine: number;
};

/** Stock : quantité par ingrédient, dans l'unité du conditionnement de la grille de prix. */
export type Stock = Record<string, number>;

/** Boîtes de plat cuisiné en réserve au congélateur. */
export type BoiteStock = { recetteId: string; parts: number };

export type Base = {
  recettes: Recette[];
  parId: Record<string, Recette>;
  catalogue: Record<string, IngredientCatalogue>;
  prix: Record<string, PrixReference>;
};

export function creerBase(recettes: Recette[], catalogue: Record<string, IngredientCatalogue>, prix: Record<string, PrixReference>): Base {
  return { recettes, parId: Object.fromEntries(recettes.map((r) => [r.id, r])), catalogue, prix };
}
