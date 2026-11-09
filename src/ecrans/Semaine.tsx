import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { BASE } from '../app/base';
import { db } from '../app/db';
import { annulerEchange, regenerer, useContexte, useEvenements, useMenu, useReglages, useSemaines, useSemaineVue } from '../app/etat';
import { badge, MOMENT, nombre } from '../app/presentation';
import { lien } from '../app/routeur';
import { ajouterJours, libelleJour, libelleSemaine, lundiDeSemaine, versDate } from '../domain/dates';
import { euros, kcal } from '../domain/format';
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
  const resumeBatch = dimanche
    .map((c) => {
      const ds = details.filter((d) => d.cuisson.id === c.id);
      const frigo = ds.filter((d) => d.statut === 'boite').length;
      const congel = ds.filter((d) => d.statut === 'congele').length;
      const nom = c.recetteId && BASE.parId[c.recetteId].nom.split(/,| et | aux | au /)[0];
      return `${nom} ×${c.parts} : ${frigo} au frigo${congel ? `, ${congel} au congélateur` : ''}`;
    })
    .join(' · ');

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
          <span>kcal / jour planifiées</span>
        </div>
        <div className="totaux__case">
          <Chiffre taille="m">{couts ? euros(couts.totalCaisse) : '…'}</Chiffre>
          <span>de courses</span>
        </div>
        <div className="totaux__case">
          <Chiffre taille="m">{couts ? euros(couts.totalUtilise / 14 / reglages.personnes) : '…'}</Chiffre>
          <span>par repas</span>
        </div>
      </section>
      <p className="reste">
        Il te reste ~{reglages.kcalLibres} kcal par jour pour le petit-déj et les en-cas.
        {couts && couts.totalCaisse > reglages.budget[1] && <> Courses au-dessus de ton budget de {reglages.budget[1]} €.</>}
      </p>

      {dimanche.length > 0 && (
        <a className="bandeau-batch" href={lien('session', undefined, { s: menu.semaine })}>
          <Icone nom="boite" taille={30} />
          <span className="bandeau-batch__texte">
            <strong>
              {libelleJour(menu.lundi, -1).replace('dim.', 'Dimanche')} · {session.duree} min de batch
            </strong>
            <span>{resumeBatch}</span>
          </span>
          <span className="bandeau-batch__voir">Voir</span>
        </a>
      )}

      {menu.relachements.length > 0 && (
        <div className="note note--tirets">
          <p className="kicker">Assoupli cette semaine</p>
          <ul>
            {menu.relachements.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {dernierEchange && Date.now() - Date.parse(dernierEchange.quand) < 2 * 864e5 && (
        <div className="note note--tirets note--ligne">
          <span>Dernier changement : {dernierEchange.libelle}</span>
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
          const cout = ds.reduce((s, d) => s + d.recette.cout_par_part_eur, 0);
          return (
            <li className="jour" key={j}>
              <div className="jour__date" aria-hidden="true">
                <span className="kicker">{JOURS_LONGS[j]}</span>
                <span className="jour__num">{date.getUTCDate()}</span>
              </div>
              <div className="jour__repas">
                <h3 className="sr-only">{libelleJour(menu.lundi, j)}</h3>
                {ds.map((d) => (
                  <LigneRepas key={d.creneau} d={d} semaine={menu.semaine} mange={manges.has(d.creneau)} cuisine={cuisines.has(d.cuisson.id)} />
                ))}
                <p className="jour__total">
                  {kcal(kcalJours[j])} · {euros(cout)}
                </p>
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
          {MOMENT[d.moment]} · {kcal(r.nutrition_par_part.kcal)} · {badge(d)}
          {d.statut === 'congele' && ' · à sortir la veille'}
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
