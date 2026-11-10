import { useMemo, useState } from 'react';
import { BASE } from '../app/base';
import { aujourdhui, corrigerFrigo, useFrigo, useReglages } from '../app/etat';
import { majuscule, nombre } from '../app/presentation';
import { ecartJours, versDate } from '../domain/dates';
import { aUtiliserVite, ideesRestes, type Article, type Boite, type Lieu } from '../domain/frigo';
import { lien } from '../app/routeur';
import { annoncer, Chargement, Feuille, Fleuron, Illustration, Rubrique } from '../ui/composants';
import { Icone } from '../ui/Icone';

const LIEUX: { id: Lieu; nom: string }[] = [
  { id: 'frigo', nom: 'Frigo' },
  { id: 'congelateur', nom: 'Congélateur' },
  { id: 'placard', nom: 'Placard' },
];

const uniteDe = (ing: string) => BASE.prix[ing]?.conditionnement.unite ?? 'g';
const pas = (ing: string) => (uniteDe(ing) === 'pièce' ? 1 : 50);

function qte(ing: string, q: number) {
  const u = uniteDe(ing);
  if (u === 'pièce') return `${nombre(q, 1)} pièce${q > 1 ? 's' : ''}`;
  if (q >= 1000) return `${nombre(q / 1000, 2)} ${u === 'g' ? 'kg' : 'l'}`;
  return `${nombre(q)} ${u}`;
}

const dateCourte = (iso: string) => versDate(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function Echeance({ date, aujourd }: { date: string; aujourd: string }) {
  const j = ecartJours(aujourd, date);
  if (j < 0) return <span className="echeance echeance--depassee">dépassé</span>;
  if (j <= 2) return <span className="echeance echeance--vite">{j === 0 ? "aujourd'hui" : j === 1 ? 'demain' : 'dans 2 jours'}</span>;
  return <span className="echeance">jusqu’au {dateCourte(date)}</span>;
}

export default function Frigo() {
  const etat = useFrigo();
  const reglages = useReglages();
  const [ajout, setAjout] = useState(false);
  const auj = aujourdhui();

  const parLieu = useMemo(() => {
    if (!etat) return null;
    const groupes = new Map<string, { ingredient: string; lieu: Lieu; quantite: number; peremption: string }>();
    for (const a of etat.articles) {
      const k = `${a.lieu}|${a.ingredient}`;
      const g = groupes.get(k);
      if (g) {
        g.quantite += a.quantite;
        if (a.peremption < g.peremption) g.peremption = a.peremption;
      } else groupes.set(k, { ingredient: a.ingredient, lieu: a.lieu, quantite: a.quantite, peremption: a.peremption });
    }
    const tous = [...groupes.values()].sort((a, b) => (BASE.catalogue[a.ingredient]?.nom ?? a.ingredient).localeCompare(BASE.catalogue[b.ingredient]?.nom ?? b.ingredient, 'fr'));
    return LIEUX.map((l) => ({ ...l, articles: tous.filter((a) => a.lieu === l.id) }));
  }, [etat]);

  if (!etat || !parLieu || !reglages) return <Chargement />;
  const vite = aUtiliserVite(etat, auj);
  const idees = ideesRestes(etat, BASE, auj, reglages.placardDeBase);
  const vide = !etat.articles.length && !etat.boites.length;

  return (
    <main className="ecran" aria-labelledby="titre-frigo">
      <header className="tete-ligne">
        <h1 id="titre-frigo" className="titre-page">
          Frigo
        </h1>
        <button className="bouton-icone bouton-icone--plein" onClick={() => setAjout(true)} aria-label="Ajouter un article">
          <Icone nom="plus" />
        </button>
      </header>

      {vide && (
        <p className="vide">
          Vide pour l’instant. Les articles cochés dans les courses et les plats cuisinés arrivent ici tout seuls.
        </p>
      )}

      {idees.length > 0 && (
        <section aria-labelledby="idees">
          <Rubrique id="idees">Avec ce qu’il te reste</Rubrique>
          <ul className="idees">
            {idees.map((i) => {
              const r = BASE.parId[i.recetteId];
              return (
                <li key={i.recetteId}>
                  <a className="idee" href={lien('recette', r.id, { depuis: 'favoris' })}>
                    <Illustration nom={r.illustration} taille={44} />
                    <span className="idee__texte">
                      <strong>{r.nom}</strong>
                      <small>{majuscule(i.utilise.map((x) => BASE.catalogue[x]?.nom ?? x).join(', '))}</small>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(vite.articles.length > 0 || vite.boites.length > 0) && (
        <section aria-labelledby="vite" className="bloc-rose">
          <Rubrique id="vite">À utiliser vite</Rubrique>
          <ul className="liste-simple">
            {vite.boites.map((b) => (
              <li key={b.id}>
                Boîte de {BASE.parId[b.recetteId]?.nom ?? b.recetteId} <Echeance date={b.limite} aujourd={auj} />
              </li>
            ))}
            {vite.articles.map((a, i) => (
              <li key={i}>
                {majuscule(BASE.catalogue[a.ingredient]?.nom ?? a.ingredient)} · {qte(a.ingredient, a.quantite)} <Echeance date={a.peremption} aujourd={auj} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {etat.boites.length > 0 && (
        <section aria-labelledby="boites">
          <Rubrique id="boites">Boîtes de plats · {etat.boites.length}</Rubrique>
          <ul className="boites">
            {[...etat.boites]
              .sort((a, b) => a.limite.localeCompare(b.limite))
              .map((b) => (
                <LigneBoite key={b.id} b={b} auj={auj} />
              ))}
          </ul>
        </section>
      )}

      {parLieu
        .filter((l) => l.articles.length)
        .map((l) => (
          <section key={l.id} aria-labelledby={`lieu-${l.id}`}>
            <Rubrique id={`lieu-${l.id}`}>{l.nom}</Rubrique>
            <ul className="stock">
              {l.articles.map((a) => (
                <LigneStock key={a.ingredient} a={a} auj={auj} />
              ))}
            </ul>
          </section>
        ))}

      <p className="texte-doux petit">
        Huile, épices et bouillons : toujours supposés au placard.
      </p>

      <Feuille titre="Ajouter au frigo" ouverte={ajout} fermer={() => setAjout(false)}>
        <Ajout fermer={() => setAjout(false)} />
      </Feuille>
      <Fleuron />
    </main>
  );
}

function LigneBoite({ b, auj }: { b: Boite; auj: string }) {
  const r = BASE.parId[b.recetteId];
  return (
    <li className="boite">
      {r && <Illustration nom={r.illustration} taille={40} />}
      <div className="boite__texte">
        <span className="boite__nom">{r?.nom ?? b.recetteId}</span>
        <span className="texte-doux petit">
          {b.lieu === 'frigo' ? 'Frigo' : 'Congélateur'} · cuisiné le {dateCourte(b.cuisine_le)} · <Echeance date={b.limite} aujourd={auj} />
        </span>
      </div>
      <div className="boite__actions">
        <button className="btn btn--contour btn--petit" onClick={() => corrigerFrigo({ type: 'mange', boiteId: b.id })}>
          Mangée
        </button>
        <button
          className="bouton-icone bouton-icone--nu"
          aria-label={b.lieu === 'frigo' ? 'Mettre au congélateur' : 'Sortir au frigo'}
          onClick={() => corrigerFrigo({ type: 'deplacer-boite', boiteId: b.id, lieu: b.lieu === 'frigo' ? 'congelateur' : 'frigo', date: auj })}
        >
          <Icone nom={b.lieu === 'frigo' ? 'flocon' : 'frigo'} />
        </button>
      </div>
    </li>
  );
}

function LigneStock({ a, auj }: { a: Pick<Article, 'ingredient' | 'lieu' | 'quantite' | 'peremption'>; auj: string }) {
  const nom = majuscule(BASE.catalogue[a.ingredient]?.nom ?? a.ingredient);
  const p = pas(a.ingredient);
  return (
    <li className="stock__ligne">
      <div className="stock__texte">
        <span>{nom}</span>
        <span className="texte-doux petit">
          {qte(a.ingredient, a.quantite)} · <Echeance date={a.peremption} aujourd={auj} />
        </span>
      </div>
      <span className="compteur compteur--petit" role="group" aria-label={`Quantité de ${nom}`}>
        <button aria-label={`Retirer ${p} ${uniteDe(a.ingredient)}`} onClick={() => corrigerFrigo({ type: 'correction', ingredient: a.ingredient, lieu: a.lieu, delta: -Math.min(p, a.quantite), date: auj })}>
          <Icone nom="moins" taille={18} />
        </button>
        <button aria-label={`Ajouter ${p} ${uniteDe(a.ingredient)}`} onClick={() => corrigerFrigo({ type: 'correction', ingredient: a.ingredient, lieu: a.lieu, delta: p, date: auj })}>
          <Icone nom="plus" taille={18} />
        </button>
      </span>
      <button
        className="bouton-icone bouton-icone--nu"
        aria-label={`Supprimer ${nom}`}
        onClick={async () => {
          await corrigerFrigo({ type: 'supprimer', ingredient: a.ingredient, lieu: a.lieu });
          annoncer(`${nom} retiré.`);
        }}
      >
        <Icone nom="poubelle" />
      </button>
    </li>
  );
}

function Ajout({ fermer }: { fermer: () => void }) {
  const [q, setQ] = useState('');
  const [choix, setChoix] = useState<string | null>(null);
  const [quantite, setQuantite] = useState('');
  const [lieu, setLieu] = useState<Lieu>('frigo');
  const norm = (s: string) => s.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const resultats = Object.entries(BASE.catalogue)
    .filter(([, c]) => norm(c.nom).includes(norm(q)))
    .sort((a, b) => a[1].nom.localeCompare(b[1].nom, 'fr'))
    .slice(0, 8);

  if (choix) {
    const c = BASE.catalogue[choix];
    const u = uniteDe(choix);
    return (
      <form
        className="formulaire"
        onSubmit={async (e) => {
          e.preventDefault();
          const v = Number(quantite.replace(',', '.'));
          if (!(v > 0)) return annoncer('Quantité invalide.');
          await corrigerFrigo({ type: 'correction', ingredient: choix, lieu, delta: v, date: aujourdhui() });
          annoncer(`${c.nom} ajouté.`);
          fermer();
        }}
      >
        <p>
          <strong>{majuscule(c.nom)}</strong>
        </p>
        <label>
          Quantité ({u === 'pièce' ? 'pièces' : u})
          <input inputMode="decimal" value={quantite} onChange={(e) => setQuantite(e.target.value)} autoFocus />
        </label>
        <label>
          Rangement
          <select value={lieu} onChange={(e) => setLieu(e.target.value as Lieu)}>
            {LIEUX.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}
              </option>
            ))}
          </select>
        </label>
        <div className="rangee-boutons">
          <button className="btn btn--plein" type="submit">
            Ajouter
          </button>
          <button className="btn btn--contour" type="button" onClick={() => setChoix(null)}>
            Autre article
          </button>
        </div>
      </form>
    );
  }
  return (
    <div className="formulaire">
      <label className="champ-recherche">
        <Icone nom="chercher" taille={18} />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Riz, œufs, épinards…" aria-label="Chercher un ingrédient" autoFocus />
      </label>
      <ul className="liste-choix">
        {resultats.map(([id, c]) => (
          <li key={id}>
            <button
              onClick={() => {
                setChoix(id);
                setLieu(c.rangement);
              }}
            >
              {majuscule(c.nom)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
