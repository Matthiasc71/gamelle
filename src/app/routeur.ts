/** Routeur minimal par ancre (#/semaine, #/recette/dahl?c=3…) : marche sur GitHub Pages et hors ligne. */
import { useSyncExternalStore } from 'react';

export type Route = { ecran: string; id?: string; params: URLSearchParams };

function lire(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  const [chemin, requete = ''] = h.split('?');
  const [ecran = 'semaine', id] = chemin.split('/').filter(Boolean).map(decodeURIComponent);
  return { ecran, id, params: new URLSearchParams(requete) };
}

let courante = lire();
/** Nombre de pages ouvertes dans l'app depuis le lancement (pour savoir si « retour » a un sens). */
let profondeur = 0;
const abonnes = new Set<() => void>();
window.addEventListener('hashchange', () => {
  courante = lire();
  profondeur++;
  abonnes.forEach((f) => f());
});

export function useRoute(): Route {
  return useSyncExternalStore(
    (f) => (abonnes.add(f), () => abonnes.delete(f)),
    () => courante,
  );
}

export function lien(ecran: string, id?: string, params?: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined) q.set(k, String(v));
  const s = q.toString();
  return `#/${ecran}${id ? `/${encodeURIComponent(id)}` : ''}${s ? `?${s}` : ''}`;
}

export const aller = (h: string, remplacer = false) => {
  if (remplacer) location.replace(h);
  else location.hash = h;
};

/** Retour : historique du navigateur s'il existe, sinon l'écran donné. */
export function retour(defaut = '#/semaine') {
  if (profondeur > 0) {
    profondeur -= 2; // le hashchange du retour va réincrémenter
    history.back();
  } else aller(defaut, true);
}
