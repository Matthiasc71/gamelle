import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/young-serif/latin-400.css';
import '@fontsource/bricolage-grotesque/latin-700.css';
import '@fontsource/bricolage-grotesque/latin-800.css';
import '@fontsource/schibsted-grotesk/latin-400.css';
import '@fontsource/schibsted-grotesk/latin-500.css';
import '@fontsource/schibsted-grotesk/latin-600.css';
import '@fontsource/schibsted-grotesk/latin-700.css';
import './styles/tokens.css';
import './styles/app.css';
import App from './App';
import { ajouterRecettesPerso } from './app/base';
import { db } from './app/db';
import { annoncer } from './ui/composants';

// les recettes ajoutées sur le téléphone rejoignent la base avant le premier affichage
await db.mesRecettes.toArray().then(ajouterRecettesPerso).catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker : hors ligne, et annonce quand une nouvelle version est prête.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const mettreAJour = registerSW({
      onNeedRefresh: () => annoncer('Une nouvelle version de Gamelle est prête.', { libelle: 'Recharger', faire: () => mettreAJour(true) }, 60000),
      onOfflineReady: () => annoncer('Gamelle marche maintenant sans réseau.'),
    });
  });
}
