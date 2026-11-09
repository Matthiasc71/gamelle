/**
 * Prix Lidl : lidl.fr ne publie pas ses prix alimentaires en ligne (et interdit sa recherche aux robots).
 * On rassemble donc les prix relevés dans les magasins Lidl de France par les contributeurs
 * d'Open Prices (tickets de caisse, photos de rayon), sur 12 mois.
 * Écrit data/prix-sources/lidl.json, utilisé en priorité par prices-fetch.ts.
 *
 * Usage : npm run lidl
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getJson, pause } from './lib/http';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data/prix-sources/lidl.json');
const API = 'https://prices.openfoodfacts.org/api/v1';

type Lieu = { id: number; osm_name?: string; osm_address_city?: string; osm_address_country?: string };
type Prix = {
  price: number;
  price_per?: 'KILOGRAM' | 'UNIT' | null;
  price_is_discounted?: boolean;
  date: string;
  category_tag?: string | null;
  location_id: number;
  product?: {
    code?: string; product_name?: string | null; product_quantity?: number | null; product_quantity_unit?: string | null;
    categories_tags?: string[] | null; brands?: string | null;
  } | null;
};

export type ReleveLidl = {
  date: string;
  prix: number;
  par?: 'KILOGRAM' | 'UNIT';
  categorie_vrac?: string;
  nom?: string;
  marque?: string;
  code?: string;
  quantite?: number;
  unite?: string;
  categories?: string[];
  ville?: string;
  remise: boolean;
};

async function main() {
  const lieux: Lieu[] = [];
  for (let page = 1; page <= 5; page++) {
    const d = await getJson<{ items: Lieu[]; pages: number }>(`${API}/locations?osm_name__like=Lidl&size=100&page=${page}`);
    lieux.push(...d.items.filter((l) => /lidl/i.test(l.osm_name ?? '') && /france/i.test(l.osm_address_country ?? '')));
    if (page >= d.pages) break;
    await pause(300);
  }
  const ville = new Map(lieux.map((l) => [l.id, l.osm_address_city ?? '']));
  const depuis = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
  const releves: ReleveLidl[] = [];
  const ids = lieux.map((l) => l.id);
  for (let k = 0; k < ids.length; k += 40) {
    const lot = ids.slice(k, k + 40).join(',');
    for (let page = 1; page <= 50; page++) {
      const d = await getJson<{ items: Prix[]; pages: number }>(
        `${API}/prices?location_id__in=${lot}&currency=EUR&date__gte=${depuis}&size=100&page=${page}`,
      );
      for (const p of d.items)
        releves.push({
          date: p.date,
          prix: p.price,
          par: p.price_per ?? undefined,
          categorie_vrac: p.category_tag ?? undefined,
          nom: p.product?.product_name ?? undefined,
          marque: p.product?.brands ?? undefined,
          code: p.product?.code,
          quantite: p.product?.product_quantity ?? undefined,
          unite: p.product?.product_quantity_unit ?? undefined,
          categories: p.product?.categories_tags ?? undefined,
          ville: ville.get(p.location_id),
          remise: !!p.price_is_discounted,
        });
      await pause(300);
      if (page >= d.pages) break;
    }
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify({
      source: 'Open Prices (Open Food Facts, ODbL) : prix relevés dans les magasins Lidl de France',
      releve_le: new Date().toISOString().slice(0, 10),
      magasins: lieux.length,
      releves,
    }),
  );
  console.log(`${releves.length} relevés dans ${lieux.length} magasins Lidl → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
