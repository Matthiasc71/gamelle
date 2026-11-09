/** Formats français : « 1 010 kcal », « 0,99 € », « lun. 16 ». */

const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nfEur = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Intl utilise une espace fine insécable ; on la garde (elle ne coupe pas la ligne). */
export const kcal = (n: number) => `${nf0.format(Math.round(n))} kcal`;
export const euros = (n: number) => `${nfEur.format(n)} €`;

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
export const jourCourt = (d: Date) => `${JOURS[d.getDay()]} ${d.getDate()}`;
