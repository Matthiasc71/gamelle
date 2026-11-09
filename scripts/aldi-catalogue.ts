/**
 * Relevé des prix affichés sur aldi.fr (pages catégories alimentaires, autorisées par robots.txt).
 * Écrit data/prix-sources/aldi.json : un instantané daté, utilisé par prices-fetch.ts.
 *
 * Usage : npm run aldi
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extraireTableauJson, getText, pause } from './lib/http';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data/prix-sources/aldi.json');

/** Rayons alimentaires utiles (aldi.fr ne publie pas les fruits et légumes frais). */
const CATEGORIES = [
  'epicerie-salee/epice-herbe',
  'epicerie-salee/fruit-legume',
  'epicerie-salee/huile-sauce',
  'epicerie-salee/pates-riz',
  'epicerie-salee/soupe-bouillon',
  'epicerie-salee/viande-poisson',
  'epicerie-sucree/dessert--sucre-farine',
  'pain-viennoiserie/pain',
  'pain-viennoiserie/pain-mie-burgers',
  'produits-laitiers/creme-beurre',
  'produits-laitiers/fromage-rape-tranche',
  'produits-laitiers/fromages-a-deguster',
  'produits-laitiers/lait-oeufs',
  'produits-laitiers/yaourt-fromage-blanc',
  'charcuterie/jambons',
  'surgeles/fruit-legume',
  'surgeles/viande-poisson',
  'viande-poisson/poisson-crustace',
  'viande-poisson/porc',
  'viande-poisson/viande-rouge',
  'viande-poisson/volaille',
];

type Hit = {
  objectID: string;
  name: string;
  brandName?: string;
  salesUnit?: string;
  productSlug: string;
  isAvailable?: boolean;
  currentPrice?: {
    priceValue: number;
    basePrice?: { basePriceValue: number; basePriceScale: string }[];
    validFrom?: number;
    validUntil?: number;
  };
  promotionPrices?: unknown[];
};

export type ProduitAldi = {
  id: string;
  nom: string;
  marque: string;
  unite_vente: string;
  prix_eur: number;
  prix_base?: { valeur: number; echelle: string };
  /** Prix promotionnel de courte durée (< 14 j) : à ne pas utiliser comme prix de référence. */
  promo: boolean;
  categorie: string;
  url: string;
};

async function main() {
  const produits = new Map<string, ProduitAldi>();
  for (const cat of CATEGORIES) {
    const url = `https://www.aldi.fr/produits/${cat}.html`;
    const { status, text } = await getText(url);
    if (status !== 200) {
      console.warn(`! ${url} → HTTP ${status}`);
      continue;
    }
    const hits = extraireTableauJson(text, '"hits":[') as Hit[];
    for (const h of hits) {
      if (!h.currentPrice || h.isAvailable === false) continue;
      const cp = h.currentPrice;
      const duree = cp.validFrom && cp.validUntil ? (cp.validUntil - cp.validFrom) / 86400 : Infinity;
      const bp = cp.basePrice?.[0];
      produits.set(h.objectID, {
        id: h.objectID,
        nom: h.name,
        marque: h.brandName ?? '',
        unite_vente: h.salesUnit ?? '',
        prix_eur: cp.priceValue,
        prix_base: bp ? { valeur: bp.basePriceValue, echelle: bp.basePriceScale } : undefined,
        promo: duree < 14 || (h.promotionPrices?.length ?? 0) > 0,
        categorie: cat,
        url: `https://www.aldi.fr/fiches-produits/${h.productSlug}.html`,
      });
    }
    console.log(`${cat} : ${hits.length} produits`);
    await pause(1500); // politesse
  }
  mkdirSync(dirname(OUT), { recursive: true });
  const releve_le = new Date().toISOString().slice(0, 10);
  writeFileSync(
    OUT,
    JSON.stringify(
      { source: 'aldi.fr (prix affichés en ligne, France)', releve_le, produits: [...produits.values()] },
      null,
      1,
    ),
  );
  console.log(`${produits.size} produits → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
