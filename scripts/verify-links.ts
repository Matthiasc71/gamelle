/**
 * Revérifie toutes les sources des recettes et met à jour `verifie_le` et `oembed`.
 * Écrit reports/liens.md. Code de sortie 1 si un lien est mort.
 *
 *   npm run links
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { aujourdhui, ecrireJson, recettesBrutes, ROOT } from './lib/data';
import { pause } from './lib/http';
import { verifierSource, type TypeSource } from './lib/sources';

type SourceBrute = { type: TypeSource; url: string; verifie_le?: string; oembed?: unknown };

const morts: string[] = [];
const lignes: string[] = [];
for (const { fichier, data } of recettesBrutes()) {
  const sources = data.sources as SourceBrute[];
  for (const s of sources) {
    const r = await verifierSource(s.url, s.type);
    if (r.ok) {
      s.verifie_le = aujourdhui();
      if (r.oembed) {
        s.oembed = {
          author_name: r.oembed.author_name,
          // première ligne de la légende seulement (titre affiché sur la carte)
          title: r.oembed.title.split('\n')[0].slice(0, 140).trim(),
          ...(r.oembed.thumbnail_url ? { thumbnail_url: r.oembed.thumbnail_url } : {}),
        };
      }
    } else morts.push(`${data.slug} → ${s.url} (${r.statut} ${r.erreur ?? ''})`);
    lignes.push(`| ${data.slug} | ${s.type} | ${r.ok ? 'OK' : `**ÉCHEC ${r.statut}**`} | ${s.url} |`);
    await pause(s.type === 'article' ? 500 : 2500); // TikTok limite le débit
  }
  ecrireJson(fichier, data);
}

writeFileSync(
  join(ROOT, 'reports/liens.md'),
  `# Vérification des sources (${aujourdhui()})

Articles : HTTP 200. TikTok : page d'intégration officielle (auteur et légende présents).
Instagram : oEmbed Meta sans jeton, puis page d'intégration (auteur et légende).

${morts.length ? `## Liens morts (${morts.length})\n\n${morts.map((m) => `- ${m}`).join('\n')}\n` : 'Aucun lien mort.\n'}
| Recette | Type | Statut | URL |
|---|---|---|---|
${lignes.join('\n')}
`,
);
console.log(`${lignes.length} sources vérifiées, ${morts.length} mortes`);
if (morts.length) process.exitCode = 1;
