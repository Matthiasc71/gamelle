/// <reference lib="webworker" />
/** Génère le menu hors du fil principal (≈ 1 s de calcul) pour garder l'interface fluide. */
import { genererMenu, type ParamsGeneration } from '../domain/planner';
import { BASE } from './base';

type Demande = { id: number; params: Omit<ParamsGeneration, 'base'> };

self.onmessage = (e: MessageEvent<Demande>) => {
  const { id, params } = e.data;
  try {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, menu: genererMenu({ ...params, base: BASE }) });
  } catch (err) {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, erreur: String(err) });
  }
};
