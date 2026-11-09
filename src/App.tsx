import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { SemaineContexte, usePreferences, useReglages, useSemaines } from './app/etat';
import { aller, lien, useRoute } from './app/routeur';
import Semaine from './ecrans/Semaine';
import { Annonces, Chargement } from './ui/composants';
import { Icone, type NomIcone } from './ui/Icone';

const ONGLETS: { ecran: string; nom: string; icone: NomIcone }[] = [
  { ecran: 'semaine', nom: 'Semaine', icone: 'semaine' },
  { ecran: 'courses', nom: 'Courses', icone: 'courses' },
  { ecran: 'favoris', nom: 'Favoris', icone: 'favoris' },
  { ecran: 'frigo', nom: 'Frigo', icone: 'frigo' },
];

/** Onglet actif pour chaque écran (la fiche recette et les réglages dépendent de Semaine ou Favoris). */
function ongletDe(ecran: string, depuis: string | null) {
  if (ecran === 'recette' || ecran === 'echange') return depuis === 'favoris' || ecran === 'echange' ? 'favoris' : 'semaine';
  if (ecran === 'reglages' || ecran === 'session') return 'semaine';
  return ecran;
}

// Semaine est l'écran d'ouverture ; les autres se chargent à la demande (tous précachés pour le hors-ligne).
const ECRANS: Record<string, React.ComponentType> = {
  semaine: Semaine,
  recette: lazy(() => import('./ecrans/Recette')),
  courses: lazy(() => import('./ecrans/Courses')),
  favoris: lazy(() => import('./ecrans/Favoris')),
  frigo: lazy(() => import('./ecrans/Frigo')),
  echange: lazy(() => import('./ecrans/Echange')),
  session: lazy(() => import('./ecrans/Session')),
  cuisine: lazy(() => import('./ecrans/Cuisine')),
  reglages: lazy(() => import('./ecrans/Reglages')),
  accueil: lazy(() => import('./ecrans/Accueil')),
};

export default function App() {
  const route = useRoute();
  const prefs = usePreferences();
  const reglages = useReglages();
  const { courante } = useSemaines(reglages);
  const [semaine, choisir] = useState(courante);

  // L'accueil s'affiche une fois, au premier lancement (vérifié une seule fois par session).
  const accueilVerifie = useRef(false);
  useEffect(() => {
    if (!prefs || accueilVerifie.current) return;
    accueilVerifie.current = true;
    if (!prefs.accueilFait && route.ecran !== 'accueil') aller(lien('accueil'), true);
  }, [prefs, route.ecran]);

  useEffect(() => {
    document.documentElement.classList.toggle('sans-grain', prefs ? !prefs.grain : false);
  }, [prefs]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.ecran, route.id]);

  if (!prefs) return null;
  const Ecran = ECRANS[route.ecran] ?? Semaine;
  const plein = route.ecran === 'cuisine' || route.ecran === 'accueil';
  const actif = ongletDe(route.ecran, route.params.get('depuis'));

  return (
    <SemaineContexte.Provider value={{ semaine, choisir }}>
      <div className={`app ${plein ? 'app--plein' : ''}`}>
        <Suspense fallback={<Chargement />}>
          <Ecran key={route.ecran} />
        </Suspense>
        {!plein && (
          <nav className="onglets" aria-label="Navigation principale">
            {ONGLETS.map((o) => (
              <a key={o.ecran} href={lien(o.ecran)} className="onglet" aria-current={actif === o.ecran ? 'page' : undefined}>
                <Icone nom={o.icone} taille={24} />
                <span>{o.nom}</span>
              </a>
            ))}
          </nav>
        )}
        <Annonces />
      </div>
    </SemaineContexte.Provider>
  );
}
