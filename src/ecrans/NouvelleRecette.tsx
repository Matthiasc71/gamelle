import { useMemo, useState } from 'react';
import { ajouterRecettesPerso, BASE, CIQUAL } from '../app/base';
import { db } from '../app/db';
import { aujourdhui, basculerFavori } from '../app/etat';
import { majuscule, NOM_EQUIPEMENT, nombre } from '../app/presentation';
import { aller, lien, retour } from '../app/routeur';
import { EQUIPEMENTS, ILLUSTRATIONS, PROTEINES } from '../domain/constantes';
import { euros, kcal } from '../domain/format';
import { nutritionParPart } from '../domain/nutrition';
import { coutParPart } from '../domain/pricing';
import type { Equipement, IngredientRecette, Recette } from '../domain/schema';
import { annoncer, BoutonIcone, Compteur, Illustration, Interrupteur, Rubrique } from '../ui/composants';
import { Icone } from '../ui/Icone';

type Ligne = { ingredient: string; quantite: string; unite: 'g' | 'ml' | 'pièce' };

const NOM_ILLUS: Record<(typeof ILLUSTRATIONS)[number], string> = {
  'curry-bol': 'Curry, dahl', soupe: 'Soupe', poelee: 'Poêlée', gratin: 'Gratin, four', omelette: 'Œufs',
  salade: 'Salade, bowl', wrap: 'Sandwich, wrap', pates: 'Pâtes, nouilles', ragout: 'Mijoté', poisson: 'Poisson',
};
const NOM_PROT: Record<(typeof PROTEINES)[number], string> = {
  oeufs: 'Œufs', legumineuses: 'Légumineuses', poulet: 'Poulet', dinde: 'Dinde', porc: 'Porc', boeuf: 'Bœuf', thon: 'Thon',
  sardines: 'Sardines', maquereau: 'Maquereau', 'poisson-blanc': 'Poisson blanc', saumon: 'Saumon', tofu: 'Tofu', laitier: 'Produits laitiers',
};

const norm = (s: string) => s.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/\p{Diacritic}/gu, '');
const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'recette';
const typeSource = (url: string) => (/tiktok\.com/.test(url) ? 'tiktok' : /instagram\.com/.test(url) ? 'instagram' : 'article') as Recette['sources'][number]['type'];

/** Poids en grammes d'une ligne : grammes, ml comptés 1 g (estimation), ou pièces au poids de la grille de prix. */
function poids(l: Ligne): number | null {
  const q = Number(l.quantite.replace(',', '.'));
  if (!(q > 0)) return null;
  if (l.unite === 'pièce') {
    const p = BASE.prix[l.ingredient]?.poids_piece_g;
    return p ? q * p : null;
  }
  return q;
}

export default function NouvelleRecette() {
  const [url, setUrl] = useState('');
  const [nom, setNom] = useState('');
  const [auteur, setAuteur] = useState('');
  const [type, setType] = useState<Recette['type']>('express');
  const [portions, setPortions] = useState(1);
  const [total, setTotal] = useState('15');
  const [equipement, setEquipement] = useState<Equipement[]>(['plaques']);
  const [frigo, setFrigo] = useState(1);
  const [congelable, setCongelable] = useState(false);
  const [illus, setIllus] = useState<(typeof ILLUSTRATIONS)[number]>('salade');
  const [proteine, setProteine] = useState<(typeof PROTEINES)[number]>('poulet');
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [etapes, setEtapes] = useState('');
  const [q, setQ] = useState('');

  const propositions = q
    ? Object.entries(BASE.catalogue)
        .filter(([, c]) => norm(c.nom).includes(norm(q)))
        .slice(0, 6)
    : [];

  const ingredients: IngredientRecette[] = lignes.flatMap((l) => {
    const g = poids(l);
    const c = BASE.catalogue[l.ingredient];
    if (g === null || !c) return [];
    return [{ ingredient: l.ingredient, ciqual_code: c.ciqual_code, nom_affiche: c.nom, quantite: Number(l.quantite.replace(',', '.')), unite: l.unite, poids_g: g, etat: c.etat, rayon: c.rayon, optionnel: false }];
  });

  const calcul = useMemo(() => {
    if (!ingredients.length) return null;
    try {
      const { nutrition } = nutritionParPart(ingredients, portions, CIQUAL);
      let cout: number | null = null;
      try {
        cout = coutParPart(ingredients, portions, BASE.prix);
      } catch {
        cout = null;
      }
      return { nutrition, cout };
    } catch (e) {
      return { erreur: (e as Error).message };
    }
  }, [ingredients, portions]);

  const textes = etapes.split('\n').map((t) => t.trim()).filter((t) => t.length >= 10);
  const totalMin = Math.max(1, Math.round(Number(total) || 0));
  const problemes: string[] = [];
  if (!/^https?:\/\/\S+\.\S+/.test(url)) problemes.push('Colle le lien de la recette (article, TikTok ou Instagram).');
  if (nom.trim().length < 3) problemes.push('Donne un nom à la recette.');
  if (ingredients.length < 2) problemes.push('Ajoute au moins deux ingrédients avec leur quantité.');
  if (!textes.length) problemes.push('Écris au moins une étape (une ligne par étape, 10 caractères minimum).');
  if (type === 'express' && totalMin > 20) problemes.push('Une recette express prend 20 minutes maximum.');
  if (type === 'batch' && portions < 3) problemes.push('Un batch fait au moins 3 parts.');
  if (type === 'assemblage' && equipement.some((e) => e !== 'micro-ondes')) problemes.push('Un assemblage se fait sans cuisson (micro-ondes toléré).');
  if (calcul && 'erreur' in calcul) problemes.push(calcul.erreur!);

  const enregistrer = async () => {
    if (problemes.length || !calcul || 'erreur' in calcul) return;
    const id = `perso-${slug(nom)}-${Date.now().toString(36)}`;
    const t = typeSource(url);
    const r: Recette = {
      id,
      slug: id,
      nom: nom.trim(),
      resume: `Ma recette, ajoutée sur mon téléphone d'après ${t === 'article' ? 'un article' : t === 'tiktok' ? 'une vidéo TikTok' : 'un post Instagram'}.`,
      type,
      portions_base: portions,
      conservation: { frigo_jours: frigo, congelable },
      temps: { prepa_min: 0, cuisson_min: 0, total_min: totalMin, actif_min: totalMin },
      equipement,
      saison: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      cuisine: 'maison',
      proteine_principale: proteine,
      creneaux: type === 'assemblage' ? ['midi'] : ['midi', 'soir'],
      illustration: illus,
      ingredients,
      etapes: textes.map((texte) => ({ texte, duree_min: Math.max(1, Math.round(totalMin / textes.length)), actif: true })),
      sources: [
        {
          type: t,
          url: url.trim(),
          titre: nom.trim(),
          auteur: auteur.trim() || (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'source'; } })(),
          verifie_le: aujourdhui(),
          ...(t === 'article' ? {} : { quantites_depuis: 'legende' as const }),
        },
      ],
      image: null,
      nutrition_par_part: calcul.nutrition!,
      cout_par_part_eur: calcul.cout ?? 0,
      verifications: { source_ok: false, nutrition_ok: true, prix_ok: calcul.cout !== null, notes: 'Recette saisie sur le téléphone : lien non vérifié par Gamelle, calories calculées avec Ciqual.' },
    };
    await db.mesRecettes.put(r);
    ajouterRecettesPerso([r]);
    await basculerFavori(id);
    annoncer('Recette ajoutée à tes favoris.');
    aller(lien('recette', id, { depuis: 'favoris' }), true);
  };

  return (
    <main className="ecran" aria-labelledby="titre-nouvelle">
      <div className="barre-retour">
        <BoutonIcone icone="retour" label="Retour" onClick={() => retour(lien('favoris'))} />
      </div>
      <p className="kicker">Favoris · ma recette</p>
      <h1 id="titre-nouvelle" className="titre-page titre-page--moyen">
        Ajouter une recette
      </h1>
      <p className="texte-doux petit">Calories calculées avec la table Ciqual, prix avec la grille de Gamelle. Tout reste sur ce téléphone.</p>

      <section className="groupe formulaire" aria-labelledby="n-source">
        <Rubrique id="n-source">Source</Rubrique>
        <label>
          Lien (article, TikTok ou Instagram)
          <input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="champ-texte" />
        </label>
        <label>
          Nom de la recette
          <input value={nom} onChange={(e) => setNom(e.target.value)} className="champ-texte" />
        </label>
        <label>
          Auteur ou compte (facultatif)
          <input value={auteur} onChange={(e) => setAuteur(e.target.value)} className="champ-texte" placeholder="@compte" />
        </label>
      </section>

      <section className="groupe" aria-labelledby="n-type">
        <Rubrique id="n-type">Type et parts</Rubrique>
        <div className="segments segments--petits" role="group" aria-label="Type de recette">
          {(['express', 'batch', 'assemblage'] as const).map((t) => (
            <button key={t} aria-pressed={type === t} onClick={() => setType(t)}>
              {t === 'express' ? 'Express (≤ 20 min)' : t === 'batch' ? 'Batch (3 parts et +)' : 'Sans cuisson'}
            </button>
          ))}
        </div>
        <div className="champ">
          <span>Parts</span>
          <Compteur valeur={portions} min={1} max={8} onChange={setPortions} label="Nombre de parts" />
        </div>
        <label className="champ">
          <span>Temps total</span>
          <span className="champ__saisie">
            <input inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} /> min
          </span>
        </label>
        <fieldset className="cases">
          <legend>Équipement</legend>
          {EQUIPEMENTS.map((e) => (
            <label key={e} className="case">
              <input type="checkbox" checked={equipement.includes(e)} onChange={(ev) => setEquipement(ev.target.checked ? [...equipement, e] : equipement.filter((x) => x !== e))} />
              <span className="case__boite" aria-hidden="true">
                <Icone nom="coche" taille={16} />
              </span>
              {NOM_EQUIPEMENT[e]}
            </label>
          ))}
        </fieldset>
        <div className="champ">
          <span>Jours au frigo</span>
          <Compteur valeur={frigo} min={0} max={3} onChange={setFrigo} label="Jours au frigo" />
        </div>
        <Interrupteur label="Se congèle" actif={congelable} onChange={setCongelable} />
        <label className="champ">
          <span>Protéine principale</span>
          <select value={proteine} onChange={(e) => setProteine(e.target.value as typeof proteine)}>
            {PROTEINES.map((p) => (
              <option key={p} value={p}>
                {NOM_PROT[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="champ">
          <span>Illustration</span>
          <span className="champ__saisie">
            <Illustration nom={illus} taille={40} />
            <select value={illus} onChange={(e) => setIllus(e.target.value as typeof illus)}>
              {ILLUSTRATIONS.map((i) => (
                <option key={i} value={i}>
                  {NOM_ILLUS[i]}
                </option>
              ))}
            </select>
          </span>
        </label>
      </section>

      <section className="groupe" aria-labelledby="n-ing">
        <Rubrique id="n-ing">Ingrédients · {portions} part{portions > 1 ? 's' : ''}</Rubrique>
        <ul className="lignes-saisie">
          {lignes.map((l, i) => {
            const c = BASE.catalogue[l.ingredient];
            const piece = !!BASE.prix[l.ingredient]?.poids_piece_g;
            const maj = (p: Partial<Ligne>) => setLignes(lignes.map((x, j) => (j === i ? { ...x, ...p } : x)));
            return (
              <li key={i} className="ligne-saisie">
                <span className="ligne-saisie__nom">{majuscule(c?.nom ?? l.ingredient)}</span>
                <input inputMode="decimal" value={l.quantite} onChange={(e) => maj({ quantite: e.target.value })} aria-label={`Quantité de ${c?.nom}`} />
                <select value={l.unite} onChange={(e) => maj({ unite: e.target.value as Ligne['unite'] })} aria-label="Unité">
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  {piece && <option value="pièce">pièce(s)</option>}
                </select>
                <button className="bouton-icone bouton-icone--nu" aria-label={`Retirer ${c?.nom}`} onClick={() => setLignes(lignes.filter((_, j) => j !== i))}>
                  <Icone nom="poubelle" />
                </button>
              </li>
            );
          })}
        </ul>
        <label className="champ-recherche">
          <Icone nom="chercher" taille={18} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ajouter un ingrédient du catalogue…" aria-label="Chercher un ingrédient" />
        </label>
        {propositions.length > 0 && (
          <ul className="liste-choix">
            {propositions.map(([id, c]) => (
              <li key={id}>
                <button
                  onClick={() => {
                    setLignes([...lignes, { ingredient: id, quantite: '', unite: BASE.prix[id]?.conditionnement.unite === 'pièce' && BASE.prix[id]?.poids_piece_g ? 'pièce' : BASE.prix[id]?.conditionnement.unite === 'ml' ? 'ml' : 'g' }]);
                    setQ('');
                  }}
                >
                  {majuscule(c.nom)}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="texte-doux petit">
          {Object.keys(BASE.catalogue).length} ingrédients disponibles. Les quantités en ml sont comptées 1 g par ml (estimation) ; le sel, le poivre et les épices en
          pincée ne comptent pas.
        </p>
      </section>

      <section className="groupe formulaire" aria-labelledby="n-etapes">
        <Rubrique id="n-etapes">Étapes</Rubrique>
        <label>
          Une ligne par étape, avec tes mots
          <textarea rows={6} value={etapes} onChange={(e) => setEtapes(e.target.value)} className="champ-texte" />
        </label>
      </section>

      {calcul && !('erreur' in calcul) && (
        <section className="note" aria-live="polite">
          <p>
            <strong>{kcal(calcul.nutrition!.kcal)}</strong> · prot. {nombre(calcul.nutrition!.proteines_g, 1)} g par part ·{' '}
            {calcul.cout !== null ? `${euros(calcul.cout)} / part` : 'prix incomplet'}
          </p>
          {(calcul.nutrition!.kcal < 380 || calcul.nutrition!.kcal > 650 || calcul.nutrition!.proteines_g < 20) && (
            <p className="petit">Hors de tes repères (380–650 kcal, 20 g de protéines) : elle restera dans tes favoris, le menu la proposera rarement.</p>
          )}
        </section>
      )}

      {problemes.length > 0 && (
        <ul className="texte-doux petit">
          {problemes.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div className="rangee-boutons">
        <button className="btn btn--plein" disabled={problemes.length > 0} onClick={enregistrer}>
          Enregistrer ma recette
        </button>
      </div>
    </main>
  );
}
