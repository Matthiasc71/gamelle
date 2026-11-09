/// <reference lib="webworker" />
/** Génère le menu hors du fil principal (≈ 1 s de calcul) pour garder l'interface fluide. */
import { genererMenu, type ParamsGeneration } from '../domain/planner';
import { ajouterRecettesPerso, BASE } from './base';
import type { Recette } from '../domain/schema';

type Demande = { id: number; params: Omit<ParamsGeneration, 'base'>; perso: Recette[] };

self.onmessage = (e: MessageEvent<Demande>) => {
  const { id, params, perso } = e.data;
  try {
    ajouterRecettesPerso(perso);
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, menu: genererMenu({ ...params, base: BASE }) });
  } catch (err) {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, erreur: String(err) });
  }
};
