import { describe, expect, it } from 'vitest';
import { libelleJour, libelleSemaine, lundiDeSemaine, moisDeSemaine, semaineIso, semainesVisibles, semaineSuivante } from '../../src/domain/dates';
import { empreinte, hasard } from '../../src/domain/rng';

describe('semaines ISO', () => {
  it('calcule la semaine et son lundi', () => {
    expect(semaineIso('2026-11-16').cle).toBe('2026-W47');
    expect(semaineIso('2026-11-22').cle).toBe('2026-W47');
    expect(lundiDeSemaine('2026-W47')).toBe('2026-11-16');
    // 2026 compte 53 semaines (1er janvier un jeudi)
    expect(semaineIso('2026-12-31').cle).toBe('2026-W53');
    expect(semaineIso('2027-01-03').cle).toBe('2026-W53');
    expect(semaineIso('2027-01-04').cle).toBe('2027-W01');
    expect(semaineSuivante('2026-W53')).toBe('2027-W01');
    expect(lundiDeSemaine('2026-W01')).toBe('2025-12-29');
  });

  it('produit les libellés français', () => {
    expect(libelleSemaine('2026-11-16')).toBe('Du 16 au 22 novembre');
    expect(libelleSemaine('2026-11-30')).toBe('Du 30 novembre au 6 décembre');
    expect(libelleSemaine('2026-12-28')).toBe('Du 28 décembre 2026 au 3 janvier 2027');
    expect(libelleSemaine('2026-06-01')).toBe('Du 1er au 7 juin');
    expect(libelleJour('2026-11-16', 0)).toBe('lun. 16');
    expect(libelleJour('2026-11-16', -1)).toBe('dim. 15');
    expect(moisDeSemaine('2026-11-30')).toBe(12);
  });

  it('débloque la semaine suivante le samedi matin', () => {
    expect(semainesVisibles(new Date(2026, 10, 20, 12)).suivanteDebloquee).toBe(false); // vendredi
    expect(semainesVisibles(new Date(2026, 10, 21, 7)).suivanteDebloquee).toBe(false); // samedi 7 h
    expect(semainesVisibles(new Date(2026, 10, 21, 8)).suivanteDebloquee).toBe(true); // samedi 8 h
    expect(semainesVisibles(new Date(2026, 10, 22, 20))).toEqual({ courante: '2026-W47', suivante: '2026-W48', suivanteDebloquee: true });
    expect(semainesVisibles(new Date(2026, 10, 21, 8), 0).suivanteDebloquee).toBe(false); // réglé sur dimanche
  });
});

describe('hasard reproductible', () => {
  it('donne la même suite pour la même graine', () => {
    const a = hasard(empreinte('2026-W47'));
    const b = hasard(empreinte('2026-W47'));
    const c = hasard(empreinte('2026-W48'));
    const sa = [a.suivant(), a.suivant(), a.entier(1, 6)];
    expect([b.suivant(), b.suivant(), b.entier(1, 6)]).toEqual(sa);
    expect(c.suivant()).not.toBe(sa[0]);
  });

  it('respecte les poids et mélange sans perte', () => {
    const h = hasard(1);
    for (let i = 0; i < 50; i++) expect(h.choisir(['a', 'b'], [1, 0])).toBe('a');
    expect(h.melanger([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
});
