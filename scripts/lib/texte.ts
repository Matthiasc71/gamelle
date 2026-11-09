/** Outil de recherche : affiche le texte lisible d'une page autour d'un mot (par défaut « Ingrédients »). */
import { getText } from './http';

const [url, mot = 'Ingrédients', longueur = '2500'] = process.argv.slice(2);
const { status, text } = await getText(url);
const propre = text
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#0?39;|&rsquo;/g, '’')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n\s*\n+/g, '\n');
const i = propre.toLowerCase().indexOf(mot.toLowerCase());
console.log(`HTTP ${status} ${url}\n${i < 0 ? `(« ${mot} » introuvable)\n` + propre.slice(0, 600) : propre.slice(i, i + Number(longueur))}`);
