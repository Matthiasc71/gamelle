/**
 * Import de la table Ciqual (Anses) → data/ciqual/ciqual-2025.min.json
 *
 * Source : Anses. Table de composition nutritionnelle des aliments Ciqual 2025.
 * Entrepôt Recherche Data Gouv, doi:10.57745/RDMHWY, licence Etalab 2.0.
 *
 * Usage : npm run ciqual            (télécharge si absent, puis convertit)
 *         npm run ciqual -- --force (retélécharge)
 */
import ExcelJS from 'exceljs';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'data/ciqual/raw/ciqual-2025.xlsx');
const OUT = join(ROOT, 'data/ciqual/ciqual-2025.min.json');
const DATASET_DOI = 'doi:10.57745/RDMHWY';
const API = 'https://entrepot.recherche.data.gouv.fr/api';

/** Colonnes utilisées (titres normalisés, sans retours à la ligne). */
const COLS = {
  code: 'alim_code',
  nom: 'alim_nom_fr',
  groupe: 'alim_ssgrp_nom_fr',
  kcal: 'Energie, Règlement UE N° 1169 2011 (kcal 100 g)',
  proteines: 'Protéines, N x facteur de Jones (g 100 g)',
  glucides: 'Glucides (g 100 g)',
  lipides: 'Lipides (g 100 g)',
  fibres: 'Fibres alimentaires (g 100 g)',
} as const;

export type CiqualValue = { v: number; qualif?: 'traces' | 'inf' | 'manquant' };

/**
 * Convertit une cellule Ciqual en nombre.
 * - "12,3" → 12.3
 * - "traces" → 0 (qualif traces)
 * - "< 0,5" → 0.25 (moitié du seuil, qualif inf) — convention documentée dans le README
 * - "-" ou vide → qualif manquant : stocké à null, un ingrédient sans kcal est refusé par validate
 */
export function parseCiqualCell(raw: unknown): CiqualValue {
  if (raw === null || raw === undefined) return { v: 0, qualif: 'manquant' };
  if (typeof raw === 'number') return { v: raw };
  const s = String(raw).trim();
  if (s === '' || s === '-') return { v: 0, qualif: 'manquant' };
  if (/^traces$/i.test(s)) return { v: 0, qualif: 'traces' };
  const inf = s.match(/^<\s*([\d,.]+)$/);
  if (inf) return { v: Number(inf[1].replace(',', '.')) / 2, qualif: 'inf' };
  const n = Number(s.replace(',', '.'));
  if (Number.isNaN(n)) throw new Error(`Valeur Ciqual illisible : "${s}"`);
  return { v: n };
}

async function download(force: boolean) {
  if (existsSync(RAW) && !force) return;
  mkdirSync(dirname(RAW), { recursive: true });
  const meta = (await (await fetch(`${API}/datasets/:persistentId/?persistentId=${DATASET_DOI}`)).json()) as {
    data: { latestVersion: { files: { dataFile: { id: number; filename: string } }[] } };
  };
  const files = meta.data.latestVersion.files;
  const xlsx = files.find((f) => f.dataFile.filename.endsWith('.xlsx'));
  if (!xlsx) throw new Error('Fichier XLSX introuvable dans le jeu de données Ciqual');
  console.log(`Téléchargement de ${xlsx.dataFile.filename}…`);
  const res = await fetch(`${API}/access/datafile/${xlsx.dataFile.id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  writeFileSync(RAW, Buffer.from(await res.arrayBuffer()));
}

const norm = (s: unknown) => String(s ?? '').replace(/[\n/]+/g, ' ').replace(/\s+/g, ' ').trim();

async function main() {
  await download(process.argv.includes('--force'));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(RAW);
  const ws = wb.worksheets[0];
  const header = (ws.getRow(1).values as unknown[]).map(norm);
  const idx = Object.fromEntries(
    Object.entries(COLS).map(([k, title]) => {
      const i = header.indexOf(norm(title));
      if (i < 0) throw new Error(`Colonne absente : ${title}`);
      return [k, i];
    }),
  ) as Record<keyof typeof COLS, number>;

  /** code → [nom, groupe, kcal, prot, gluc, lip, fibres] (pour 100 g ; null = valeur absente de Ciqual) */
  const out: Record<string, [string, string, ...(number | null)[]]> = {};
  let manquants = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r).values as unknown[];
    const code = norm(row[idx.code]);
    if (!code) continue;
    const vals = (['kcal', 'proteines', 'glucides', 'lipides', 'fibres'] as const).map((k) => {
      const p = parseCiqualCell(row[idx[k]]);
      if (p.qualif === 'manquant') {
        manquants++;
        return null;
      }
      return Math.round(p.v * 100) / 100;
    });
    out[code] = [norm(row[idx.nom]), norm(row[idx.groupe]), ...vals];
  }
  writeFileSync(
    OUT,
    JSON.stringify({
      source: 'Anses. Table de composition nutritionnelle des aliments Ciqual 2025',
      doi: DATASET_DOI,
      licence: 'Etalab 2.0',
      version: '2025-11-03',
      colonnes: ['nom', 'groupe', 'kcal', 'proteines_g', 'glucides_g', 'lipides_g', 'fibres_g'],
      aliments: out,
    }),
  );
  console.log(`${Object.keys(out).length} aliments écrits dans ${OUT} (${manquants} valeurs absentes, stockées à null)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
