/**
 * Prépare un brouillon de fiche à partir d'un lien (article, TikTok, Instagram).
 *
 *   npm run add-recipe -- <url> [<url2> …]
 *
 * - vérifie le lien (HTTP 200 ou oEmbed) ;
 * - extrait la recette publiée (JSON-LD schema.org) ou la légende de la vidéo ;
 * - propose des correspondances Ciqual pour chaque ingrédient (à confirmer à la main) ;
 * - écrit .cache/brouillons/<slug>.json et affiche le résumé.
 *
 * Le brouillon n'est PAS une recette de la base : les étapes doivent être reformulées,
 * les ingrédients mappés au catalogue, puis `npm run compute && npm run validate`,
 * et la fiche montrée à l'utilisateur avant d'être ajoutée dans data/recipes/.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { aujourdhui, ecrireJson, lireJson, ROOT, tableCiqual } from './lib/data';
import { extraireJsonLd, titrePage, typeDeSource, verifierSource } from './lib/sources';

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slugifier = (s: string) => sansAccents(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** Mots vides ignorés pour la recherche Ciqual. */
const VIDES = new Set('de du des la le les un une et ou en a au aux g kg ml cl l c cs cc cuillere cuilleres soupe cafe pincee boite sachet gousse gousses'.split(' '));

/** Les 3 aliments Ciqual dont le nom partage le plus de mots avec le libellé de l'ingrédient. */
export function suggererCiqual(libelle: string, table = tableCiqual()) {
  const mots = sansAccents(libelle).split(/[^a-z]+/).filter((m) => m.length > 2 && !VIDES.has(m));
  return Object.entries(table)
    .map(([code, l]) => {
      const nom = sansAccents(l[0]);
      const score = mots.reduce((s, m) => s + (nom.includes(m.replace(/s$/, '')) ? 1 : 0), 0) - nom.length / 500;
      return { code, nom: l[0], kcal: l[2], score };
    })
    .filter((x) => x.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

async function preparer(url: string) {
  const type = typeDeSource(url);
  const v = await verifierSource(url, type);
  console.log(`\n=== ${url}\n${type} · ${v.ok ? 'OK' : 'ÉCHEC'} (HTTP ${v.statut})${v.erreur ? ' · ' + v.erreur : ''}`);
  if (!v.ok) return;
  const table = tableCiqual();
  const catalogue = lireJson<Record<string, { nom: string }>>('data/ciqual-map.json');

  let nom = '';
  let auteur = '';
  let ingredients: string[] = [];
  let etapesOriginales: string[] = [];
  let legende = '';
  let kcal: string | undefined;
  let portions: string | undefined;
  if (type === 'article' && v.html) {
    const ld = extraireJsonLd(v.html);
    nom = ld?.nom || titrePage(v.html);
    auteur = ld?.auteur ?? '';
    ingredients = ld?.ingredients ?? [];
    etapesOriginales = ld?.etapes ?? [];
    kcal = ld?.kcal;
    portions = ld?.portions;
    if (!ld) console.log('Pas de recette JSON-LD sur la page : lire la page et saisir les ingrédients à la main.');
  } else if (v.oembed) {
    nom = v.oembed.title.split('\n')[0].slice(0, 80);
    auteur = v.oembed.author_name;
    legende = v.oembed.title;
    console.log(`Légende :\n${legende}\n`);
    console.log('Vidéo : les quantités doivent figurer dans la légende ou dans un article du même créateur.');
  }

  console.log(`Nom : ${nom}\nAuteur : ${auteur}\nPortions : ${portions ?? '?'}\nKcal annoncées : ${kcal ?? '—'}`);
  const lignes = ingredients.map((ing) => {
    const sugg = suggererCiqual(ing, table);
    const dansCatalogue = Object.entries(catalogue).find(([, c]) => sugg[0] && sansAccents(ing).includes(sansAccents(c.nom)));
    console.log(`- ${ing}\n    Ciqual ? ${sugg.map((s) => `${s.code} ${s.nom} (${s.kcal} kcal)`).join(' | ') || 'aucune suggestion'}${dansCatalogue ? `\n    catalogue : ${dansCatalogue[0]}` : ''}`);
    return { texte_source: ing, suggestions_ciqual: sugg.map((s) => s.code), catalogue: dansCatalogue?.[0] ?? null };
  });
  if (etapesOriginales.length) console.log(`${etapesOriginales.length} étapes dans la source (à reformuler, jamais copier).`);

  const slug = slugifier(nom || url);
  const dir = join(ROOT, '.cache/brouillons');
  mkdirSync(dir, { recursive: true });
  const chemin = join(dir, `${slug}.json`);
  ecrireJson(chemin, {
    brouillon: true,
    slug,
    nom,
    source: { type, url: v.url_finale ?? url, titre: nom, auteur, verifie_le: aujourdhui(), oembed: v.oembed },
    portions_source: portions,
    kcal_annoncees: kcal,
    legende,
    ingredients_source: lignes,
    // gardé pour relecture seulement : à reformuler, ne jamais publier tel quel
    etapes_source_a_reformuler: etapesOriginales,
  });
  console.log(`Brouillon : ${chemin}`);
}

const urls = process.argv.slice(2).filter((a) => /^https?:\/\//.test(a));
if (!urls.length) {
  console.error('Usage : npm run add-recipe -- <url> [<url2> …]');
  process.exit(1);
}
for (const u of urls) await preparer(u);
