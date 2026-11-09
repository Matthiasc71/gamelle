/**
 * Revérifie toutes les sources des recettes et met à jour `verifie_le` et `oembed`.
 * Écrit reports/liens.md. Code de sortie 1 si un lien est mort.
 *
 *   npm run links                         (toutes les recettes)
 *   npm run links -- --seulement a,b      (seulement ces slugs ; le rapport ne couvre alors qu'elles)
 *
 * Un refus 429 (limite de débit, fréquent chez TikTok) n'est pas un lien mort : on réessaie
 * deux fois après 45 s, puis on le classe « à revérifier » sans toucher à verifie_le.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { aujourdhui, ecrireJson, recettesBrutes, ROOT } from './lib/data';
import { pause } from './lib/http';
import { verifierSource, type TypeSource } from './lib/sources';

type SourceBrute = { type: TypeSource; url: string; verifie_le?: string; oembed?: unknown };

const iSeul = process.argv.indexOf('--seulement');
const seulement = iSeul > 0 ? new Set(process.argv[iSeul + 1].split(',')) : null;

const morts: string[] = [];
const aRevoir: string[] = [];
const lignes: string[] = [];
for (const { fichier, data } of recettesBrutes()) {
  if (seulement && !seulement.has(data.slug as string)) continue;
  const sources = data.sources as SourceBrute[];
  for (const s of sources) {
    let r = await verifierSource(s.url, s.type);
    for (let essai = 0; essai < 2 && r.statut === 429; essai++) {
      await pause(45_000);
      r = await verifierSource(s.url, s.type);
    }
    if (r.statut === 429) {
      aRevoir.push(`${data.slug} → ${s.url} (limite de débit, dernière vérification réussie : ${s.verifie_le})`);
      lignes.push(`| ${data.slug} | ${s.type} | à revérifier (429) | ${s.url} |`);
      await pause(8000);
      continue;
    }
    if (r.ok) {
      s.verifie_le = aujourdhui();
      if (r.oembed) {
        s.oembed = {
          author_name: r.oembed.author_name,
          // première ligne de la légende seulement (titre affiché sur la carte)
          title: Array.from(r.oembed.title.split('\n')[0]).slice(0, 140).join('').trim(),
          ...(r.oembed.thumbnail_url ? { thumbnail_url: r.oembed.thumbnail_url } : {}),
        };
      }
    } else morts.push(`${data.slug} → ${s.url} (${r.statut} ${r.erreur ?? ''})`);
    lignes.push(`| ${data.slug} | ${s.type} | ${r.ok ? 'OK' : `**ÉCHEC ${r.statut}**`} | ${s.url} |`);
    await pause(s.type === 'article' ? 500 : 8000); // TikTok limite le débit
  }
  ecrireJson(fichier, data);
}

writeFileSync(
  join(ROOT, seulement ? 'reports/liens-partiel.md' : 'reports/liens.md'),
  `# Vérification des sources (${aujourdhui()})

Articles : HTTP 200. TikTok : page d'intégration officielle (auteur et légende présents).
Instagram : oEmbed Meta sans jeton, puis page d'intégration (auteur et légende).

${morts.length ? `## Liens morts (${morts.length})\n\n${morts.map((m) => `- ${m}`).join('\n')}\n` : 'Aucun lien mort.\n'}
${aRevoir.length ? `\n## À revérifier plus tard (${aRevoir.length})\n\n${aRevoir.map((m) => `- ${m}`).join('\n')}\n` : ''}
| Recette | Type | Statut | URL |
|---|---|---|---|
${lignes.join('\n')}
`,
);
console.log(`${lignes.length} sources vérifiées, ${morts.length} mortes, ${aRevoir.length} à revérifier`);
if (morts.length) process.exitCode = 1;
