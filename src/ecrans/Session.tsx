import { useMemo } from 'react';
import { BASE } from '../app/base';
import { useMenu, useReglages, useSemaineVue } from '../app/etat';
import { NOM_EQUIPEMENT } from '../app/presentation';
import { lien, retour, useRoute } from '../app/routeur';
import { libelleJour } from '../domain/dates';
import { detailsRepas, sessionDimanche } from '../domain/regles';
import { CAPACITES, type Timeline } from '../domain/timeline';
import type { Menu } from '../domain/types';
import { BoutonIcone, Chargement, Chiffre, Rubrique } from '../ui/composants';

export const TEINTES = ['var(--menthe)', 'var(--rose)', 'var(--abricot)', 'var(--sauge)'];

export default function Session() {
  const { params } = useRoute();
  const vue = useSemaineVue();
  const semaine = params.get('s') ?? vue.semaine;
  const reglages = useReglages();
  const etat = useMenu(semaine, reglages);
  return (
    <main className="ecran" aria-labelledby="titre-session">
      <div className="barre-retour">
        <BoutonIcone icone="retour" label="Retour" onClick={() => retour()} />
      </div>
      {etat.etat === 'pret' ? <Contenu menu={etat.menu} /> : <Chargement />}
    </main>
  );
}

function Contenu({ menu }: { menu: Menu }) {
  const t = useMemo(() => sessionDimanche(menu, BASE), [menu]);
  const cuissons = menu.cuissons.filter((c) => c.jour < 0 && !c.stock);
  const details = detailsRepas(menu, BASE);
  const teinte = (id: string) => TEINTES[cuissons.findIndex((c) => c.recetteId === id) % TEINTES.length];

  return (
    <>
      <p className="kicker">Session batch · semaine {Number(menu.semaine.slice(-2))}</p>
      <h1 id="titre-session" className="titre-page titre-page--moyen">
        {libelleJour(menu.lundi, -1).replace('dim.', 'Dimanche')}
      </h1>
      <div className="session__chiffres">
        <div>
          <Chiffre taille="l">{t.duree}</Chiffre>
          <span>min en tout</span>
        </div>
        <div>
          <Chiffre taille="l">{t.tempsActif}</Chiffre>
          <span>min les mains occupées</span>
        </div>
      </div>

      <div className="puces">
        {cuissons.map((c) => {
          const ds = details.filter((d) => d.cuisson.id === c.id);
          const congel = ds.filter((d) => d.statut === 'congele').length;
          return (
            <span key={c.id} className="puce puce--contour">
              <span className="pastille" style={{ background: teinte(c.recetteId) }} aria-hidden="true" />
              {BASE.parId[c.recetteId].nom} ×{c.parts}
              {congel ? ` (${congel} congelée${congel > 1 ? 's' : ''})` : ''}
            </span>
          );
        })}
      </div>

      <Couloirs t={t} teinte={teinte} />

      <section aria-labelledby="deroule">
        <Rubrique id="deroule">Le déroulé, minute par minute</Rubrique>
        <ol className="timeline">
          {[...t.etapes]
            .sort((a, b) => a.debut - b.debut || a.recetteId.localeCompare(b.recetteId))
            .map((e) => (
              <li key={`${e.recetteId}-${e.index}`} className="timeline__etape">
                <span className="timeline__minute">{Math.round(e.debut)}′</span>
                <span className="timeline__pastille" style={{ background: teinte(e.recetteId) }} aria-hidden="true" />
                <div>
                  <p className="kicker">{BASE.parId[e.recetteId].nom}</p>
                  <p>{e.texte}</p>
                  <p className="etapes__meta">
                    {Math.round(e.fin - e.debut)} min{e.equipement ? ` · ${NOM_EQUIPEMENT[e.equipement]}` : ''}
                    {e.enFond ? ' · tourne en fond' : !e.actif ? ' · ça cuit tout seul' : ''}
                  </p>
                </div>
              </li>
            ))}
        </ol>
      </section>

      <div className="barre-actions">
        <a className="btn btn--plein" href={lien('cuisine', 'session', { s: menu.semaine })}>
          Lancer en mode cuisine
        </a>
      </div>
    </>
  );
}

/** Couloirs par appareil : ce qui tourne en parallèle pendant la session. */
function Couloirs({ t, teinte }: { t: Timeline; teinte: (id: string) => string }) {
  const ressources = (Object.keys(CAPACITES) as (keyof typeof CAPACITES)[]).filter((r) => r === 'mains' || t.etapes.some((e) => e.equipement === r));
  const nom = (r: keyof typeof CAPACITES) => (r === 'mains' ? 'Mains' : NOM_EQUIPEMENT[r]);
  const total = Math.max(1, t.duree);
  return (
    <figure className="couloirs" aria-label="Occupation des appareils pendant la session">
      {ressources.map((r) => (
        <div key={r} className="couloir">
          <span className="couloir__nom">{nom(r)}</span>
          <span className="couloir__piste">
            {t.etapes
              .filter((e) => (r === 'mains' ? e.actif || e.enFond : e.equipement === r))
              .map((e) => {
                const fin = r === 'mains' && e.enFond ? e.debut + Math.min(2, e.fin - e.debut) : e.fin;
                return (
                  <span
                    key={`${e.recetteId}-${e.index}`}
                    className="couloir__bloc"
                    style={{ left: `${(e.debut / total) * 100}%`, width: `${((fin - e.debut) / total) * 100}%`, background: teinte(e.recetteId) }}
                  />
                );
              })}
          </span>
        </div>
      ))}
      <figcaption className="couloirs__echelle">
        <span>0′</span>
        <span>{Math.round(total / 2)}′</span>
        <span>{total}′</span>
      </figcaption>
    </figure>
  );
}

