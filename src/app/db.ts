/**
 * Données locales (IndexedDB via Dexie). Rien ne quitte le téléphone.
 *
 * - kv : réglages, accueil terminé, préférences d'affichage ;
 * - favoris : recettes gardées avec le bouton + ;
 * - menus : menu de chaque semaine (généré puis éventuellement modifié) ;
 * - coches : articles cochés dans la liste de courses ;
 * - evenements : journal du frigo (achats, cuisine, repas mangés, corrections) ;
 * - prix : prix de paquet corrigés à la main ;
 * - echanges : historique des échanges et remplacements (pour « Annuler »).
 */
import Dexie, { type Table } from 'dexie';
import type { Evenement } from '../domain/frigo';
import type { Menu } from '../domain/types';

export type MenuStocke = {
  semaine: string;
  menu: Menu;
  /** Empreinte des réglages utilisés pour générer le menu. */
  cle: string;
  modifie: boolean;
  genere_le: string;
};

export type Origine = 'courses' | 'deja' | 'cuisine' | 'mange' | 'manuel';

export type EvenementStocke = {
  id?: number;
  quand: string;
  semaine: string;
  origine: Origine;
  /** Ingrédient (courses, déjà au frigo), id de cuisson (cuisine) ou créneau (mangé). */
  cle: string;
  ev: Evenement;
};

export type Coche = { cle: string; semaine: string; ingredient: string };
export type Favori = { id: string; ajoute_le: string };
export type PrixCorrige = { ingredient: string; prix: number };
export type Echange = { id?: number; semaine: string; quand: string; libelle: string; avant: Menu; apres: Menu };

class GamelleDB extends Dexie {
  kv!: Table<{ cle: string; valeur: unknown }, string>;
  favoris!: Table<Favori, string>;
  menus!: Table<MenuStocke, string>;
  coches!: Table<Coche, string>;
  evenements!: Table<EvenementStocke, number>;
  prix!: Table<PrixCorrige, string>;
  echanges!: Table<Echange, number>;

  constructor() {
    super('gamelle');
    this.version(1).stores({
      kv: 'cle',
      favoris: 'id',
      menus: 'semaine',
      coches: 'cle, semaine',
      evenements: '++id, semaine, origine, [semaine+origine+cle]',
      prix: 'ingredient',
      echanges: '++id, semaine',
    });
  }
}

export const db = new GamelleDB();

export const TABLES = ['kv', 'favoris', 'menus', 'coches', 'evenements', 'prix', 'echanges'] as const;

/** Sauvegarde complète en JSON (Réglages → Exporter). */
export async function exporter(): Promise<string> {
  const contenu: Record<string, unknown[]> = {};
  for (const t of TABLES) contenu[t] = await db.table(t).toArray();
  return JSON.stringify({ app: 'gamelle', version: 1, exporte_le: new Date().toISOString(), tables: contenu }, null, 1);
}

/** Restauration : remplace toutes les données locales par celles de la sauvegarde. */
export async function importer(texte: string): Promise<void> {
  const data = JSON.parse(texte) as { app?: string; tables?: Record<string, unknown[]> };
  if (data.app !== 'gamelle' || !data.tables) throw new Error('Ce fichier n’est pas une sauvegarde Gamelle.');
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      const lignes = data.tables![t];
      if (Array.isArray(lignes) && lignes.length) await db.table(t).bulkAdd(lignes);
    }
  });
}
