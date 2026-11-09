/**
 * Constantes du domaine, sans dépendance : l'app les utilise sans embarquer Zod
 * (le schéma, lui, ne sert qu'au build et aux scripts).
 */
export const EQUIPEMENTS = ['plaques', 'four', 'micro-ondes', 'rice-cooker'] as const;

export const RAYONS = ['fruits-legumes', 'frais', 'viandes-poissons', 'epicerie', 'surgeles'] as const;

export const PROTEINES = [
  'oeufs',
  'legumineuses',
  'poulet',
  'dinde',
  'porc',
  'boeuf',
  'thon',
  'sardines',
  'maquereau',
  'poisson-blanc',
  'saumon',
  'tofu',
  'laitier',
] as const;

/** Familles utilisées pour la règle « au moins 3 familles de protéines par semaine ». */
export const FAMILLE_PROTEINE: Record<(typeof PROTEINES)[number], string> = {
  oeufs: 'oeufs',
  legumineuses: 'legumineuses',
  poulet: 'volaille',
  dinde: 'volaille',
  porc: 'viande',
  boeuf: 'viande',
  thon: 'poisson',
  sardines: 'poisson',
  maquereau: 'poisson',
  'poisson-blanc': 'poisson',
  saumon: 'poisson',
  tofu: 'soja',
  laitier: 'laitier',
};

/** Familles de plats : chaque famille a son illustration botanique (src/ui/illustrations). */
export const ILLUSTRATIONS = [
  'curry-bol', // dahl, curry, chili servis avec riz
  'soupe', // velouté, soupe, minestrone
  'poelee', // sauté, poêlée, wok
  'gratin', // plat au four
  'omelette', // œufs, frittata, shakshuka
  'salade', // salade composée, bowl froid
  'wrap', // wraps, tartines, sandwichs
  'pates', // pâtes, nouilles
  'ragout', // mijoté, cocotte
  'poisson', // poisson et légumes
] as const;
