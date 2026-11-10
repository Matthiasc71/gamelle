import { useMemo, useState } from 'react';
import { BASE } from '../app/base';
import { basculerFavori, useAvis, useFavoris, useReglages } from '../app/etat';
import { TYPE_RECETTE } from '../app/presentation';
import { lien } from '../app/routeur';
import { euros, kcal } from '../domain/format';
import type { Recette } from '../domain/schema';
import { annoncer, BoutonPlus, Fleuron, Illustration, Rubrique } from '../ui/composants';
import { Icone } from '../ui/Icone';

type Tri = 'nom' | 'kcal' | 'prix' | 'temps';
type Filtre = 'tous' | 'saison' | Recette['type'];

const sansAccents = (s: string) => s.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/\p{Diacritic}/gu, '');

export default function Favoris() {
  const favoris = useFavoris();
  const reglages = useReglages();
  const avis = useAvis();
  const [q, setQ] = useState('');
  const [tri, setTri] = useState<Tri>('nom');
  const [filtre, setFiltre] = useState<Filtre>('tous');

  const liste = useMemo(() => {
    const mots = sansAccents(q).split(/\s+/).filter(Boolean);
    const ok = (r: Recette) =>
      (filtre === 'tous' || (filtre === 'saison' ? r.saison.includes(new Date().getMonth() + 1) : r.type === filtre)) &&
      mots.every((m) => sansAccents(`${r.nom} ${r.cuisine} ${r.ingredients.map((i) => i.nom_affiche).join(' ')}`).includes(m));
    const cle: Record<Tri, (r: Recette) => number | string> = {
      nom: (r) => r.nom,
      kcal: (r) => r.nutrition_par_part.kcal,
      prix: (r) => r.cout_par_part_eur,
      temps: (r) => r.temps.total_min,
    };
    return BASE.recettes.filter(ok).sort((a, b) => {
      const x = cle[tri](a);
      const y = cle[tri](b);
      return typeof x === 'string' ? x.localeCompare(y as string, 'fr') : x - (y as number);
    });
  }, [q, tri, filtre]);

  if (!favoris || !reglages || !avis) return null;
  const gardees = liste.filter((r) => favoris.has(r.id));
  const autres = liste.filter((r) => !favoris.has(r.id));

  return (
    <main className="ecran" aria-labelledby="titre-favoris">
      <header className="tete-ligne">
        <h1 id="titre-favoris" className="titre-page">
          Recettes
        </h1>
        <a className="bouton-icone bouton-icone--plein" href={lien('nouvelle')} aria-label="Ajouter ma recette">
          <Icone nom="plus" />
        </a>
      </header>

      <div className="recherche">
        <label className="champ-recherche">
          <Icone nom="chercher" taille={18} />
          <input type="search" placeholder="Plat, ingrédient…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher une recette" />
        </label>
        <label className="select">
          <span className="sr-only">Trier par</span>
          <select value={tri} onChange={(e) => setTri(e.target.value as Tri)}>
            <option value="nom">Nom</option>
            <option value="kcal">Calories</option>
            <option value="prix">Prix</option>
            <option value="temps">Temps</option>
          </select>
        </label>
      </div>
      <div className="filtres" role="group" aria-label="Type de recette">
        {(['tous', 'saison', 'batch', 'express', 'assemblage'] as const).map((f) => (
          <button key={f} aria-pressed={filtre === f} onClick={() => setFiltre(f)}>
            {f === 'tous' ? 'Toutes' : f === 'saison' ? 'De saison' : TYPE_RECETTE[f]}
          </button>
        ))}
      </div>

      <section aria-labelledby="mes-favoris">
        <Rubrique id="mes-favoris">Mes favoris</Rubrique>
        {gardees.length ? (
          <Grille recettes={gardees} favoris={favoris} avis={avis} />
        ) : (
          <p className="vide">
            {favoris.size ? 'Aucun favori ne correspond à ta recherche.' : 'Touche + sur une recette pour la garder ici, puis touche-la pour la mettre dans ta semaine.'}
          </p>
        )}
      </section>

      <section aria-labelledby="toute-la-base">
        <Rubrique id="toute-la-base">Toute la base · {autres.length}</Rubrique>
        {filtre === 'tous' && !q.trim() ? (
          (['batch', 'express', 'assemblage'] as const).map((t) => (
            <Groupe key={t} titre={TYPE_RECETTE[t]} recettes={autres.filter((r) => r.type === t)} favoris={favoris} avis={avis} pas={6} />
          ))
        ) : autres.length ? (
          <Groupe recettes={autres} favoris={favoris} avis={avis} pas={12} key={`${filtre}|${q}`} />
        ) : (
          <p className="vide">Aucune recette ne correspond.</p>
        )}
      </section>
      <Fleuron />
    </main>
  );
}

/** Un groupe de cartes montré par paquets (« Voir les N autres »). */
function Groupe({ titre, recettes, favoris, avis, pas }: { titre?: string; recettes: Recette[]; favoris: Set<string>; avis: Record<string, 'aime' | 'bof'>; pas: number }) {
  const [n, setN] = useState(pas);
  if (!recettes.length) return null;
  const reste = recettes.length - n;
  return (
    <div className="groupe-recettes">
      {titre && (
        <h3 className="groupe-recettes__titre">
          <Icone nom="feuille" taille={16} /> {titre} <span className="texte-doux">· {recettes.length}</span>
        </h3>
      )}
      <Grille recettes={recettes.slice(0, n)} favoris={favoris} avis={avis} />
      {reste > 0 && (
        <button className="btn btn--contour btn--petit voir-plus" onClick={() => setN((x) => x + pas * 2)}>
          Voir {reste > pas * 2 ? `${pas * 2} de plus` : `les ${reste} autres`}
        </button>
      )}
    </div>
  );
}

function Grille({ recettes, favoris, avis }: { recettes: Recette[]; favoris: Set<string>; avis: Record<string, 'aime' | 'bof'> }) {
  return (
    <ul className="grille">
      {recettes.map((r) => (
        <li key={r.id} className={`carte-recette ${avis[r.id] === 'bof' ? 'carte-recette--bof' : ''}`}>
          <a href={lien('recette', r.id, { depuis: 'favoris' })} className="carte-recette__lien">
            <span className="carte-recette__illus">
              <Illustration nom={r.illustration} taille={96} />
            </span>
            <span className="carte-recette__nom">{r.nom}</span>
            <span className="carte-recette__detail">
              {kcal(r.nutrition_par_part.kcal)} · {euros(r.cout_par_part_eur)} · {r.temps.total_min} min
            </span>
            {avis[r.id] && (
              <span className={`carte-recette__avis carte-recette__avis--${avis[r.id]}`}>
                <Icone nom={avis[r.id] === 'aime' ? 'coeur' : 'bof'} taille={13} /> {avis[r.id] === 'aime' ? 'J’en reveux' : 'Pas pour moi'}
              </span>
            )}
          </a>
          <span className="carte-recette__plus">
            <BoutonPlus
              actif={favoris.has(r.id)}
              nom={r.nom}
              clair
              onBasculer={async () => {
                if (!(await basculerFavori(r.id))) annoncer('Retirée des favoris.');
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
