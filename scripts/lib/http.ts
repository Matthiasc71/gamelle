/** Petits utilitaires réseau pour les scripts (jamais utilisés dans l'app). */

export const UA = 'Gamelle/0.1 (app perso de recettes; +https://github.com/Matthiasc71/gamelle)';

export const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getText(url: string, opts: { ua?: string; timeoutMs?: number } = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': opts.ua ?? UA, 'Accept-Language': 'fr-FR,fr;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
  });
  return { status: res.status, url: res.url, text: await res.text() };
}

export async function getJson<T>(url: string, opts: { timeoutMs?: number } = {}): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return (await res.json()) as T;
}

/** Extrait le tableau JSON qui commence à `marker` (ex. '"hits":[') par appariement des crochets. */
export function extraireTableauJson(texte: string, marker: string): unknown[] {
  const debut = texte.indexOf(marker);
  if (debut < 0) return [];
  let i = debut + marker.length - 1; // position du '['
  let prof = 0;
  let dansChaine = false;
  for (let j = i; j < texte.length; j++) {
    const c = texte[j];
    if (dansChaine) {
      if (c === '\\') j++;
      else if (c === '"') dansChaine = false;
      continue;
    }
    if (c === '"') dansChaine = true;
    else if (c === '[' || c === '{') prof++;
    else if (c === ']' || c === '}') {
      prof--;
      if (prof === 0) return JSON.parse(texte.slice(i, j + 1)) as unknown[];
    }
  }
  throw new Error(`Tableau JSON non terminé après ${marker}`);
}
