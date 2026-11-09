/**
 * Icônes au trait dessinées pour Gamelle : 24 × 24, trait 1,75 px, extrémités arrondies,
 * jamais pleines (cahier des charges § 8.4).
 */
const TRACES = {
  semaine: 'M4 6.5h16v13.5H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4M8 14h2M12 14h2M16 14h0.01M8 17h2',
  courses: 'M5 9h14l-1.4 10.2a1.5 1.5 0 0 1-1.5 1.3H7.9a1.5 1.5 0 0 1-1.5-1.3zM8.5 9 12 3.8 15.5 9M10 13v4M14 13v4',
  favoris: 'M12 20s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7.3 4.2 4.2 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z',
  frigo: 'M6.5 3h11v18h-11zM6.5 10h11M9.5 6v1.6M9.5 13v2.6',
  retour: 'M14.5 5.5 8 12l6.5 6.5',
  suivant: 'M9.5 5.5 16 12l-6.5 6.5',
  plus: 'M12 5v14M5 12h14',
  moins: 'M5 12h14',
  fermer: 'M6 6l12 12M18 6 6 18',
  horloge: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  lecture: 'M8 5.5v13l10-6.5z',
  article: 'M6.5 3.5h7.5l4 4v13h-11.5zM14 3.5v4h4M9.5 12h5M9.5 15.5h5',
  coche: 'M5 12.5 9.8 17 19 7.5',
  cercleCoche: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.3l2.8 2.7L16 9.6',
  attention: 'M12 4 21 19.5H3zM12 10v4.5M12 17.2v0.01',
  partager: 'M12 3.5v11M8 7.2l4-3.7 4 3.7M6.5 11H5v9.5h14V11h-1.5',
  copier: 'M8.5 8.5h11v11h-11zM15.5 8.5v-4h-11v11h4',
  reglages: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.8v4.4M9 14.8v4.4',
  poubelle: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5',
  boite: 'M3.5 9h17v9.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5zM5.5 9V7a1.5 1.5 0 0 1 1.5-1.5h10A1.5 1.5 0 0 1 18.5 7v2M9.5 13h5',
  flocon: 'M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.5 4.5 12 6.5l2.5-2M9.5 19.5 12 17.5l2.5 2',
  minuteur: 'M12 21a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM12 10v3.8M10 2.8h4M18.3 6.6l1.3-1.3',
  crayon: 'M4.5 19.5 5.5 15 15.8 4.7a2 2 0 0 1 2.8 0l0.7 0.7a2 2 0 0 1 0 2.8L9 18.5zM14 6.5l3.5 3.5',
  echange: 'M7 4.5 4 7.5l3 3M4 7.5h12.5M17 13.5l3 3-3 3M20 16.5H7.5',
  chercher: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM15.5 15.5 20 20',
  feu: 'M12 21c-3.6 0-6-2.4-6-5.6 0-3.8 3.4-5.4 3.4-9.4 2.9 1.5 4.2 3.6 4.2 5.8 0.9-0.6 1.5-1.6 1.6-2.8 1.6 1.4 2.8 3.6 2.8 6.4 0 3.2-2.4 5.6-6 5.6z',
  telecharger: 'M12 4v11M7.5 10.8 12 15.2l4.5-4.4M5 19.5h14',
  envoyer: 'M12 15V4M7.5 8.2 12 3.8l4.5 4.4M5 19.5h14',
  maison: 'M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z',
  feuille: 'M5 19c0-8 5-13 14-14-0.5 9-5.5 14-14 14zM5 19l8.5-8.5',
} as const;

export type NomIcone = keyof typeof TRACES;

export function Icone({ nom, taille = 22, className }: { nom: NomIcone; taille?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={TRACES[nom]} />
    </svg>
  );
}
