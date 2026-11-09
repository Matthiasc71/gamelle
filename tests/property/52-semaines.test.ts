/**
 * Tests de propriétés : 52 semaines d'affilée, stock et historique reportés.
 * Chaque semaine doit respecter toutes les règles dures. Les règles souples (saison, historique,
 * budget) ne peuvent être enfreintes que si le menu le dit explicitement dans `relachements`.
 */
import { describe, expect, it } from 'vitest';
import { violationsDures } from '../../src/domain/regles';
import { REGLAGES_DEFAUT } from '../../src/domain/types';
import { simuler } from '../../scripts/lib/simulation';
import { baseReelle } from '../helpers';

describe('52 semaines d’affilée', () => {
  const semaines = simuler(baseReelle(), REGLAGES_DEFAUT, '2026-W47', 52);

  it('génère 52 menus complets', () => {
    expect(semaines).toHaveLength(52);
    for (const s of semaines) {
      expect(s.menu.repas.map((r) => r.creneau)).toEqual([...Array(14).keys()]);
      for (const c of s.menu.cuissons) expect(s.menu.repas.filter((r) => r.cuissonId === c.id)).toHaveLength(c.parts);
    }
  });

  it('respecte toutes les règles dures chaque semaine', () => {
    for (const s of semaines) expect([s.menu.semaine, violationsDures(s.violations)]).toEqual([s.menu.semaine, []]);
  });

  it('n’assouplit saison, historique ou budget qu’en le signalant', () => {
    for (const s of semaines) {
      const notes = s.menu.relachements.join(' ');
      const codes = new Set(s.violations.map((v) => v.code));
      if (codes.has('saison')) expect(notes).toMatch(/hors saison/);
      if (codes.has('historique')) expect(notes).toMatch(/reviennent/);
      if (codes.has('budget')) expect(notes).toMatch(/Budget dépassé/);
    }
  });

  it('change de menu chaque semaine', () => {
    for (let i = 1; i < semaines.length; i++)
      expect(semaines[i].menu.repas.map((r) => r.recetteId)).not.toEqual(semaines[i - 1].menu.repas.map((r) => r.recetteId));
  });

  it('tient la session du dimanche sous 75 minutes', () => {
    for (const s of semaines) expect(s.session).toBeLessThanOrEqual(REGLAGES_DEFAUT.sessionBatchMax_min);
  });
});
