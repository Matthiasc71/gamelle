import { useState } from 'react';
import { enregistrerPreferences, enregistrerReglages, useReglages } from '../app/etat';
import { NOM_EQUIPEMENT } from '../app/presentation';
import { aller, lien } from '../app/routeur';
import { EQUIPEMENTS } from '../domain/schema';
import { Brin, Chiffre, Illustration } from '../ui/composants';
import { Icone } from '../ui/Icone';

/** Accueil en 3 écrans : présentation, réglages essentiels, installation sur l'iPhone. */
export default function Accueil() {
  const [page, setPage] = useState(0);
  const r = useReglages();
  if (!r) return null;
  const finir = async () => {
    await enregistrerPreferences({ accueilFait: true });
    aller(lien('semaine'), true);
  };

  return (
    <main className="accueil" aria-labelledby="titre-accueil">
      <p className="accueil__pages" aria-label={`Écran ${page + 1} sur 3`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={i === page ? 'actif' : ''} />
        ))}
      </p>

      {page === 0 && (
        <section className="accueil__page">
          <Brin className="accueil__brin" />
          <p className="kicker">Bienvenue</p>
          <h1 id="titre-accueil" className="titre-page titre-page--grand">
            Gamelle
          </h1>
          <p className="accueil__intro">Chaque semaine, un menu déjeuner + dîner léger, pas cher, cuisiné en grande partie le dimanche.</p>
          <div className="accueil__illus">
            <Illustration nom="curry-bol" taille={150} />
            <Illustration nom="salade" taille={110} />
          </div>
          <ul className="accueil__points">
            <li>De vraies recettes, chacune liée à sa source (blog, TikTok, Instagram).</li>
            <li>Calories recalculées avec la table Ciqual de l’Anses.</li>
            <li>Prix des supermarchés de Lyon, liste de courses par rayon.</li>
            <li>Tout reste sur ton téléphone. Pas de compte.</li>
          </ul>
        </section>
      )}

      {page === 1 && (
        <section className="accueil__page">
          <p className="kicker">L’essentiel</p>
          <h1 id="titre-accueil" className="titre-page">
            Tes repères
          </h1>
          <div className="accueil__chiffres">
            <div>
              <Chiffre taille="l">
                {r.kcalJour[0]}–{r.kcalJour[1]}
              </Chiffre>
              <span>kcal par jour pour le déjeuner et le dîner, ~{r.kcalLibres} kcal libres en plus</span>
            </div>
            <div>
              <Chiffre taille="l">
                {r.budget[0]}–{r.budget[1]} €
              </Chiffre>
              <span>de courses par semaine</span>
            </div>
          </div>
          <fieldset className="cases">
            <legend>Ton équipement</legend>
            {EQUIPEMENTS.map((e) => (
              <label key={e} className="case">
                <input
                  type="checkbox"
                  checked={r.equipement.includes(e)}
                  onChange={(ev) => enregistrerReglages({ equipement: ev.target.checked ? [...r.equipement, e] : r.equipement.filter((x) => x !== e) })}
                />
                <span className="case__boite" aria-hidden="true">
                  <Icone nom="coche" taille={16} />
                </span>
                {NOM_EQUIPEMENT[e]}
              </label>
            ))}
          </fieldset>
          <p className="texte-doux">Tout se change ensuite dans les Réglages, depuis l’onglet Semaine.</p>
        </section>
      )}

      {page === 2 && (
        <section className="accueil__page">
          <p className="kicker">Sur l’iPhone</p>
          <h1 id="titre-accueil" className="titre-page">
            Installer Gamelle
          </h1>
          <ol className="accueil__etapes">
            <li>
              <span className="etapes__num">1</span>
              <span>Ouvre cette page dans <strong>Safari</strong>.</span>
            </li>
            <li>
              <span className="etapes__num">2</span>
              <span>
                Touche <strong>Partager</strong> <Icone nom="partager" taille={18} /> en bas de l’écran.
              </span>
            </li>
            <li>
              <span className="etapes__num">3</span>
              <span>
                Choisis <strong>« Sur l’écran d’accueil »</strong>, puis <strong>Ajouter</strong>.
              </span>
            </li>
          </ol>
          <p className="texte-doux">Gamelle s’ouvre alors en plein écran et marche sans réseau au supermarché.</p>
        </section>
      )}

      <div className="accueil__nav">
        {page > 0 ? (
          <button className="btn btn--contour" onClick={() => setPage(page - 1)}>
            Retour
          </button>
        ) : (
          <button className="btn btn--contour" onClick={finir}>
            Passer
          </button>
        )}
        {page < 2 ? (
          <button className="btn btn--plein" onClick={() => setPage(page + 1)}>
            Suivant
          </button>
        ) : (
          <button className="btn btn--plein" onClick={finir}>
            Voir mon menu
          </button>
        )}
      </div>
    </main>
  );
}
