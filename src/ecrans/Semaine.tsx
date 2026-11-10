import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { BASE } from '../app/base';
import { db } from '../app/db';
import { annulerEchange, aujourdhui, maintenant, marquerMange, regenerer, useContexte, useEvenements, useMenu, useReglages, useSemaines, useSemaineVue, useTickets, viserBudget } from '../app/etat';
import { badge, MOMENT, nombre } from '../app/presentation';
import { lien } from '../app/routeur';
import { ajouterJours, ecartJours, libelleJour, libelleSemaine, lundiDeSemaine, versDate } from '../domain/dates';
import { euros } from '../domain/format';
import { coutsMenu, detailsRepas, sessionDimanche, type DetailRepas } from '../domain/regles';
import type { Menu, Reglages } from '../domain/types';
import { annoncer, BoutonIcone, Brin, Chargement, Chiffre, Feuille, Fleuron, Illustration } from '../ui/composants';
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
          <span className="semaine__actions">
            <BoutonIcone icone="horloge" label="Historique" href={lien('historique')} variante="nu" />
            <BoutonIcone icone="reglages" label="Réglages" href={lien('reglages')} variante="nu" />
          </span>
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
  const tickets = useTickets();
  const [budgetOuvert, setBudgetOuvert] = useState(false);

  return (
    <>
      <CeRepas details={details} menu={menu} auj={auj} manges={manges} />

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
        <div className={`totaux__case totaux__case--bouton ${horsBudget ? 'totaux__case--alerte' : ''}`}>
          <Chiffre taille="m">{couts ? euros(couts.totalCaisse) : '…'}</Chiffre>
          <span className="totaux__libelle">
            de courses <Icone nom="crayon" taille={13} />
          </span>
          {horsBudget ? (
            <small>budget {reglages.budget[1]} €</small>
          ) : tickets?.ratio && couts ? (
            <small className="totaux__ticket">≈ {euros(couts.totalCaisse * tickets.ratio)} d’après tes tickets</small>
          ) : null}
          <button type="button" className="totaux__toucher" onClick={() => setBudgetOuvert(true)} aria-label="Viser un autre budget de courses" />
        </div>
        <div className="totaux__case">
          <Chiffre taille="m">{couts ? euros(couts.totalUtilise / 14 / reglages.personnes) : '…'}</Chiffre>
          <span>par repas</span>
        </div>
      </section>

      <Feuille titre="Viser un budget" ouverte={budgetOuvert} fermer={() => setBudgetOuvert(false)}>
        {budgetOuvert && couts && <ViserBudget menu={menu} reglages={reglages} actuel={couts.totalCaisse} fermer={() => setBudgetOuvert(false)} />}
      </Feuille>

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
      <Fleuron />
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

/** Le repas du moment (midi avant 14 h, soir ensuite), comment le servir, et les boîtes à sortir du congélateur pour demain. */
function CeRepas({ details, menu, auj, manges }: { details: DetailRepas[]; menu: Menu; auj: string; manges: Set<number> }) {
  const j = ecartJours(menu.lundi, auj);
  if (j < 0 || j > 6) return null;
  const moment = maintenant().getHours() < 14 ? 'midi' : 'soir';
  const d = details.find((x) => x.jour === j && x.moment === moment);
  const aSortir = details.filter((x) => x.jour === j + 1 && x.statut === 'congele');
  if (!d) return null;
  const r = d.recette;
  const aCuisiner = d.statut === 'cuisine' || d.statut === 'express' || d.statut === 'assemblage';
  const mange = manges.has(d.creneau);
  return (
    <section className="ce-repas" aria-label={moment === 'midi' ? 'Ce midi' : 'Ce soir'}>
      <a className="ce-repas__plat" href={lien('recette', r.id, { s: menu.semaine, c: d.creneau })}>
        <Illustration nom={r.illustration} taille={56} />
        <span className="ce-repas__texte">
          <span className="kicker">
            <Icone nom={moment === 'midi' ? 'soleil' : 'lune'} taille={14} /> {moment === 'midi' ? 'Ce midi' : 'Ce soir'}
          </span>
          <strong>{r.nom}</strong>
          <small>{d.statut === 'congele' ? 'boîte du congélateur' : badge(d)}</small>
        </span>
      </a>
      {!aCuisiner && !mange && <p className="ce-repas__conseil">{conseilBoite(d)}</p>}
      <div className="ce-repas__actions">
        {aCuisiner && !mange && (
          <a className="btn btn--plein btn--petit" href={lien('cuisine', r.id, { parts: d.cuisson.parts })}>
            Cuisiner
          </a>
        )}
        <button
          className={`btn btn--petit ${mange ? 'btn--fait' : 'btn--contour'}`}
          aria-pressed={mange}
          onClick={async () => {
            await marquerMange(menu.semaine, d.creneau, d.cuisson.id, !mange);
            if (!mange) annoncer('Bon appétit ! Donne ton avis sur la fiche si tu veux le revoir (ou pas).');
          }}
        >
          <Icone nom="coche" taille={16} /> {mange ? 'Mangé' : 'Marquer mangé'}
        </button>
      </div>
      {aSortir.length > 0 && (
        <p className="ce-repas__rappel">
          <Icone nom="flocon" taille={16} /> À sortir ce soir : {aSortir.map((x) => x.recette.nom).join(', ')}
        </p>
      )}
    </section>
  );
}

/** Conseils de service d'une boîte : conseils d'usage généraux, pas des temps tirés de la recette. */
function conseilBoite(d: DetailRepas): string {
  const froid = d.recette.illustration === 'salade' || d.recette.illustration === 'wrap';
  if (froid) return 'Se mange froid : sors la boîte du frigo un peu avant.';
  if (d.statut === 'congele')
    return 'Décongelée au frigo depuis hier soir ? Sinon, programme décongélation du micro-ondes, puis réchauffe jusqu’à ce que ce soit bien chaud à cœur.';
  return 'Au micro-ondes, couvercle entrouvert : réchauffe en remuant à mi-chemin, jusqu’à ce que ce soit bien chaud à cœur.';
}

/** Feuille « Viser un budget » : refait le menu de la semaine pour un plafond donné (annulable). */
function ViserBudget({ menu, reglages, actuel, fermer }: { menu: Menu; reglages: Reglages; actuel: number; fermer: () => void }) {
  const [vise, setVise] = useState(() => Math.max(20, Math.min(reglages.budget[1], Math.floor(actuel) - 2)));
  const [enCours, setEnCours] = useState(false);
  const activite = useLiveQuery(async () => (await db.coches.where('semaine').equals(menu.semaine).count()) + (await db.evenements.where('semaine').equals(menu.semaine).count()), [menu.semaine]);
  return (
    <div className="viser">
      <p className="texte-doux">
        Aujourd’hui : <strong>{euros(actuel)}</strong> en caisse. Je refais le menu de cette semaine en privilégiant les recettes qui partagent leurs paquets. Tes réglages ne changent pas.
      </p>
      <label className="viser__curseur">
        <span>
          Viser <Chiffre taille="s">{`${vise} €`}</Chiffre>
        </span>
        <input type="range" min={20} max={45} step={1} value={vise} onChange={(e) => setVise(Number(e.target.value))} aria-label="Budget visé en euros" />
      </label>
      {!!activite && <p className="note">Tu as déjà coché des courses ou cuisiné cette semaine : la liste va changer.</p>}
      <button
        className="btn btn--plein"
        disabled={enCours}
        onClick={async () => {
          setEnCours(true);
          try {
            const res = await viserBudget(menu.semaine, reglages, vise);
            fermer();
            if (res.garde)
              annoncer(`Je n’ai pas trouvé moins cher que ${euros(res.cout)} cette semaine : ce sont surtout des paquets entiers (riz, épices, conserves) qui resteront pour les suivantes. Menu inchangé.`);
            else if (res.cout > vise) annoncer(`Le plus proche : ${euros(res.cout)} (au lieu de ${euros(res.avant ?? 0)}). Les paquets entiers servent les semaines suivantes.`);
            else annoncer(`Menu refait : ${euros(res.cout)} en caisse.`);
          } catch (e) {
            annoncer(`Impossible : ${(e as Error).message}`);
          } finally {
            setEnCours(false);
          }
        }}
      >
        {enCours ? 'Je cherche…' : `Refaire le menu pour ${vise} €`}
      </button>
    </div>
  );
}
