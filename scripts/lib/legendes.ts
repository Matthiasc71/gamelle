/** Outil de recherche : récupère et met en cache la légende de vidéos TikTok / Instagram. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './data';
import { pause } from './http';
import { verifierSource } from './sources';

for (const url of process.argv.slice(2)) {
  const cle = join(ROOT, '.cache/legendes', url.replace(/[^a-z0-9]+/gi, '_').slice(-80) + '.txt');
  if (!existsSync(cle)) {
    const r = await verifierSource(url);
    await pause(8000);
    if (!r.ok) {
      console.log(`\n##### ${url}\nÉCHEC ${r.statut} ${r.erreur ?? ''}`);
      continue;
    }
    writeFileSync(cle, `${r.oembed?.author_name}\n${r.oembed?.title}`);
  }
  console.log(`\n##### ${url}\n${readFileSync(cle, 'utf8')}`);
}
