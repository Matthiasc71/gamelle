import { useMemo, useState } from 'react';
import { BASE } from '../app/base';
import { basculerFavori, enregistrerReglages, useFavoris, useReglages } from '../app/etat';
import { TYPE_RECETTE } from '../app/presentation';
import { lien } from '../app/routeur';
import { euros, kcal } from '../domain/format';
import type { Recette } from '../domain/schema';
import { annoncer, BoutonPlus, Brin, Illustration, Interrupteur, Rubrique } from '../ui/composants';
import { Icone } from '../ui/Icone';

type Tri = 'nom' | 'kcal' | 'prix' | 'temps';
type Filtre = 'tous' | 'saison' | Recette['type'];

const sansAccents = (s: string) => s.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/\p{Diacritic}/gu, '');

export default function Favoris() {
  const favoris = useFavoris();
  const reglages = useReglages();
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

  if (!favoris || !reglages) return null;
  const gardees = liste.filter((r) => favoris.has(r.id));
  const autres = liste.filter((r) => !favoris.has(r.id));

  return (
    <main className="ecran" aria-labelledby="titre-favoris">
      <header className="tete-simple">
        <Brin className="tete-simple__brin" />
        <p className="kicker">Favoris · {favoris.size} gardée{favoris.size > 1 ? 's' : ''}</p>
        <h1 id="titre-favoris" className="titre-page">
          Recettes gardées
        </h1>
        <a className="btn btn--contour btn--petit" href={lien('nouvelle')}>
          <Icone nom="plus" taille={18} /> Ajouter ma recette
        </a>
      </header>

      <Interrupteur
        label="Inclure mes favoris dans les prochains menus"
        aide="1 à 2 favoris par semaine, même s’ils ont été servis récemment."
        actif={reglages.favorisInclus}
        onChange={(v) => enregistrerReglages({ favorisInclus: v })}
      />

      <div className="recherche">
        <label className="champ-recherche">
          <Icone nom="chercher" taille={18} />
          <input type="search" placeholder="Chercher un plat, un ingrédient…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher une recette" />
        </label>
        <label className="select">
          <span className="sr-only">Trier par</span>
          <select value={tri} onChange={(e) => setTri(e.target.value as Tri)}>
            <option value="nom">Nom</option>
            <option value="kcal">Calories</option>
            <option value="prix">Prix par part</option>
            <option value="temps">Temps</option>
          </select>
        </label>
      </div>
      <div className="segments segments--petits" role="group" aria-label="Type de recette">
        {(['tous', 'saison', 'batch', 'express', 'assemblage'] as const).map((f) => (
          <button key={f} aria-pressed={filtre === f} onClick={() => setFiltre(f)}>
            {f === 'tous' ? 'Toutes' : f === 'saison' ? 'De saison' : TYPE_RECETTE[f]}
          </button>
        ))}
      </div>

      <section aria-labelledby="mes-favoris">
        <Rubrique id="mes-favoris">Mes favoris</Rubrique>
        {gardees.length ? (
          <Grille recettes={gardees} favoris={favoris} />
        ) : (
          <p className="vide">
            {favoris.size ? 'Aucun favori ne correspond à ta recherche.' : 'Touche + sur une recette pour la garder ici, puis touche-la pour la mettre dans ta semaine.'}
          </p>
        )}
      </section>

      <section aria-labelledby="toute-la-base">
        <Rubrique id="toute-la-base">Toute la base · {autres.length}</Rubrique>
        <Grille recettes={autres} favoris={favoris} />
      </section>
    </main>
  );
}

function Grille({ recettes, favoris }: { recettes: Recette[]; favoris: Set<string> }) {
  return (
    <ul className="grille">
      {recettes.map((r) => (
        <li key={r.id} className="carte-recette">
          <a href={lien('recette', r.id, { depuis: 'favoris' })} className="carte-recette__lien">
            <span className="carte-recette__illus">
              <Illustration nom={r.illustration} taille={96} />
            </span>
            <span className="carte-recette__nom">{r.nom}</span>
            <span className="carte-recette__detail">
              {kcal(r.nutrition_par_part.kcal)} · {euros(r.cout_par_part_eur)} · {r.temps.total_min} min
            </span>
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
