import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { BASE } from '../app/base';
import { db } from '../app/db';
import { annulerEchange, aujourdhui, regenerer, useContexte, useEvenements, useMenu, useReglages, useSemaines, useSemaineVue } from '../app/etat';
import { badge, MOMENT, nombre } from '../app/presentation';
import { lien } from '../app/routeur';
import { ajouterJours, libelleJour, libelleSemaine, lundiDeSemaine, versDate } from '../domain/dates';
import { euros } from '../domain/format';
import { coutsMenu, detailsRepas, sessionDimanche, type DetailRepas } from '../domain/regles';
import type { Menu, Reglages } from '../domain/types';
import { annoncer, BoutonIcone, Brin, Chargement, Chiffre, Illustration } from '../ui/composants';
import { Icone } from '../ui/Icone';

const JOURS_LONGS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

export default function Semaine() {
  const reglages = useReglages();
  const { courante, suivante, suivanteDebloquee } = useSemaines(reglages);
  const { semaine, choisir } = useSemaineVue();
  const etat = useMenu(semaine, reglages);
  const numero = Number(semaine.slice(-2));

  return (
    <main className="ecran semaine" aria-labelledby="titre-semaine">
      <header className="semaine__tete">
        <Brin className="semaine__brin" />
        <div className="semaine__barre">
          <p className="kicker">Gamelle · semaine {numero}</p>
          <BoutonIcone icone="reglages" label="Réglages" href={lien('reglages')} variante="nu" />
        </div>
        <h1 id="titre-semaine" className="titre-page">
          {libelleSemaine(lundiDeSemaine(semaine))}
        </h1>
        {(suivanteDebloquee || semaine !== courante) && (
          <div className="segments" role="tablist" aria-label="Semaine affichée">
            <button role="tab" aria-selected={semaine === courante} onClick={() => choisir(courante)}>
              Cette semaine
            </button>
            <button role="tab" aria-selected={semaine === suivante} onClick={() => choisir(suivante)}>
              Semaine prochaine
            </button>
          </div>
        )}
      </header>

      {etat.etat === 'pret' && reglages ? (
        <ContenuSemaine menu={etat.menu} reglages={reglages} anciensReglages={etat.anciensReglages} />
      ) : etat.etat === 'erreur' ? (
        <p className="note note--alerte">Le menu n’a pas pu être composé : {etat.message}</p>
      ) : (
        <Chargement texte={etat.etat === 'generation' ? 'Je compose ton menu de la semaine…' : 'Un instant…'} />
      )}
    </main>
  );
}

function ContenuSemaine({ menu, reglages, anciensReglages }: { menu: Menu; reglages: Reglages; anciensReglages: boolean }) {
  const ctx = useContexte(menu.semaine, reglages);
  const evs = useEvenements();
  const details = useMemo(() => detailsRepas(menu, BASE), [menu]);
  const couts = useMemo(() => (ctx ? coutsMenu(menu, ctx) : null), [menu, ctx]);
  const session = useMemo(() => sessionDimanche(menu, BASE), [menu]);
  const dernierEchange = useLiveQuery(() => db.echanges.where('semaine').equals(menu.semaine).last(), [menu.semaine]);

  const kcalJours = [...Array(7).keys()].map((j) => details.filter((d) => d.jour === j).reduce((s, d) => s + d.recette.nutrition_par_part.kcal, 0));
  const kcalMoyen = kcalJours.reduce((s, x) => s + x, 0) / 7;
  const manges = new Set((evs ?? []).filter((e) => e.semaine === menu.semaine && e.origine === 'mange').map((e) => Number(e.cle)));
  const cuisines = new Set((evs ?? []).filter((e) => e.semaine === menu.semaine && e.origine === 'cuisine').map((e) => e.cle));

  const dimanche = menu.cuissons.filter((c) => c.jour < 0 && !c.stock);
  const boites = dimanche.reduce((s, c) => s + c.parts, 0);
  const auj = aujourdhui();
  const horsBudget = !!couts && couts.totalCaisse > reglages.budget[1];

  return (
    <>
      {anciensReglages && (
        <div className="note">
          <p>Ce menu a été composé avant tes derniers réglages.</p>
          <button className="btn btn--contour btn--petit" onClick={() => regenerer(menu.semaine, reglages)}>
            Recomposer le menu
          </button>
        </div>
      )}

      <section className="totaux" aria-label="Totaux de la semaine">
        <div className="totaux__case">
          <Chiffre taille="m">{nombre(kcalMoyen)}</Chiffre>
          <span>kcal / jour</span>
          <small>+{reglages.kcalLibres} libres</small>
        </div>
        <div className={`totaux__case ${horsBudget ? 'totaux__case--alerte' : ''}`}>
          <Chiffre taille="m">{couts ? euros(couts.totalCaisse) : '…'}</Chiffre>
          <span>de courses</span>
          {horsBudget && <small>budget {reglages.budget[1]} €</small>}
        </div>
        <div className="totaux__case">
          <Chiffre taille="m">{couts ? euros(couts.totalUtilise / 14 / reglages.personnes) : '…'}</Chiffre>
          <span>par repas</span>
        </div>
      </section>

      {dimanche.length > 0 && (
        <a className="bandeau-batch" href={lien('session', undefined, { s: menu.semaine })}>
          <Icone nom="boite" taille={30} />
          <span className="bandeau-batch__texte">
            <strong>Batch dimanche · {session.duree} min</strong>
            <span>
              {dimanche.length} plats · {boites} boîtes
            </span>
          </span>
          <span className="bandeau-batch__voir">Voir</span>
        </a>
      )}

      {menu.relachements.length > 0 && (
        <details className="replie">
          <summary>Menu assoupli cette semaine ({menu.relachements.length})</summary>
          <ul>
            {menu.relachements.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </details>
      )}

      {dernierEchange && Date.now() - Date.parse(dernierEchange.quand) < 2 * 864e5 && (
        <div className="note note--tirets note--ligne">
          <span>{dernierEchange.libelle}</span>
          <button
            className="lien-bouton"
            onClick={async () => {
              await annulerEchange(dernierEchange.id!);
              annoncer('Changement annulé.');
            }}
          >
            Annuler
          </button>
        </div>
      )}

      <ol className="jours">
        {[...Array(7).keys()].map((j) => {
          const date = versDate(ajouterJours(menu.lundi, j));
          const ds = details.filter((d) => d.jour === j);
          const estAuj = ajouterJours(menu.lundi, j) === auj;
          return (
            <li className={`jour ${estAuj ? 'jour--aujourdhui' : ''}`} key={j} aria-current={estAuj ? 'date' : undefined}>
              <div className="jour__date" aria-hidden="true">
                <span className="kicker">{estAuj ? 'Auj.' : JOURS_LONGS[j]}</span>
                <span className="jour__num">{date.getUTCDate()}</span>
              </div>
              <div className="jour__repas">
                <h3 className="sr-only">{libelleJour(menu.lundi, j)}</h3>
                {ds.map((d) => (
                  <LigneRepas key={d.creneau} d={d} semaine={menu.semaine} mange={manges.has(d.creneau)} cuisine={cuisines.has(d.cuisson.id)} />
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function LigneRepas({ d, semaine, mange, cuisine }: { d: DetailRepas; semaine: string; mange: boolean; cuisine: boolean }) {
  const r = d.recette;
  return (
    <a className={`repas ${mange ? 'repas--mange' : ''}`} href={lien('recette', r.id, { s: semaine, c: d.creneau })}>
      <span className="repas__vignette">
        <Illustration nom={r.illustration} taille={46} />
      </span>
      <span className="repas__texte">
        <span className="repas__nom">{r.nom}</span>
        <span className="repas__detail">
          {MOMENT[d.moment]} · {nombre(r.nutrition_par_part.kcal)} kcal · {d.statut === 'congele' ? 'congelée, à sortir la veille' : badge(d)}
        </span>
      </span>
      {(mange || (cuisine && d.statut === 'cuisine')) && (
        <span className="repas__fait" aria-label={mange ? 'mangé' : 'cuisiné'}>
          <Icone nom="coche" taille={18} />
        </span>
      )}
    </a>
  );
}
