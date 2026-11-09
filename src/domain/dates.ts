/**
 * Dates « civiles » au format AAAA-MM-JJ, calculées en UTC pour éviter les surprises de fuseau.
 * Semaines ISO 8601 (lundi → dimanche), clé « 2026-W47 ».
 */

const JOUR_MS = 86_400_000;

export const versDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const versIso = (d: Date) => d.toISOString().slice(0, 10);
export const ajouterJours = (iso: string, n: number) => versIso(new Date(versDate(iso).getTime() + n * JOUR_MS));
export const ecartJours = (a: string, b: string) => Math.round((versDate(b).getTime() - versDate(a).getTime()) / JOUR_MS);

/** Date locale du téléphone au format AAAA-MM-JJ. */
export function aujourdhuiLocal(maintenant = new Date()): string {
  const m = String(maintenant.getMonth() + 1).padStart(2, '0');
  const j = String(maintenant.getDate()).padStart(2, '0');
  return `${maintenant.getFullYear()}-${m}-${j}`;
}

/** Semaine ISO d'une date AAAA-MM-JJ. */
export function semaineIso(iso: string): { annee: number; semaine: number; cle: string } {
  const d = versDate(iso);
  const jour = (d.getUTCDay() + 6) % 7; // 0 = lundi
  const jeudi = new Date(d.getTime() + (3 - jour) * JOUR_MS);
  const annee = jeudi.getUTCFullYear();
  const jourDeLAnnee = Math.round((jeudi.getTime() - Date.UTC(annee, 0, 1)) / JOUR_MS);
  const semaine = 1 + Math.floor(jourDeLAnnee / 7);
  return { annee, semaine, cle: `${annee}-W${String(semaine).padStart(2, '0')}` };
}

/** Lundi (AAAA-MM-JJ) d'une semaine « 2026-W47 ». */
export function lundiDeSemaine(cle: string): string {
  const m = cle.match(/^(\d{4})-W(\d{2})$/);
  if (!m) throw new Error(`Semaine invalide : ${cle}`);
  const annee = Number(m[1]);
  const semaine = Number(m[2]);
  const quatreJanvier = Date.UTC(annee, 0, 4);
  const jour = (new Date(quatreJanvier).getUTCDay() + 6) % 7;
  const lundiS1 = quatreJanvier - jour * JOUR_MS;
  return versIso(new Date(lundiS1 + (semaine - 1) * 7 * JOUR_MS));
}

export const semaineSuivante = (cle: string, n = 1) => semaineIso(ajouterJours(lundiDeSemaine(cle), 7 * n)).cle;

/**
 * Semaine à afficher et état de déblocage de la suivante.
 * La semaine suivante se débloque le jour `jourDeblocage` (0 = dimanche … 6 = samedi) à `heureDeblocage`.
 */
export function semainesVisibles(maintenant: Date, jourDeblocage = 6, heureDeblocage = 8) {
  const iso = aujourdhuiLocal(maintenant);
  const courante = semaineIso(iso).cle;
  const jour = maintenant.getDay();
  // jours écoulés depuis lundi (0..6) et position du jour de déblocage dans la semaine
  const depuisLundi = (jour + 6) % 7;
  const deblocageDepuisLundi = (jourDeblocage + 6) % 7;
  const debloquee =
    depuisLundi > deblocageDepuisLundi || (depuisLundi === deblocageDepuisLundi && maintenant.getHours() >= heureDeblocage);
  return { courante, suivante: semaineSuivante(courante), suivanteDebloquee: debloquee };
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS_COURTS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

/** « Du 16 au 22 novembre », « Du 30 novembre au 6 décembre », « Du 28 décembre 2026 au 3 janvier 2027 ». */
export function libelleSemaine(lundi: string): string {
  const a = versDate(lundi);
  const b = versDate(ajouterJours(lundi, 6));
  const ja = a.getUTCDate() === 1 ? '1er' : String(a.getUTCDate());
  const jb = b.getUTCDate() === 1 ? '1er' : String(b.getUTCDate());
  if (a.getUTCFullYear() !== b.getUTCFullYear())
    return `Du ${ja} ${MOIS[a.getUTCMonth()]} ${a.getUTCFullYear()} au ${jb} ${MOIS[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
  if (a.getUTCMonth() !== b.getUTCMonth()) return `Du ${ja} ${MOIS[a.getUTCMonth()]} au ${jb} ${MOIS[b.getUTCMonth()]}`;
  return `Du ${ja} au ${jb} ${MOIS[b.getUTCMonth()]}`;
}

/** « lun. 16 » pour le jour `jour` (0 = lundi, -1 = dimanche précédent) de la semaine. */
export function libelleJour(lundi: string, jour: number): string {
  const d = versDate(ajouterJours(lundi, jour));
  return `${jour < 0 ? 'dim.' : JOURS_COURTS[jour]} ${d.getUTCDate()}`;
}

/** Mois (1–12) du jeudi de la semaine : sert à la saisonnalité. */
export const moisDeSemaine = (lundi: string) => versDate(ajouterJours(lundi, 3)).getUTCMonth() + 1;
