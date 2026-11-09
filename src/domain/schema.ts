/**
 * Schéma des données de Gamelle (recettes, catalogue d'ingrédients, grille de prix).
 * Validé au build par scripts/validate.ts. Les types TypeScript en sont dérivés.
 */
import { z } from 'zod';

const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date AAAA-MM-JJ attendue');
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug en minuscules-avec-tirets');

export const EQUIPEMENTS = ['plaques', 'four', 'micro-ondes', 'rice-cooker'] as const;
export const Equipement = z.enum(EQUIPEMENTS);
export type Equipement = z.infer<typeof Equipement>;

export const RAYONS = ['fruits-legumes', 'frais', 'viandes-poissons', 'epicerie', 'surgeles'] as const;
export const Rayon = z.enum(RAYONS);
export type Rayon = z.infer<typeof Rayon>;

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
export const Proteine = z.enum(PROTEINES);
export type Proteine = z.infer<typeof Proteine>;

/** Familles utilisées pour la règle « au moins 3 familles de protéines par semaine ». */
export const FAMILLE_PROTEINE: Record<Proteine, string> = {
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
export const Illustration = z.enum(ILLUSTRATIONS);
export type Illustration = z.infer<typeof Illustration>;

export const Unite = z.enum(['g', 'ml', 'pièce']);
export type Unite = z.infer<typeof Unite>;

export const IngredientRecette = z.object({
  /** Clé du catalogue data/ciqual-map.json (prix, rayon, conservation). */
  ingredient: slug,
  /** Code Ciqual : doit être celui du catalogue (vérifié par validate). */
  ciqual_code: z.string().regex(/^\d+$/),
  nom_affiche: z.string().min(1),
  quantite: z.number().positive(),
  unite: Unite,
  /** Mesure ménagère affichée à la place de la quantité (ex. « 1 c. à café »). */
  mesure_affichee: z.string().optional(),
  /** Poids en grammes, dans l'état indiqué (sert au calcul Ciqual). */
  poids_g: z.number().positive(),
  etat: z.enum(['cru', 'cuit', 'égoutté']),
  rayon: Rayon,
  optionnel: z.boolean().default(false),
});
export type IngredientRecette = z.infer<typeof IngredientRecette>;

export const Etape = z.object({
  /** Texte reformulé avec nos mots (jamais copié de la source). */
  texte: z.string().min(10),
  /** Minuteur proposé en mode cuisine. */
  minuteur_s: z.number().int().positive().optional(),
  /** Appareil occupé pendant l'étape (sert à la timeline batch). */
  equipement: Equipement.optional(),
  /** Durée estimée de l'étape en minutes. */
  duree_min: z.number().positive(),
  /** true si l'étape occupe les mains (couper, remuer) ; false si ça cuit tout seul. */
  actif: z.boolean(),
});
export type Etape = z.infer<typeof Etape>;

export const OEmbed = z.object({
  thumbnail_url: z.string().url().optional(),
  author_name: z.string(),
  title: z.string(),
});

export const Source = z.object({
  type: z.enum(['article', 'tiktok', 'instagram']),
  url: z.string().url(),
  titre: z.string().min(1),
  auteur: z.string().min(1),
  verifie_le: dateISO,
  oembed: OEmbed.optional(),
  /** Pour une vidéo : d'où viennent les quantités (légende complète, ou article du même créateur). */
  quantites_depuis: z.enum(['article', 'legende', 'article-meme-createur']).optional(),
});
export type Source = z.infer<typeof Source>;

export const Nutrition = z.object({
  kcal: z.number().nonnegative(),
  proteines_g: z.number().nonnegative(),
  glucides_g: z.number().nonnegative(),
  lipides_g: z.number().nonnegative(),
  fibres_g: z.number().nonnegative(),
  methode: z.literal('ciqual-2025'),
});
export type Nutrition = z.infer<typeof Nutrition>;

export const Recette = z
  .object({
    id: slug,
    slug: slug,
    nom: z.string().min(3),
    resume: z.string().min(10),
    type: z.enum(['batch', 'express', 'assemblage']),
    portions_base: z.number().int().min(1).max(6),
    conservation: z.object({
      frigo_jours: z.number().int().min(0).max(3),
      congelable: z.boolean(),
    }),
    temps: z.object({
      prepa_min: z.number().nonnegative(),
      cuisson_min: z.number().nonnegative(),
      total_min: z.number().positive(),
      actif_min: z.number().positive(),
    }),
    equipement: z.array(Equipement),
    saison: z.array(z.number().int().min(1).max(12)).min(1),
    cuisine: z.string().min(3),
    proteine_principale: Proteine,
    /** Créneaux où le plat a du sens (un assemblage froid plutôt le midi, par ex.). */
    creneaux: z.array(z.enum(['midi', 'soir'])).min(1).default(['midi', 'soir']),
    illustration: Illustration,
    ingredients: z.array(IngredientRecette).min(2),
    etapes: z.array(Etape).min(1),
    sources: z.array(Source).min(1),
    /** Ce qui a changé par rapport à l'original (« adaptée de »). */
    adaptation: z.string().optional(),
    /** Calories annoncées par la source, pour le contrôle d'écart à 15 %. */
    kcal_annoncees_par_part: z.number().positive().optional(),
    image: z
      .object({ fichier: z.string(), auteur: z.string(), licence: z.string(), url_origine: z.string().url() })
      .nullable(),
    /** Calculé par scripts/compute.ts depuis Ciqual. */
    nutrition_par_part: Nutrition,
    /** Calculé par scripts/compute.ts depuis la grille de prix (coût des quantités utilisées). */
    cout_par_part_eur: z.number().nonnegative(),
    verifications: z.object({
      source_ok: z.boolean(),
      nutrition_ok: z.boolean(),
      prix_ok: z.boolean(),
      notes: z.string(),
    }),
  })
  .superRefine((r, ctx) => {
    if (r.id !== r.slug) ctx.addIssue({ code: 'custom', message: 'id et slug doivent être identiques' });
    if (r.type === 'express' && r.temps.total_min > 20)
      ctx.addIssue({ code: 'custom', message: 'une recette express doit prendre 20 min maximum' });
    if (r.type === 'batch' && r.portions_base < 3)
      ctx.addIssue({ code: 'custom', message: 'une recette batch fait au moins 3 parts' });
    if (r.type === 'assemblage' && r.equipement.some((e) => e === 'four' || e === 'plaques' || e === 'rice-cooker'))
      ctx.addIssue({ code: 'custom', message: 'un assemblage se fait sans cuisson (micro-ondes toléré)' });
    const usedEquip = new Set(r.etapes.flatMap((e) => (e.equipement ? [e.equipement] : [])));
    for (const e of usedEquip)
      if (!r.equipement.includes(e))
        ctx.addIssue({ code: 'custom', message: `étape sur « ${e} » absent de la liste equipement` });
    for (const s of r.sources)
      if (s.type !== 'article' && !s.quantites_depuis)
        ctx.addIssue({ code: 'custom', message: `source ${s.type} sans « quantites_depuis » (${s.url})` });
  });
export type Recette = z.infer<typeof Recette>;

/** Catalogue d'ingrédients : data/ciqual-map.json */
export const IngredientCatalogue = z.object({
  nom: z.string(),
  ciqual_code: z.string().regex(/^\d+$/),
  /** Libellé Ciqual, recopié pour relecture humaine (vérifié par validate). */
  ciqual_nom: z.string(),
  rayon: Rayon,
  /** Où il se range une fois acheté. */
  rangement: z.enum(['frigo', 'congelateur', 'placard']),
  /** Durée de conservation après achat, paquet ouvert compris (jours). */
  conservation_jours: z.number().int().positive(),
  /** Compte comme légume pour la règle « au moins une portion (80 g) de légumes par repas ». */
  legume: z.boolean().default(false),
  note: z.string().optional(),
});
export type IngredientCatalogue = z.infer<typeof IngredientCatalogue>;
export const CiqualMap = z.record(slug, IngredientCatalogue);

/** Grille de prix de référence : data/prix-reference.json */
export const PrixReference = z.object({
  produit: z.string(),
  conditionnement: z.object({ quantite: z.number().positive(), unite: Unite }),
  /** Poids d'une pièce quand le conditionnement est en pièces (œufs, citrons…). */
  poids_piece_g: z.number().positive().optional(),
  prix_eur: z.number().positive(),
  enseigne: z.string(),
  url: z.string().url().optional(),
  releve_le: dateISO,
  methode: z.enum(['site-enseigne', 'open-prices-lyon', 'open-prices-france', 'ticket']),
  note: z.string().optional(),
});
export type PrixReference = z.infer<typeof PrixReference>;
export const GrillePrix = z.record(slug, PrixReference);
