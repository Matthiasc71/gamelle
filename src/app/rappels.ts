/**
 * Rappels « à sortir du congélateur » au format iCalendar (RFC 5545).
 * Le fichier est ouvert par le Calendrier de l'iPhone, qui notifie à l'heure dite : pas de serveur, pas de compte.
 */
import { ajouterJours } from '../domain/dates';
import type { DetailRepas } from '../domain/regles';
import type { Menu } from '../domain/types';

/** Heure du rappel, la veille du repas. */
export const HEURE_RAPPEL = 20;

const echapper = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const dateIcs = (jour: string, h: number, m = 0) => `${jour.replace(/-/g, '')}T${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}00`;

export function fichierRappels(menu: Menu, details: DetailRepas[], maintenant = new Date()): { nom: string; contenu: string } {
  const stamp = maintenant.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  // un rappel par veille : on regroupe les boîtes à sortir le même soir
  const parVeille = new Map<string, string[]>();
  for (const d of details.filter((x) => x.statut === 'congele')) {
    const veille = ajouterJours(menu.lundi, d.jour - 1);
    parVeille.set(veille, [...(parVeille.get(veille) ?? []), d.recette.nom]);
  }
  const evenements = [...parVeille.entries()].map(([veille, noms]) => {
    const titre = `Gamelle : sortir du congélateur (${noms.length})`;
    return [
      'BEGIN:VEVENT',
      `UID:gamelle-${menu.semaine}-${veille}@gamelle.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${dateIcs(veille, HEURE_RAPPEL)}`,
      `DTEND:${dateIcs(veille, HEURE_RAPPEL, 10)}`,
      `SUMMARY:${echapper(titre)}`,
      `DESCRIPTION:${echapper(`À mettre au frigo pour demain : ${noms.join(', ')}.`)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${echapper(titre)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    ].join('\r\n');
  });
  const contenu = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gamelle//Rappels//FR', 'CALSCALE:GREGORIAN', ...evenements, 'END:VCALENDAR', ''].join('\r\n');
  return { nom: `gamelle-rappels-${menu.semaine}.ics`, contenu };
}
