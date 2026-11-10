import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { BASE, estPerso, PLANCHE, retirerRecettePerso } from '../app/base';
import { db } from '../app/db';
import {
  appliquerMenu,
  annulerEchange,
  basculerFavori,
  marquerCuisine,
  marquerMange,
  useContexte,
  useEvenements,
  useFavoris,
  usePrixCorriges,
  useReglages,
  useSemaineVue,
} from '../app/etat';
import { coutIngredient, MOMENT, NOM_EQUIPEMENT, NOM_SOURCE, nomCourt, quantite } from '../app/presentation';
import { aller, lien, retour, useRoute } from '../app/routeur';
import { libelleJour } from '../domain/dates';
import { euros, kcal } from '../domain/format';
import { detailsRepas, frigoJours } from '../domain/regles';
import { alternatives, type Alternative } from '../domain/remplacement';
import type { Recette as TRecette, Source } from '../domain/schema';
import { momentDe, type Menu, type Reglages } from '../domain/types';
import { annoncer, BoutonIcone, BoutonPlus, Compteur, Etiquette, Feuille, Illustration, Puce, Rubrique } from '../ui/composants';
import { Icone } from '../ui/Icone';

export default function Recette() {
  const { id, params } = useRoute();
  const r = id ? BASE.parId[id] : undefined;
  if (!r)
    return (
      <main className="ecran">
        <p className="note">Cette recette n’existe pas (ou plus) dans la base.</p>
        <a className="btn btn--contour" href="#/semaine">
          Retour à la semaine
        </a>
      </main>
    );
  return <FicheRecette key={r.id} r={r} semaine={params.get('s') ?? undefined} creneau={params.has('c') ? Number(params.get('c')) : undefined} />;
}

function FicheRecette({ r, semaine: semaineParam, creneau }: { r: TRecette; semaine?: string; creneau?: number }) {
  const reglages = useReglages();
  const favoris = useFavoris();
  const prixCorriges = usePrixCorriges() ?? {};
  const vue = useSemaineVue();
  const semaine = semaineParam ?? vue.semaine;
  const stocke = useLiveQuery(async () => (await db.menus.get(semaine)) ?? null, [semaine]);
  const menu = stocke?.menu;
  const details = useMemo(() => (menu ? detailsRepas(menu, BASE).filter((d) => d.recette.id === r.id) : []), [menu, r.id]);
  const ici = creneau !== undefined ? details.find((d) => d.creneau === creneau) : undefined;
  const [portions, setPortions] = useState(ici?.parts ?? r.portions_base);
  const facteur = portions / r.portions_base;
  const [remplacer, setRemplacer] = useState(false);
  const [prets, setPrets] = useState<Set<string>>(() => new Set());
  const basculerPret = (cle: string) =>
    setPrets((x) => {
      const n = new Set(x);
      if (n.has(cle)) n.delete(cle);
      else n.add(cle);
      return n;
    });
  const garde = favoris?.has(r.id) ?? false;
  const n = r.nutrition_par_part;

  return (
    <main className="ecran ecran--fiche" aria-labelledby="titre-recette">
      <div className="fiche__hero">
        <div className="fiche__boutons">
          <BoutonIcone icone="retour" label="Retour" onClick={() => retour()} />
          <BoutonPlus
            actif={garde}
            nom={r.nom}
            onBasculer={async () => {
              const g = await basculerFavori(r.id);
              if (!g) annoncer('Retirée des favoris.');
            }}
          />
        </div>
        <Illustration nom={r.illustration} taille={250} className="fiche__illus" />
        <Etiquette numero={PLANCHE[r.id] ?? 0} nom={nomCourt(r)} />
      </div>

      <div className="fiche__corps">
        <h1 id="titre-recette" className="titre-recette">
          {r.nom}
        </h1>
        <p className="fiche__resume">{r.resume}</p>
        <div className="puces">
          <Puce variante="encre">{kcal(n.kcal)}</Puce>
          <Puce>{euros(r.cout_par_part_eur)} / part</Puce>
          <Puce icone="horloge">{r.temps.total_min} min</Puce>
          {r.type === 'batch' ? <Puce variante="rose">×{r.portions_base} boîtes</Puce> : <Puce variante="sauge">{r.type === 'express' ? 'Express' : 'Sans cuisson'}</Puce>}
          {r.saison.length < 12 && r.saison.includes(new Date().getMonth() + 1) && (
            <Puce variante="menthe" icone="feuille">
              De saison
            </Puce>
          )}
          {r.type === 'batch' && (
            <Puce icone={r.conservation.congelable ? 'flocon' : undefined}>
              Frigo {frigoJours(r)} j{r.conservation.congelable ? ' · congèle' : ''}
            </Puce>
          )}
          {estPerso(r.id) && <Puce variante="tirets">Ma recette</Puce>}
        </div>
        <p className="fiche__macros">
          Prot. <strong>{Math.round(n.proteines_g)} g</strong> · Gluc. {Math.round(n.glucides_g)} g · Lip. {Math.round(n.lipides_g)} g
          <span className="texte-doux"> · Ciqual</span>
        </p>

        <ul className="sources" aria-label={r.adaptation ? 'Adaptée de' : 'Source'}>
          {r.sources.map((s) => (
            <CarteSource key={s.url} s={s} />
          ))}
        </ul>
        {r.adaptation && (
          <details className="replie">
            <summary>Adaptée de la source</summary>
            <p>{r.adaptation}</p>
          </details>
        )}
        {estPerso(r.id) && (
          <p className="fiche__adaptation">
            Recette ajoutée sur ce téléphone : lien non vérifié par Gamelle.{' '}
            <button
              className="lien-bouton"
              onClick={async () => {
                if (!confirm('Supprimer cette recette de ton téléphone ?')) return;
                await db.mesRecettes.delete(r.id);
                await db.favoris.delete(r.id);
                retirerRecettePerso(r.id);
                annoncer('Recette supprimée.');
                aller(lien('favoris'), true);
              }}
            >
              Supprimer ma recette
            </button>
          </p>
        )}

        {menu && details.length > 0 && (
          <section aria-labelledby="dans-semaine">
            <Rubrique id="dans-semaine">Dans ta semaine</Rubrique>
            <div className="puces">
              {details.map((d) => (
                <Puce key={d.creneau} variante={d.statut === 'congele' ? 'tirets' : 'sauge'} icone={d.statut === 'congele' ? 'flocon' : undefined}>
                  {libelleJour(menu.lundi, d.jour)} {d.moment}
                </Puce>
              ))}
            </div>
            {ici && reglages && <ActionsRepas menu={menu} creneau={ici.creneau} reglages={reglages} />}
          </section>
        )}

        <section aria-labelledby="ingredients">
          <div className="rubrique-ligne">
            <Rubrique id="ingredients">Ingrédients · {portions} part{portions > 1 ? 's' : ''}</Rubrique>
            <Compteur valeur={portions} onChange={setPortions} label="Nombre de parts" />
          </div>
          <ul className="ingredients">
            {r.ingredients.map((ing) => {
              const c = coutIngredient(ing, facteur, prixCorriges);
              const cle = ing.ingredient + ing.nom_affiche;
              return (
                <li key={cle}>
                  <button
                    type="button"
                    className={`ingredients__ligne ${prets.has(cle) ? 'ingredients__ligne--pret' : ''}`}
                    aria-pressed={prets.has(cle)}
                    onClick={() => basculerPret(cle)}
                  >
                    <span>
                      <strong>{quantite(ing, facteur)}</strong> {ing.nom_affiche}
                      {ing.optionnel && <em> (facultatif)</em>}
                    </span>
                    <span className="ingredients__prix">{c === null ? '—' : euros(c)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="texte-doux petit">Touche un ingrédient pour le barrer quand il est prêt.</p>
        </section>

        <section aria-labelledby="etapes">
          <Rubrique id="etapes">Étapes</Rubrique>
          <ol className="etapes">
            {r.etapes.map((e, i) => (
              <li key={i}>
                <span className="etapes__num" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <p>{e.texte}</p>
                  <p className="etapes__meta">
                    {e.duree_min} min{e.equipement ? ` · ${NOM_EQUIPEMENT[e.equipement]}` : ''}
                    {!e.actif ? ' · ça cuit tout seul' : ''}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="barre-actions">
        <a className="btn btn--plein" href={lien('cuisine', r.id, { parts: portions })}>
          Mode cuisine
        </a>
        {ici && menu ? (
          <button className="btn btn--contour" onClick={() => setRemplacer(true)}>
            Remplacer
          </button>
        ) : (
          <a className="btn btn--contour" href={lien('echange', r.id)}>
            Mettre dans ma semaine
          </a>
        )}
      </div>

      {ici && menu && reglages && (
        <Feuille titre={`Remplacer le ${MOMENT[momentDe(ici.creneau)].toLowerCase()} du ${libelleJour(menu.lundi, ici.jour)}`} ouverte={remplacer} fermer={() => setRemplacer(false)}>
          <Remplacements menu={menu} creneau={ici.creneau} reglages={reglages} />
        </Feuille>
      )}
    </main>
  );
}

function ActionsRepas({ menu, creneau, reglages }: { menu: Menu; creneau: number; reglages: Reglages }) {
  const evs = useEvenements() ?? [];
  const d = detailsRepas(menu, BASE).find((x) => x.creneau === creneau)!;
  const cuisine = evs.some((e) => e.semaine === menu.semaine && e.origine === 'cuisine' && e.cle === d.cuisson.id);
  const mange = evs.some((e) => e.semaine === menu.semaine && e.origine === 'mange' && e.cle === String(creneau));
  return (
    <div className="actions-repas">
      {!d.cuisson.stock && (
        <button className={`case-action ${cuisine ? 'case-action--fait' : ''}`} aria-pressed={cuisine} onClick={() => marquerCuisine(menu, d.cuisson, reglages, !cuisine)}>
          <Icone nom={cuisine ? 'coche' : 'feu'} taille={20} />
          Cuisiné{d.cuisson.jour < 0 ? ' dim.' : ''}
        </button>
      )}
      <button className={`case-action ${mange ? 'case-action--fait' : ''}`} aria-pressed={mange} onClick={() => marquerMange(menu.semaine, creneau, d.cuisson.id, !mange)}>
        <Icone nom={mange ? 'coche' : 'boite'} taille={20} />
        Mangé
      </button>
    </div>
  );
}

function Remplacements({ menu, creneau, reglages }: { menu: Menu; creneau: number; reglages: Reglages }) {
  const ctx = useContexte(menu.semaine, reglages);
  const alts = useMemo(() => (ctx ? alternatives(menu, creneau, ctx) : null), [menu, creneau, ctx]);
  if (!alts) return <p>Je cherche…</p>;
  if (!alts.length) return <p className="texte-doux">Aucune recette rapide de la base ne colle à ce créneau (calories à ±10 %). La base va s’agrandir au jalon 5.</p>;
  const choisir = async (a: Alternative) => {
    const ancien = BASE.parId[menu.repas.find((x) => x.creneau === creneau)!.recetteId];
    const id = await appliquerMenu(menu, a.menu, `${ancien.nom} → ${a.recette.nom}`);
    annoncer(`${a.recette.nom} est dans ta semaine.`, { libelle: 'Annuler', faire: () => annulerEchange(id) });
    aller(lien('semaine'));
  };
  return (
    <ul className="alternatives">
      {alts.map((a) => (
        <li key={a.recette.id} className="alternative">
          <Illustration nom={a.recette.illustration} taille={52} />
          <div className="alternative__texte">
            <a href={lien('recette', a.recette.id)} className="alternative__nom">
              {a.recette.nom}
            </a>
            <span className="texte-doux petit">
              {kcal(a.recette.nutrition_par_part.kcal)} · {a.recette.temps.total_min} min · courses {a.deltaCout >= 0 ? '+' : '−'}
              {euros(Math.abs(a.deltaCout))}
            </span>
            {a.avertissements.map((v) => (
              <span key={v.message} className="avert">
                <Icone nom="attention" taille={15} /> {v.message}
              </span>
            ))}
          </div>
          <button className="btn btn--plein btn--petit" onClick={() => choisir(a)}>
            Choisir
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Identifiant de lecteur intégré, chargé seulement au tap (aucune requête tierce avant). */
function lecteur(s: Source): string | null {
  if (s.type === 'tiktok') {
    const m = s.url.match(/video\/(\d+)/);
    return m ? `https://www.tiktok.com/embed/v2/${m[1]}` : null;
  }
  if (s.type === 'instagram') {
    const m = s.url.match(/instagram\.com\/(?:p|reel)\/([\w-]+)/);
    return m ? `https://www.instagram.com/p/${m[1]}/embed/captioned/` : null;
  }
  return null;
}

function CarteSource({ s }: { s: Source }) {
  const [lancee, setLancee] = useState(false);
  const embed = lecteur(s);
  const reseau = s.type === 'tiktok' ? 'TikTok' : s.type === 'instagram' ? 'Instagram' : (() => {
    try {
      return new URL(s.url).hostname.replace(/^www\./, '');
    } catch {
      return 'Article';
    }
  })();
  return (
    <li className="source">
      <div className="source__ligne">
        <Icone nom={s.type === 'article' ? 'article' : 'lecture'} taille={20} />
        <a className="source__texte" href={s.url} target="_blank" rel="noopener noreferrer">
          <strong>{reseau}</strong>
          <small>{s.auteur}</small>
        </a>
        {embed && !lancee && (
          <button className="btn btn--contour btn--petit" onClick={() => setLancee(true)} aria-label={`Voir la vidéo ${reseau} ici`}>
            Voir
          </button>
        )}
      </div>
      {lancee && embed && (
        <iframe
          className={`source__lecteur source__lecteur--${s.type}`}
          src={embed}
          title={`${NOM_SOURCE[s.type]} : ${s.titre}`}
          allow="encrypted-media; fullscreen"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </li>
  );
}
