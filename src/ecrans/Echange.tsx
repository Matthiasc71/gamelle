import { useMemo, useState } from 'react';
import { BASE } from '../app/base';
import { annulerEchange, appliquerMenu, useContexte, useMenu, useReglages, useSemaineVue } from '../app/etat';
import { MOMENT } from '../app/presentation';
import { aller, lien, retour, useRoute } from '../app/routeur';
import { libelleJour, libelleSemaine } from '../domain/dates';
import { planEchange, proposerCreneaux, type PlanEchange } from '../domain/echange';
import { euros, kcal } from '../domain/format';
import type { ContexteMenu } from '../domain/regles';
import { estBatch } from '../domain/regles';
import type { Recette } from '../domain/schema';
import { jourDe, momentDe, NB_CRENEAUX, type Menu } from '../domain/types';
import { annoncer, BoutonIcone, Chargement, Illustration, Rubrique } from '../ui/composants';
import { Icone } from '../ui/Icone';

const libelleCreneau = (menu: Menu, c: number) => `${libelleJour(menu.lundi, jourDe(c))} ${momentDe(c)}`;

export default function Echange() {
  const { id } = useRoute();
  const r = id ? BASE.parId[id] : undefined;
  const reglages = useReglages();
  const { semaine } = useSemaineVue();
  const etat = useMenu(semaine, reglages);
  const ctx = useContexte(semaine, reglages);
  if (!r) return null;
  return (
    <main className="ecran" aria-labelledby="titre-echange">
      <div className="barre-retour">
        <BoutonIcone icone="retour" label="Retour" onClick={() => retour(lien('recette', r.id))} />
      </div>
      <p className="kicker">Mettre dans ma semaine</p>
      <h1 id="titre-echange" className="titre-page titre-page--moyen">
        {r.nom}
      </h1>
      {etat.etat === 'pret' && ctx ? <Choix r={r} menu={etat.menu} ctx={ctx} /> : <Chargement />}
    </main>
  );
}

function Choix({ r, menu, ctx }: { r: Recette; menu: Menu; ctx: ContexteMenu }) {
  const batch = estBatch(r);
  const plans = useMemo(() => proposerCreneaux(menu, r.id, ctx, 4), [menu, r.id, ctx]);
  const [plan, setPlan] = useState<PlanEchange | null>(null);
  const [manuel, setManuel] = useState<number[]>([]);
  const [jourCuisson, setJourCuisson] = useState(-1);
  const planManuel = useMemo(
    () => (manuel.length ? planEchange(menu, r.id, manuel, ctx, batch ? jourCuisson : undefined) : null),
    [manuel, menu, r.id, ctx, batch, jourCuisson],
  );

  const valider = async (p: PlanEchange) => {
    const id = await appliquerMenu(menu, p.menu, `${r.nom} dans ta semaine`);
    annoncer(`${r.nom} est dans ta semaine.`, { libelle: 'Annuler', faire: () => annulerEchange(id) });
    aller(lien('semaine'));
  };

  if (plan) return <Apercu plan={plan} menu={menu} valider={() => valider(plan)} annuler={() => setPlan(null)} />;

  return (
    <>
      <p className="texte-doux">
        {libelleSemaine(menu.lundi)} · {kcal(r.nutrition_par_part.kcal)} par part
        {batch && ` · ×${r.portions_base} parts : l’app remplit les créneaux, frigo J+3 au plus, le reste au congélateur`}
      </p>

      <section aria-labelledby="meilleurs">
        <Rubrique id="meilleurs">Les meilleurs créneaux</Rubrique>
        <ul className="plans">
          {plans.map((p) => (
            <li key={`${p.jourCuisson}|${p.creneaux.join()}`}>
              <button className="plan" onClick={() => setPlan(p)}>
                <span className="plan__creneaux">{p.creneaux.map((c) => libelleCreneau(menu, c)).join(' · ')}</span>
                {batch && <span className="texte-doux petit">Cuisiné {p.jourCuisson < 0 ? 'à la session du dimanche' : `${libelleJour(menu.lundi, p.jourCuisson)} soir`}</span>}
                <Compat p={p} />
                <span className="texte-doux petit">Retire : {p.retires.map((x) => BASE.parId[x.recetteId].nom).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="manuel">
        <Rubrique id="manuel">Ou choisis toi-même</Rubrique>
        {batch && (
          <label className="select select--large">
            <span>Jour de cuisson</span>
            <select value={jourCuisson} onChange={(e) => setJourCuisson(Number(e.target.value))}>
              <option value={-1}>Session du dimanche</option>
              {[0, 1, 2, 3, 4, 5].map((j) => (
                <option key={j} value={j}>
                  {libelleJour(menu.lundi, j)} soir
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grille-creneaux" role="group" aria-label="Créneaux de la semaine">
          {[...Array(NB_CRENEAUX).keys()].map((c) => {
            const actuel = BASE.parId[menu.repas.find((x) => x.creneau === c)!.recetteId];
            const choisi = manuel.includes(c);
            return (
              <button
                key={c}
                className="creneau"
                aria-pressed={choisi}
                onClick={() => setManuel((m) => (choisi ? m.filter((x) => x !== c) : batch ? [...m, c] : [c]))}
              >
                <span className="kicker">
                  {libelleJour(menu.lundi, jourDe(c))} · {MOMENT[momentDe(c)]}
                </span>
                <span className="creneau__nom">{actuel.nom}</span>
              </button>
            );
          })}
        </div>
        {planManuel && (
          <div className="plan plan--statique">
            <Compat p={planManuel} />
            <button className="btn btn--plein" onClick={() => setPlan(planManuel)}>
              Voir l’échange
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function Compat({ p }: { p: PlanEchange }) {
  const items: [boolean, string][] = [
    [p.compat.kcal, 'Calories'],
    [p.compat.budget, 'Budget'],
    [p.compat.conservation, 'Conservation'],
  ];
  return (
    <span className="compat">
      {items.map(([ok, nom]) => (
        <span key={nom} className={`compat__item ${ok ? '' : 'compat__item--ko'}`}>
          <Icone nom={ok ? 'coche' : 'attention'} taille={15} />
          {nom}
        </span>
      ))}
      <span className="compat__item">
        courses {p.deltaCout >= 0 ? '+' : '−'}
        {euros(Math.abs(p.deltaCout))}
      </span>
    </span>
  );
}

function Apercu({ plan, menu, valider, annuler }: { plan: PlanEchange; menu: Menu; valider: () => void; annuler: () => void }) {
  const r = BASE.parId[plan.recetteId];
  return (
    <section className="apercu" aria-labelledby="apercu">
      <Rubrique id="apercu">Avant de valider</Rubrique>
      <div className="apercu__ligne">
        <Illustration nom={r.illustration} taille={52} />
        <p>
          <strong>{r.nom}</strong> arrive {plan.creneaux.map((c) => libelleCreneau(menu, c)).join(', ')}.
        </p>
      </div>
      <p className="kicker">Plats retirés</p>
      <ul className="liste-simple">
        {plan.retires.map((x) => (
          <li key={x.creneau}>
            {BASE.parId[x.recetteId].nom}
            <span className="texte-doux petit">{libelleCreneau(menu, x.creneau)}</span>
          </li>
        ))}
      </ul>
      {plan.avertissements.length > 0 ? (
        <div className="note note--alerte">
          <p className="kicker">Attention</p>
          <ul>
            {plan.avertissements.map((v) => (
              <li key={v.message}>{v.message}</li>
            ))}
          </ul>
          <p className="petit">Tu peux valider quand même : c’est ton choix.</p>
        </div>
      ) : (
        <p className="note">
          <Icone nom="cercleCoche" taille={18} /> Toutes les règles restent respectées.
        </p>
      )}
      <p className="texte-doux">
        Courses de la semaine : {plan.deltaCout >= 0 ? '+' : '−'}
        {euros(Math.abs(plan.deltaCout))}. Le planning, la liste de courses et le frigo se mettent à jour.
      </p>
      <div className="rangee-boutons">
        <button className="btn btn--plein" onClick={valider}>
          Valider l’échange
        </button>
        <button className="btn btn--contour" onClick={annuler}>
          Changer
        </button>
      </div>
    </section>
  );
}
