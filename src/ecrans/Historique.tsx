import { useLiveQuery } from 'dexie-react-hooks';
import { BASE } from '../app/base';
import { db } from '../app/db';
import { useReglages, useSemaines, useSemaineVue } from '../app/etat';
import { aller, lien, retour } from '../app/routeur';
import { libelleSemaine, lundiDeSemaine } from '../domain/dates';
import { recettesDuMenu } from '../domain/planner';
import type { Menu } from '../domain/types';
import { annoncer, BoutonIcone, Illustration } from '../ui/composants';

/** Copie un menu passé sur une autre semaine (mêmes plats, mêmes créneaux). */
async function refaire(menu: Menu, cible: string) {
  const lundi = lundiDeSemaine(cible);
  const copie: Menu = { ...menu, semaine: cible, lundi, relachements: [] };
  const avant = await db.menus.get(cible);
  const activite = (await db.coches.where('semaine').equals(cible).count()) + (await db.evenements.where('semaine').equals(cible).count());
  if (activite > 0 && !confirm('Tu as déjà commencé les courses ou la cuisine de cette semaine. Remplacer son menu quand même ?')) return false;
  await db.transaction('rw', db.menus, db.echanges, async () => {
    await db.menus.put({ semaine: cible, menu: copie, cle: avant?.cle ?? '', modifie: true, genere_le: new Date().toISOString() });
    if (avant) await db.echanges.add({ semaine: cible, quand: new Date().toISOString(), libelle: `Menu repris de la ${libelleSemaine(menu.lundi).toLowerCase()}`, avant: avant.menu, apres: copie });
  });
  return true;
}

export default function Historique() {
  const reglages = useReglages();
  const { courante, suivante } = useSemaines(reglages);
  const vue = useSemaineVue();
  const passes = useLiveQuery(async () => (await db.menus.where('semaine').below(courante).toArray()).sort((a, b) => b.semaine.localeCompare(a.semaine)), [courante]);
  if (!passes) return null;

  return (
    <main className="ecran" aria-labelledby="titre-historique">
      <div className="barre-retour">
        <BoutonIcone icone="retour" label="Retour" onClick={() => retour()} />
      </div>
      <h1 id="titre-historique" className="titre-page titre-page--moyen">
        Historique
      </h1>
      {passes.length === 0 && <p className="vide">Les menus des semaines passées apparaîtront ici.</p>}
      <ul className="historique">
        {passes.map(({ semaine, menu }) => {
          const ids = recettesDuMenu(menu);
          return (
            <li key={semaine} className="historique__semaine">
              <p className="kicker">{libelleSemaine(menu.lundi)}</p>
              <div className="historique__plats" aria-hidden="true">
                {ids.slice(0, 6).map((id) => BASE.parId[id] && <Illustration key={id} nom={BASE.parId[id].illustration} taille={36} />)}
              </div>
              <p className="historique__noms">{ids.map((id) => BASE.parId[id]?.nom).filter(Boolean).join(' · ')}</p>
              <div className="rangee-boutons rangee-boutons--serree">
                <button
                  className="btn btn--contour btn--petit"
                  onClick={() => {
                    vue.choisir(semaine);
                    aller(lien('semaine'));
                  }}
                >
                  Voir
                </button>
                <button
                  className="btn btn--plein btn--petit"
                  onClick={async () => {
                    if (!(await refaire(menu, suivante))) return;
                    vue.choisir(suivante);
                    annoncer('Menu repris pour la semaine prochaine.');
                    aller(lien('semaine'));
                  }}
                >
                  Refaire la semaine prochaine
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
