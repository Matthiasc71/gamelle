import { useRef, useState } from 'react';
import { BASE, PRIX_RELEVES_LE } from '../app/base';
import { exporter, importer } from '../app/db';
import { enregistrerPreferences, enregistrerReglages, usePreferences, useReglages } from '../app/etat';
import { NOM_EQUIPEMENT } from '../app/presentation';
import { aller, lien, retour } from '../app/routeur';
import { EQUIPEMENTS } from '../domain/constantes';
import { REGLAGES_DEFAUT, type Reglages as TReglages } from '../domain/types';
import { annoncer, BoutonIcone, Compteur, Interrupteur, Rubrique } from '../ui/composants';
import { Icone } from '../ui/Icone';

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function ChampNombre({ label, valeur, min, max, unite, onChange }: { label: string; valeur: number; min: number; max: number; unite?: string; onChange: (v: number) => void }) {
  const [texte, setTexte] = useState(String(valeur));
  const valider = () => {
    const v = Math.round(Number(texte.replace(',', '.')));
    if (Number.isFinite(v) && v >= min && v <= max) onChange(v);
    else {
      setTexte(String(valeur));
      annoncer(`${label} : entre ${min} et ${max}.`);
    }
  };
  return (
    <label className="champ">
      <span>{label}</span>
      <span className="champ__saisie">
        <input inputMode="numeric" value={texte} onChange={(e) => setTexte(e.target.value)} onBlur={valider} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
        {unite && <span>{unite}</span>}
      </span>
    </label>
  );
}

function Fourchette({ label, valeur, min, max, unite, onChange }: { label: string; valeur: [number, number]; min: number; max: number; unite: string; onChange: (v: [number, number]) => void }) {
  return (
    <fieldset className="fourchette">
      <legend>{label}</legend>
      <ChampNombre label="de" valeur={valeur[0]} min={min} max={valeur[1]} unite={unite} onChange={(v) => onChange([v, valeur[1]])} />
      <ChampNombre label="à" valeur={valeur[1]} min={valeur[0]} max={max} unite={unite} onChange={(v) => onChange([valeur[0], v])} />
    </fieldset>
  );
}

export default function Reglages() {
  const r = useReglages();
  const prefs = usePreferences();
  const fichier = useRef<HTMLInputElement>(null);
  const [exclusQ, setExclusQ] = useState('');
  if (!r || !prefs) return null;
  const maj = (p: Partial<TReglages>) => enregistrerReglages(p);
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const propositions = exclusQ
    ? Object.entries(BASE.catalogue)
        .filter(([id, c]) => !r.exclus.includes(id) && norm(c.nom).includes(norm(exclusQ)))
        .slice(0, 6)
    : [];

  return (
    <main className="ecran" aria-labelledby="titre-reglages">
      <div className="barre-retour">
        <BoutonIcone icone="retour" label="Retour" onClick={() => retour()} />
      </div>
      <p className="kicker">Réglages</p>
      <h1 id="titre-reglages" className="titre-page">
        Mon profil
      </h1>
      <p className="texte-doux petit">Les changements s’appliquent aux prochains menus. Tout reste sur ce téléphone.</p>

      <section aria-labelledby="r-calories" className="groupe">
        <Rubrique id="r-calories">Calories et protéines</Rubrique>
        <Fourchette label="Déjeuner + dîner, par jour" valeur={r.kcalJour} min={600} max={2500} unite="kcal" onChange={(v) => maj({ kcalJour: v })} />
        <Fourchette label="Par repas" valeur={r.kcalRepas} min={250} max={1200} unite="kcal" onChange={(v) => maj({ kcalRepas: v })} />
        <ChampNombre label="kcal libres (petit-déj, en-cas)" valeur={r.kcalLibres} min={0} max={1500} unite="kcal" onChange={(v) => maj({ kcalLibres: v })} />
        <ChampNombre label="Protéines par repas, au moins" valeur={r.protRepasMin} min={0} max={80} unite="g" onChange={(v) => maj({ protRepasMin: v })} />
      </section>

      <section aria-labelledby="r-budget" className="groupe">
        <Rubrique id="r-budget">Budget et repas</Rubrique>
        <Fourchette label="Budget courses par semaine" valeur={r.budget} min={10} max={200} unite="€" onChange={(v) => maj({ budget: v, budgetCible: Math.min(Math.max(r.budgetCible, v[0]), v[1]) })} />
        <ChampNombre label="Budget visé" valeur={r.budgetCible} min={r.budget[0]} max={r.budget[1]} unite="€" onChange={(v) => maj({ budgetCible: v })} />
        <div className="champ">
          <span>Personnes</span>
          <Compteur valeur={r.personnes} min={1} max={6} label="Nombre de personnes" onChange={(v) => maj({ personnes: v })} />
        </div>
        <p className="texte-doux petit">Repas planifiés : déjeuner et dîner, 7 jours (14 repas). Ville : Lyon (prix Lidl, Aldi et Open Prices).</p>
      </section>

      <section aria-labelledby="r-cuisine" className="groupe">
        <Rubrique id="r-cuisine">Cuisine</Rubrique>
        <fieldset className="cases">
          <legend>Équipement</legend>
          {EQUIPEMENTS.map((e) => (
            <label key={e} className="case">
              <input
                type="checkbox"
                checked={r.equipement.includes(e)}
                onChange={(ev) => maj({ equipement: ev.target.checked ? [...r.equipement, e] : r.equipement.filter((x) => x !== e) })}
              />
              <span className="case__boite" aria-hidden="true">
                <Icone nom="coche" taille={16} />
              </span>
              {NOM_EQUIPEMENT[e]}
            </label>
          ))}
        </fieldset>
        <ChampNombre label="Session batch du dimanche, au plus" valeur={r.sessionBatchMax_min} min={30} max={180} unite="min" onChange={(v) => maj({ sessionBatchMax_min: v })} />
        <ChampNombre label="Soirs de cuisine en semaine, au plus" valeur={r.soirsCuisineMax} min={0} max={5} onChange={(v) => maj({ soirsCuisineMax: v })} />
        <div className="champ">
          <span>Aliments exclus</span>
        </div>
        <div className="puces">
          {r.exclus.length === 0 && <span className="texte-doux petit">Aucun.</span>}
          {r.exclus.map((id) => (
            <button key={id} className="puce puce--rose puce--bouton" onClick={() => maj({ exclus: r.exclus.filter((x) => x !== id) })} aria-label={`Ne plus exclure ${BASE.catalogue[id]?.nom ?? id}`}>
              {BASE.catalogue[id]?.nom ?? id} <Icone nom="fermer" taille={14} />
            </button>
          ))}
        </div>
        <label className="champ-recherche">
          <Icone nom="chercher" taille={18} />
          <input type="search" value={exclusQ} onChange={(e) => setExclusQ(e.target.value)} placeholder="Exclure un aliment…" aria-label="Exclure un aliment" />
        </label>
        {propositions.length > 0 && (
          <ul className="liste-choix">
            {propositions.map(([id, c]) => (
              <li key={id}>
                <button
                  onClick={() => {
                    maj({ exclus: [...r.exclus, id] });
                    setExclusQ('');
                  }}
                >
                  {c.nom}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="r-menu" className="groupe">
        <Rubrique id="r-menu">Menu</Rubrique>
        <label className="champ">
          <span>Menu suivant débloqué le</span>
          <span className="champ__saisie">
            <select value={r.jourDeblocage} onChange={(e) => maj({ jourDeblocage: Number(e.target.value) })}>
              {JOURS.map((j, i) => (
                <option key={j} value={i}>
                  {j}
                </option>
              ))}
            </select>
            <select value={r.heureDeblocage} onChange={(e) => maj({ heureDeblocage: Number(e.target.value) })} aria-label="Heure de déblocage">
              {[...Array(24).keys()].map((h) => (
                <option key={h} value={h}>
                  {h} h
                </option>
              ))}
            </select>
          </span>
        </label>
        <Interrupteur label="Inclure mes favoris" aide="1 à 2 favoris par semaine dans les prochains menus." actif={r.favorisInclus} onChange={(v) => maj({ favorisInclus: v })} />
        <Interrupteur label="Grain du papier" aide="Texture imprimée sur tout l’écran." actif={prefs.grain} onChange={(v) => enregistrerPreferences({ grain: v })} />
        <button
          className="lien-bouton"
          onClick={async () => {
            await enregistrerReglages(REGLAGES_DEFAUT);
            annoncer('Réglages par défaut remis.');
          }}
        >
          Remettre les réglages par défaut
        </button>
      </section>

      <section aria-labelledby="r-sauvegarde" className="groupe">
        <Rubrique id="r-sauvegarde">Sauvegarde</Rubrique>
        <p className="texte-doux petit">Favoris, menus, coches, frigo et réglages dans un fichier JSON, à garder dans Fichiers ou iCloud Drive.</p>
        <div className="rangee-boutons">
          <button
            className="btn btn--contour"
            onClick={async () => {
              const blob = new Blob([await exporter()], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `gamelle-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            }}
          >
            <Icone nom="telecharger" taille={18} /> Exporter
          </button>
          <button className="btn btn--contour" onClick={() => fichier.current?.click()}>
            <Icone nom="envoyer" taille={18} /> Restaurer
          </button>
          <input
            ref={fichier}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (!confirm('Remplacer toutes les données de l’app par celles de la sauvegarde ?')) return;
              try {
                await importer(await f.text());
                annoncer('Sauvegarde restaurée.');
              } catch (err) {
                annoncer((err as Error).message || 'Fichier illisible.');
              }
            }}
          />
        </div>
      </section>

      <section aria-labelledby="r-credits" className="groupe credits">
        <Rubrique id="r-credits">Crédits et sources</Rubrique>
        <ul>
          <li>
            {BASE.recettes.length} recettes adaptées de sources publiques vérifiées, créditées sur chaque fiche. Étapes reformulées par Gamelle.
          </li>
          <li>
            Calories : table Ciqual 2025 de l’Anses (licence Etalab 2.0,{' '}
            <a href="https://doi.org/10.57745/RDMHWY" target="_blank" rel="noopener noreferrer">
              doi:10.57745/RDMHWY
            </a>
            ).
          </li>
          <li>
            Prix : relevés Open Prices (Open Food Facts, licence ODbL) en magasins Lidl et à Lyon, prix affichés sur aldi.fr ; grille relevée le{' '}
            {PRIX_RELEVES_LE ? new Date(PRIX_RELEVES_LE).toLocaleDateString('fr-FR') : '—'}.
          </li>
          <li>Polices Young Serif, Bricolage Grotesque et Schibsted Grotesk (SIL Open Font License), incluses dans l’app.</li>
          <li>Illustrations dessinées pour Gamelle. Aucune photo de blog ou de réseau social.</li>
          <li>Pas de compte, pas de pisteur, aucune donnée envoyée.</li>
        </ul>
        <button
          className="lien-bouton"
          onClick={async () => {
            await enregistrerPreferences({ accueilFait: false });
            aller(lien('accueil'));
          }}
        >
          Revoir l’accueil
        </button>
      </section>
    </main>
  );
}
