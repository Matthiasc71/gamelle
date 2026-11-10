import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { BASE } from '../app/base';
import { db } from '../app/db';
import { cocher, corrigerPrix, declarerDejaAuFrigo, useContexte, useEvenements, useMenu, useReglages, useSemaineVue } from '../app/etat';
import { majuscule, nombre } from '../app/presentation';
import { libelleConditionnement, NOMS_RAYONS, texteListe, type LigneCourses } from '../domain/courses';
import { libelleSemaine } from '../domain/dates';
import { euros } from '../domain/format';
import { coutsMenu } from '../domain/regles';
import type { PrixReference } from '../domain/schema';
import type { Menu } from '../domain/types';
import { annoncer, Chargement, Chiffre, Feuille, Interrupteur, Rubrique } from '../ui/composants';
import { Icone } from '../ui/Icone';

/** « Carottes, sachet 1 kg » → « Carottes » ; « Brocoli (à la pièce) » → « Brocoli ». */
const nomProduit = (p: string) => p.split(/,| \(/)[0].trim();

/** « 3 pièces », « 2 × 500 g », « 1 kg ». */
function quantiteAchat(l: LigneCourses) {
  const u = BASE.prix[l.ingredient]?.conditionnement;
  if (u?.unite === 'pièce' && u.quantite === 1) return `${l.paquets} pièce${l.paquets > 1 ? 's' : ''}`;
  return `${l.paquets > 1 ? `${l.paquets} × ` : ''}${l.conditionnement}`;
}

const METHODE: Record<PrixReference['methode'], string> = {
  ticket: 'ticket de caisse',
  lidl: 'relevé en magasin Lidl (Open Prices)',
  'site-enseigne': 'prix affiché sur le site',
  'open-prices-lyon': 'médiane des relevés à Lyon (Open Prices)',
  'open-prices-france': 'estimation : médiane France (Open Prices)',
};

export default function Courses() {
  const reglages = useReglages();
  const { semaine } = useSemaineVue();
  const etat = useMenu(semaine, reglages);
  return (
    <main className="ecran" aria-labelledby="titre-courses">
      <p className="kicker">Courses · semaine {Number(semaine.slice(-2))}</p>
      <h1 id="titre-courses" className="titre-page">
        Liste de courses
      </h1>
      {etat.etat === 'pret' ? <Liste menu={etat.menu} /> : <Chargement />}
    </main>
  );
}

function Liste({ menu }: { menu: Menu }) {
  const reglages = useReglages();
  const ctx = useContexte(menu.semaine, reglages);
  const evs = useEvenements();
  const coches = useLiveQuery(async () => new Set((await db.coches.where('semaine').equals(menu.semaine).toArray()).map((c) => c.ingredient)), [menu.semaine]);
  const liste = useMemo(() => (ctx ? coutsMenu(menu, ctx) : null), [menu, ctx]);
  const [detail, setDetail] = useState<LigneCourses | null>(null);
  if (!liste || !coches || !evs || !reglages) return <Chargement />;

  const deja = new Map(evs.filter((e) => e.semaine === menu.semaine && e.origine === 'deja').map((e) => [e.cle, e.ev.type === 'correction' ? e.ev.delta : 0]));
  const aAcheter = liste.parRayon.flatMap((g) => g.lignes);
  const reste = aAcheter.filter((l) => !coches.has(l.ingredient)).reduce((s, l) => s + l.coutCaisse, 0);
  const placard = liste.lignes.filter((l) => l.placard);
  const enStock = liste.lignes.filter((l) => !l.placard && l.paquets === 0);
  const aUtiliser = [...coches].filter((i) => !aAcheter.some((l) => l.ingredient === i));
  const recettesPour = (ing: string) =>
    [...new Set(menu.cuissons.filter((c) => !c.stock && BASE.parId[c.recetteId].ingredients.some((x) => x.ingredient === ing)).map((c) => BASE.parId[c.recetteId].nom.split(/,| et | aux | au /)[0]))];
  const texte = texteListe(liste, coches);

  const partager = async () => {
    const titre = `Courses Gamelle · ${libelleSemaine(menu.lundi)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: titre, text: texte });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    await copier();
  };
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      annoncer('Liste copiée.');
    } catch {
      annoncer('Copie impossible sur cet appareil.');
    }
  };

  return (
    <>
      <section className="courses__total">
        <Chiffre taille="l">{euros(liste.totalCaisse)}</Chiffre>
        <p className="texte-doux">
          {aAcheter.filter((l) => coches.has(l.ingredient)).length}/{aAcheter.length} articles · {euros(reste)} à acheter
        </p>
      </section>
      <div className="rangee-boutons rangee-boutons--serree">
        <button className="btn btn--plein" onClick={partager}>
          <Icone nom="partager" taille={18} /> Partager la liste
        </button>
        <button className="bouton-icone" onClick={copier} aria-label="Copier la liste">
          <Icone nom="copier" />
        </button>
      </div>

      {coches.size > 0 && aAcheter.some((l) => !coches.has(l.ingredient)) && aUtiliser.length > 0 && (
        <p className="note">Menu modifié : les articles non cochés sont à racheter.</p>
      )}

      {liste.parRayon.map((g) => {
        const restants = g.lignes.filter((l) => !coches.has(l.ingredient));
        if (!restants.length) return null;
        return (
          <section key={g.rayon} aria-labelledby={`rayon-${g.rayon}`}>
            <Rubrique id={`rayon-${g.rayon}`}>{NOMS_RAYONS[g.rayon]}</Rubrique>
            <ul className="lignes-courses">
              {restants.map((l) => (
                <LigneArticle
                  key={l.ingredient}
                  l={l}
                  coche={false}
                  basculer={(v) => cocher(menu.semaine, l.ingredient, l.paquets * BASE.prix[l.ingredient].conditionnement.quantite, v)}
                  ouvrir={() => setDetail(l)}
                />
              ))}
            </ul>
          </section>
        );
      })}

      {aAcheter.length > 0 && aAcheter.every((l) => coches.has(l.ingredient)) && (
        <p className="courses__fini">Tout est dans le panier.</p>
      )}

      {aAcheter.some((l) => coches.has(l.ingredient)) && (
        <details className="panier">
          <summary>Dans le panier · {aAcheter.filter((l) => coches.has(l.ingredient)).length}</summary>
          <ul className="lignes-courses">
            {aAcheter
              .filter((l) => coches.has(l.ingredient))
              .map((l) => (
                <LigneArticle
                  key={l.ingredient}
                  l={l}
                  coche
                  basculer={(v) => cocher(menu.semaine, l.ingredient, l.paquets * BASE.prix[l.ingredient].conditionnement.quantite, v)}
                  ouvrir={() => setDetail(l)}
                />
              ))}
          </ul>
        </details>
      )}

      {aUtiliser.length > 0 && (
        <section aria-labelledby="a-utiliser">
          <Rubrique id="a-utiliser">Acheté pour un plat retiré</Rubrique>
          <p className="texte-doux petit">Ces articles sont au frigo et ne servent plus au menu : à utiliser.</p>
          <ul className="liste-simple">
            {aUtiliser.map((i) => (
              <li key={i}>
                {majuscule(BASE.catalogue[i]?.nom ?? i)}
                <button className="lien-bouton" onClick={() => cocher(menu.semaine, i, 0, false)}>
                  Décocher
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {enStock.length > 0 && (
        <section aria-labelledby="en-stock">
          <Rubrique id="en-stock">Déjà chez toi</Rubrique>
          <ul className="liste-simple">
            {enStock.map((l) => (
              <li key={l.ingredient}>
                <span>
                  {majuscule(l.nom)}
                  <span className="texte-doux petit"> · {deja.has(l.ingredient) ? 'déclaré au frigo' : 'reste de paquet'}</span>
                </span>
                {deja.has(l.ingredient) && (
                  <button className="lien-bouton" onClick={() => declarerDejaAuFrigo(menu.semaine, l.ingredient, 0, false)}>
                    Remettre dans la liste
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {placard.length > 0 && (
        <section aria-labelledby="placard">
          <Rubrique id="placard">Au placard (non compté)</Rubrique>
          <p className="texte-doux">{placard.map((l) => l.nom).join(', ')}.</p>
        </section>
      )}

      <Feuille titre={detail ? nomProduit(detail.produit) : ''} ouverte={!!detail} fermer={() => setDetail(null)}>
        {detail && <DetailLigne l={detail} pour={recettesPour(detail.ingredient)} semaine={menu.semaine} fermer={() => setDetail(null)} />}
      </Feuille>
    </>
  );
}

function LigneArticle({ l, coche, basculer, ouvrir }: { l: LigneCourses; coche: boolean; basculer: (v: boolean) => void; ouvrir: () => void }) {
  return (
    <li className={`article ${coche ? 'article--coche' : ''}`}>
      <label className="article__case">
        <input type="checkbox" checked={coche} onChange={(e) => basculer(e.target.checked)} />
        <span className="article__boite" aria-hidden="true">
          <Icone nom="coche" taille={18} />
        </span>
        <span className="article__texte">
          <span className="article__nom">
            {nomProduit(l.produit)}
            <svg className="crayon" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
              <path d="M1 5 C20 3 35 6 52 4 S82 3 99 5" pathLength="1" />
            </svg>
          </span>
          <span className="article__detail">
            {quantiteAchat(l)}
          </span>
        </span>
      </label>
      <button className="article__prix" onClick={ouvrir} aria-label={`Détails et prix : ${nomProduit(l.produit)}`}>
        <span>{l.sansPrix ? '—' : euros(l.coutCaisse)}</span>
        {l.prixCorrige && <small>corrigé</small>}
      </button>
    </li>
  );
}

function DetailLigne({ l, pour, semaine, fermer }: { l: LigneCourses; pour: string[]; semaine: string; fermer: () => void }) {
  const p = BASE.prix[l.ingredient];
  const [saisie, setSaisie] = useState(nombre(l.prixPaquet, 2));
  return (
    <div className="detail-ligne">
      <p className="texte-doux petit">{l.produit}</p>
      {pour.length > 0 && <p>Pour : {pour.join(', ')}</p>}
      <p>
        Besoin : {nombre(l.besoin, 0)} {p?.conditionnement.unite === 'pièce' ? 'pièce(s)' : p?.conditionnement.unite} · paquet de{' '}
        {p ? libelleConditionnement(p) : '?'}
      </p>
      {p && (
        <p className="texte-doux petit">
          {euros(p.prix_eur)} chez {p.enseigne} · {METHODE[p.methode]} · relevé le {new Date(p.releve_le).toLocaleDateString('fr-FR')}
          {p.url && (
            <>
              {' · '}
              <a href={p.url} target="_blank" rel="noopener noreferrer">
                voir
              </a>
            </>
          )}
        </p>
      )}
      <Interrupteur
        label="Déjà au frigo"
        aide="Je l’ai déjà : la ligne sort de la liste et compte dans le frigo."
        actif={false}
        onChange={async () => {
          await declarerDejaAuFrigo(semaine, l.ingredient, l.besoin, true);
          annoncer(`${l.nom} : noté au frigo.`);
          fermer();
        }}
      />
      <form
        className="correction-prix"
        onSubmit={async (e) => {
          e.preventDefault();
          const v = Number(saisie.replace(',', '.').replace(/[^\d.]/g, ''));
          if (!(v > 0)) return annoncer('Prix invalide.');
          await corrigerPrix(l.ingredient, v);
          annoncer('Prix corrigé.');
          fermer();
        }}
      >
        <label>
          Prix du paquet payé
          <span className="champ-euros">
            <input inputMode="decimal" value={saisie} onChange={(e) => setSaisie(e.target.value)} aria-label="Prix du paquet en euros" />€
          </span>
        </label>
        <button className="btn btn--plein btn--petit" type="submit">
          Corriger
        </button>
        {l.prixCorrige && (
          <button
            className="lien-bouton"
            type="button"
            onClick={async () => {
              await corrigerPrix(l.ingredient, null);
              fermer();
            }}
          >
            Revenir au prix de la grille
          </button>
        )}
      </form>
    </div>
  );
}
