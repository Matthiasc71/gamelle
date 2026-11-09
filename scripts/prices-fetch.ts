/**
 * Construit data/prix-reference.json (la grille de prix utilisée par l'app) et reports/prix.md.
 *
 * Pour chaque ingrédient de data/prix-correspondances.json, dans l'ordre de priorité :
 *   1. prix saisi à la main (ticket de caisse)                      → methode "ticket"
 *   2. prix affiché sur aldi.fr pour un produit précis (instantané data/prix-sources/aldi.json,
 *      hors promo) : prix réel d'un premier prix en magasin discount  → "site-enseigne"
 *   3. Open Prices, médiane 12 mois, Lyon (25 km), enseignes de la grande distribution
 *      d'abord, au moins 3 relevés                                   → "open-prices-lyon"
 *   4. Open Prices, médiane 12 mois, France, au moins 3 relevés       → "open-prices-france"
 * Pourquoi Aldi avant Open Prices : une médiane par catégorie mélange marques nationales et
 * premiers prix (ex. sauce soja à 20 €/L) ; elle reste affichée dans le rapport comme contrôle.
 * Open Prices : https://prices.openfoodfacts.org (licence ODbL).
 *
 * Usage : npm run prices            (utilise le cache .cache/open-prices de moins de 7 jours)
 *         npm run prices -- --frais (ignore le cache)
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { GrillePrix, Unite, type PrixReference } from '../src/domain/schema';
import { getJson, pause } from './lib/http';
import type { ProduitAldi } from './aldi-catalogue';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache/open-prices');
const LYON = { lat: 45.764, lon: 4.8357, radius_km: 25 };
const ENSEIGNES_DISCOUNT = /lidl|aldi|leclerc|intermarch|auchan|carrefour|super u|hyper u|netto|leader price/i;
const MIN_RELEVES = 3;

export const Correspondance = z.object({
  produit: z.string(),
  conditionnement: z.object({ quantite: z.number().positive(), unite: Unite }),
  poids_piece_g: z.number().positive().optional(),
  aldi: z.string().optional(),
  open_prices: z
    .object({
      /** Produit en vrac (fruits, légumes) : tag de catégorie Open Prices, ex. "en:yellow-onions". */
      category_tag: z.string().optional(),
      /** Produit emballé : catégorie Open Food Facts, ex. "en:red-lentils". */
      categorie_produit: z.string().optional(),
      /** Le nom du produit doit contenir l'un de ces mots (sans accents, minuscules). */
      mots: z.array(z.string()).optional(),
      /** Le nom du produit ne doit contenir aucun de ces mots. */
      exclure: z.array(z.string()).optional(),
    })
    .optional(),
  manuel: z
    .object({ prix_eur: z.number().positive(), enseigne: z.string(), releve_le: z.string(), url: z.string().url().optional() })
    .optional(),
});
export type Correspondance = z.infer<typeof Correspondance>;

type PrixOP = {
  price: number;
  price_per?: 'KILOGRAM' | 'UNIT' | null;
  price_is_discounted?: boolean;
  date: string;
  product?: { product_name?: string | null; product_quantity?: number | null; product_quantity_unit?: string | null } | null;
  location?: { osm_name?: string | null; osm_brand?: string | null } | null;
};

export const mediane = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Prix d'une unité du conditionnement (1 g, 1 ml ou 1 pièce) à partir d'un relevé Open Prices,
 * ou null si le relevé ne permet pas la conversion sans deviner.
 */
export function prixParUnite(p: PrixOP, c: Pick<Correspondance, 'conditionnement' | 'poids_piece_g'>): number | null {
  const u = c.conditionnement.unite;
  if (p.price_per === 'KILOGRAM') {
    if (u === 'g') return p.price / 1000;
    if (u === 'pièce' && c.poids_piece_g) return (p.price / 1000) * c.poids_piece_g;
    return null;
  }
  if (p.price_per === 'UNIT' && !p.product) {
    if (u === 'pièce') return p.price;
    if (u === 'g' && c.poids_piece_g) return p.price / c.poids_piece_g;
    return null;
  }
  const q = p.product?.product_quantity;
  const qu = p.product?.product_quantity_unit;
  if (!q || !qu) return null;
  if ((u === 'g' && qu === 'g') || (u === 'ml' && qu === 'ml')) return p.price / q;
  return null;
}

async function releves(query: string, local: boolean, frais: boolean): Promise<PrixOP[]> {
  mkdirSync(CACHE, { recursive: true });
  const cle = join(CACHE, `${local ? 'lyon' : 'france'}-${query.replace(/[^a-z0-9]+/gi, '_')}.json`);
  if (!frais && existsSync(cle) && Date.now() - statSync(cle).mtimeMs < 7 * 86400_000)
    return JSON.parse(readFileSync(cle, 'utf8')) as PrixOP[];
  const depuis = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
  const geo = local ? `&lat=${LYON.lat}&lon=${LYON.lon}&radius_km=${LYON.radius_km}` : '';
  const out: PrixOP[] = [];
  for (let page = 1; page <= (local ? 3 : 2); page++) {
    const url = `https://prices.openfoodfacts.org/api/v1/prices?${query}&currency=EUR&date__gte=${depuis}${geo}&size=100&page=${page}&order_by=-date`;
    const d = await getJson<{ items: PrixOP[]; pages?: number }>(url);
    out.push(...d.items);
    await pause(400);
    if (!d.pages || page >= d.pages) break;
  }
  writeFileSync(cle, JSON.stringify(out));
  return out;
}

type Estimation = { n: number; parUnite: number; discount: boolean };

const sansAccents = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Garde les relevés comparables : nom compatible et paquet de taille voisine (×0,4 à ×2,5). */
export function comparables(items: PrixOP[], c: Correspondance): PrixOP[] {
  const { mots, exclure } = c.open_prices ?? {};
  const q = c.conditionnement.quantite;
  return items.filter((p) => {
    if (p.price_is_discounted) return false;
    const nom = sansAccents(p.product?.product_name ?? '');
    if (p.product && mots?.length && !mots.some((m) => nom.includes(sansAccents(m)))) return false;
    if (p.product && exclure?.some((m) => nom.includes(sansAccents(m)))) return false;
    const pq = p.product?.product_quantity;
    if (p.product && pq && c.conditionnement.unite !== 'pièce' && (pq < q * 0.4 || pq > q * 2.5)) return false;
    return true;
  });
}

function estimer(items: PrixOP[], c: Correspondance): Estimation | null {
  const ok = comparables(items, c);
  const conv = (xs: PrixOP[]) => xs.map((p) => prixParUnite(p, c)).filter((x): x is number => x !== null && x > 0);
  const disc = conv(ok.filter((p) => ENSEIGNES_DISCOUNT.test(`${p.location?.osm_brand ?? ''} ${p.location?.osm_name ?? ''}`)));
  const tous = conv(ok);
  const choix = disc.length >= MIN_RELEVES ? { xs: disc, discount: true } : { xs: tous, discount: false };
  if (choix.xs.length < MIN_RELEVES) return null;
  // écarte les valeurs aberrantes (erreurs d'unité) avant la médiane
  const m0 = mediane(choix.xs);
  const xs = choix.xs.filter((x) => x > m0 / 3 && x < m0 * 3);
  return { n: xs.length, parUnite: mediane(xs), discount: choix.discount };
}

const eur = (n: number) => n.toFixed(2).replace('.', ',') + ' €';
const unitTxt = (u: string) => (u === 'g' ? 'kg' : u === 'ml' ? 'L' : 'pièce');
const parRef = (parUnite: number, u: string) => (u === 'pièce' ? parUnite : parUnite * 1000);

async function main() {
  const frais = process.argv.includes('--frais');
  const corr = z
    .record(z.string(), Correspondance)
    .parse(JSON.parse(readFileSync(join(ROOT, 'data/prix-correspondances.json'), 'utf8')));
  const aldi = JSON.parse(readFileSync(join(ROOT, 'data/prix-sources/aldi.json'), 'utf8')) as {
    releve_le: string;
    produits: ProduitAldi[];
  };
  const aldiParId = new Map(aldi.produits.map((p) => [p.id, p]));
  const today = new Date().toISOString().slice(0, 10);

  const grille: Record<string, PrixReference> = {};
  const lignes: string[] = [];
  const compte = { ticket: 0, 'open-prices-lyon': 0, 'site-enseigne': 0, 'open-prices-france': 0, aucun: 0 };

  for (const [id, c] of Object.entries(corr).sort(([a], [b]) => a.localeCompare(b))) {
    const q = c.open_prices?.category_tag
      ? `category_tag=${encodeURIComponent(c.open_prices.category_tag)}`
      : c.open_prices?.categorie_produit
        ? `product__categories_tags__contains=${encodeURIComponent(c.open_prices.categorie_produit)}`
        : null;
    const lyon = q ? estimer(await releves(q, true, frais), c) : null;
    const fr = q && !lyon ? estimer(await releves(q, false, frais), c) : null;
    const a = c.aldi ? aldiParId.get(c.aldi) : undefined;
    const aldiOk = a && !a.promo ? a : undefined;
    const base = { produit: c.produit, conditionnement: c.conditionnement, poids_piece_g: c.poids_piece_g };
    const qte = c.conditionnement.quantite;

    let choix: PrixReference | null = null;
    if (c.manuel) {
      choix = { ...base, prix_eur: c.manuel.prix_eur, enseigne: c.manuel.enseigne, url: c.manuel.url, releve_le: c.manuel.releve_le, methode: 'ticket' };
    } else if (aldiOk) {
      choix = { ...base, prix_eur: aldiOk.prix_eur, enseigne: 'Aldi', url: aldiOk.url, releve_le: aldi.releve_le, methode: 'site-enseigne', note: `${aldiOk.nom} ${aldiOk.unite_vente}` };
    } else if (lyon) {
      choix = {
        ...base,
        prix_eur: Math.round(lyon.parUnite * qte * 100) / 100,
        enseigne: lyon.discount ? 'médiane enseignes discount, Lyon' : 'médiane toutes enseignes, Lyon',
        releve_le: today,
        methode: 'open-prices-lyon',
        note: `${lyon.n} relevés Open Prices sur 12 mois ; ${eur(parRef(lyon.parUnite, c.conditionnement.unite))}/${unitTxt(c.conditionnement.unite)}`,
      };
    } else if (fr) {
      choix = {
        ...base,
        prix_eur: Math.round(fr.parUnite * qte * 100) / 100,
        enseigne: 'médiane France',
        releve_le: today,
        methode: 'open-prices-france',
        note: `Estimation : ${fr.n} relevés Open Prices France sur 12 mois ; ${eur(parRef(fr.parUnite, c.conditionnement.unite))}/${unitTxt(c.conditionnement.unite)}`,
      };
    }
    if (choix) {
      grille[id] = choix;
      compte[choix.methode]++;
    } else compte.aucun++;

    const fmt = (e: Estimation | null) => (e ? `${eur(parRef(e.parUnite, c.conditionnement.unite))} (${e.n})` : '—');
    lignes.push(
      `| ${id} | ${c.produit} | ${fmt(lyon)} | ${a ? `${eur(a.prix_eur)}${a.promo ? ' (promo, ignoré)' : ''}` : '—'} | ${fmt(fr)} | ${choix ? `**${eur(choix.prix_eur)}** · ${choix.methode}` : '**aucun prix**'} |`,
    );
  }

  GrillePrix.parse(grille);
  writeFileSync(join(ROOT, 'data/prix-reference.json'), JSON.stringify(grille, null, 2) + '\n');
  mkdirSync(join(ROOT, 'reports'), { recursive: true });
  const total = Object.keys(corr).length;
  writeFileSync(
    join(ROOT, 'reports/prix.md'),
    `# Rapport de couverture des prix (${today})

Ville : Lyon (rayon ${LYON.radius_km} km). Open Prices : médiane des 12 derniers mois, prix non remisés,
enseignes discount d'abord, au moins ${MIN_RELEVES} relevés. Aldi : prix affichés sur aldi.fr le ${aldi.releve_le}.

| Méthode | Ingrédients |
|---|---|
| Ticket (saisie manuelle) | ${compte.ticket} |
| Open Prices Lyon | ${compte['open-prices-lyon']} |
| Site enseigne (Aldi) | ${compte['site-enseigne']} |
| Open Prices France (estimation) | ${compte['open-prices-france']} |
| **Sans prix** | **${compte.aucun}** |
| Total | ${total} |

Colonnes Lyon et France : prix au kg, au litre ou à la pièce (nombre de relevés).

| Ingrédient | Conditionnement | Open Prices Lyon | Aldi (paquet) | Open Prices France | Retenu (paquet) |
|---|---|---|---|---|---|
${lignes.join('\n')}

Sources : Open Prices / Open Food Facts (ODbL) ; aldi.fr.
`,
  );
  console.log(`Prix : ${total - compte.aucun}/${total} ingrédients couverts →`, compte);
  if (compte.aucun) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
