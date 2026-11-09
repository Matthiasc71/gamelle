/** Vérification des sources (article HTTP 200, oEmbed TikTok / Instagram) et extraction de recette. */
import { getText } from './http';

export type TypeSource = 'article' | 'tiktok' | 'instagram';

export function typeDeSource(url: string): TypeSource {
  const h = new URL(url).hostname;
  if (/(^|\.)tiktok\.com$/.test(h)) return 'tiktok';
  if (/(^|\.)instagram\.com$/.test(h)) return 'instagram';
  return 'article';
}

export type ResultatVerif = {
  ok: boolean;
  statut: number;
  url_finale?: string;
  oembed?: { thumbnail_url?: string; author_name: string; title: string };
  /** Page HTML (articles) pour l'extraction, non stockée. */
  html?: string;
  erreur?: string;
};

const decoder = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

/**
 * TikTok. L'oEmbed (https://www.tiktok.com/oembed) répond ici la même chose pour n'importe quel
 * identifiant, même inexistant : il ne prouve rien. On lit donc la page d'intégration officielle
 * (/embed/v2/<id>, celle que charge le lecteur intégré) : elle contient l'auteur, la légende et
 * la vignette, et n'a pas de données vidéo si la vidéo n'existe plus.
 */
async function verifierTiktok(url: string): Promise<ResultatVerif> {
  const id = url.match(/\/(?:video|photo)\/(\d+)/)?.[1];
  if (!id) return { ok: false, statut: 0, erreur: 'identifiant de vidéo TikTok introuvable dans l’URL' };
  const r = await getText(`https://www.tiktok.com/embed/v2/${id}`);
  if (r.status !== 200) return { ok: false, statut: r.status, erreur: `page d'intégration HTTP ${r.status}` };
  const m = r.text.match(/<script id="__FRONTITY_CONNECT_STATE__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return { ok: false, statut: r.status, erreur: "page d'intégration sans données" };
  type VD = {
    itemInfos?: { text?: string; covers?: string[] };
    authorInfos?: { uniqueId?: string; nickName?: string };
  };
  const etat = JSON.parse(m[1]) as { source?: { data?: Record<string, { videoData?: VD }> } };
  const vd = etat.source?.data?.[`/embed/v2/${id}`]?.videoData;
  if (!vd?.authorInfos?.uniqueId) return { ok: false, statut: 404, erreur: 'vidéo indisponible' };
  return {
    ok: true,
    statut: 200,
    oembed: {
      author_name: `@${vd.authorInfos.uniqueId}`,
      title: vd.itemInfos?.text ?? '',
      thumbnail_url: vd.itemInfos?.covers?.[0],
    },
  };
}

/**
 * Instagram. L'oEmbed de Meta sans jeton confirme l'existence du post (sinon « Media Not Found »)
 * mais ne donne ni auteur ni légende : on les lit sur la page d'intégration officielle
 * (/embed/captioned/).
 */
async function verifierInstagram(url: string): Promise<ResultatVerif> {
  const o = await getText(`https://graph.facebook.com/v21.0/instagram_oembed?url=${encodeURIComponent(url)}`);
  if (o.status !== 200) return { ok: false, statut: o.status, erreur: o.text.slice(0, 200) };
  const code = url.match(/instagram\.com\/(?:p|reel|tv)\/([\w-]+)/)?.[1];
  if (!code) return { ok: false, statut: 0, erreur: 'code de post Instagram introuvable dans l’URL' };
  const e = await getText(`https://www.instagram.com/p/${code}/embed/captioned/`);
  const user = e.text.match(/class="UsernameText"[^>]*>([^<]+)/)?.[1];
  const cap = e.text.match(/<div class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments"/)?.[1] ?? '';
  const img = e.text.match(/class="EmbeddedMediaImage"[^>]*src="([^"]+)"/)?.[1];
  if (!user) return { ok: false, statut: e.status, erreur: "auteur absent de la page d'intégration" };
  // la légende commence par le nom d'utilisateur : on le retire
  const legende = decoder(cap).replace(new RegExp(`^${user}\\s*`), '');
  return { ok: true, statut: 200, oembed: { author_name: `@${user}`, title: legende, thumbnail_url: img && decoder(img) } };
}

export async function verifierSource(url: string, type = typeDeSource(url)): Promise<ResultatVerif> {
  try {
    if (type === 'article') {
      const r = await getText(url);
      return { ok: r.status === 200, statut: r.status, url_finale: r.url, html: r.text };
    }
    return type === 'tiktok' ? await verifierTiktok(url) : await verifierInstagram(url);
  } catch (e) {
    return { ok: false, statut: 0, erreur: String(e) };
  }
}

export type RecetteJsonLd = {
  nom?: string;
  auteur?: string;
  portions?: string;
  ingredients: string[];
  etapes: string[];
  kcal?: string;
  temps_total?: string;
};

/** Extrait la recette schema.org (JSON-LD) d'une page, si le site la publie. */
export function extraireJsonLd(html: string): RecetteJsonLd | null {
  const blocs = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const candidats: Record<string, unknown>[] = [];
  const visiter = (n: unknown) => {
    if (Array.isArray(n)) n.forEach(visiter);
    else if (n && typeof n === 'object') {
      const o = n as Record<string, unknown>;
      const t = o['@type'];
      if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) candidats.push(o);
      if (o['@graph']) visiter(o['@graph']);
    }
  };
  for (const b of blocs) {
    try {
      visiter(JSON.parse(b.trim()));
    } catch {
      /* JSON-LD invalide : ignoré */
    }
  }
  const r = candidats[0];
  if (!r) return null;
  const txt = (v: unknown): string =>
    typeof v === 'string' ? v : Array.isArray(v) ? v.map(txt).join(' ') : v && typeof v === 'object' ? txt((v as Record<string, unknown>).name ?? (v as Record<string, unknown>).text ?? '') : '';
  const etapes: string[] = [];
  const visiterEtapes = (v: unknown) => {
    if (typeof v === 'string') etapes.push(v);
    else if (Array.isArray(v)) v.forEach(visiterEtapes);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (o.itemListElement) visiterEtapes(o.itemListElement);
      else if (o.text) etapes.push(String(o.text));
    }
  };
  visiterEtapes(r.recipeInstructions);
  const nutrition = r.nutrition as Record<string, unknown> | undefined;
  return {
    nom: txt(r.name),
    auteur: txt(r.author),
    portions: txt(r.recipeYield),
    ingredients: (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : []).map(String),
    etapes: etapes.map((e) => e.replace(/<[^>]+>/g, '').trim()),
    kcal: nutrition ? txt(nutrition.calories) : undefined,
    temps_total: txt(r.totalTime),
  };
}

/** Titre de la page (balise og:title ou title). */
export function titrePage(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1];
  const t = og ?? html.match(/<title[^>]*>([^<]+)/i)?.[1] ?? '';
  return t.replace(/&amp;/g, '&').replace(/&#0?39;|&rsquo;/g, '’').replace(/\s+/g, ' ').trim();
}
