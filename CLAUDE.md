# Gamelle : règles du projet

PWA iPhone personnelle : menu hebdomadaire déj + dîner (7 jours, 14 repas), léger, pas cher, batch cooking.
Cahier des charges complet : `docs/cahier-des-charges.md`. Maquettes de référence : `docs/maquettes/`.

## Règles non négociables
- **Zéro invention.** Jamais de recette, source, auteur, prix ou valeur nutritionnelle inventés. Une estimation est marquée comme telle, avec sa méthode.
- **Sources vérifiées.** Chaque recette a au moins une source publique (article, TikTok, Instagram), vérifiée :
  HTTP 200 pour un article ; TikTok via la page d'intégration officielle `https://www.tiktok.com/embed/v2/<id>`
  (l'oEmbed TikTok répond pareil pour n'importe quel identifiant, il ne prouve rien) ; Instagram via l'oEmbed
  Meta sans jeton puis `/p/<code>/embed/captioned/` (auteur, légende). Lien mort → recette rejetée.
  Un 429 (limite de débit) n'est pas un lien mort : `npm run links` réessaie puis le classe « à revérifier ».
  Toujours s'identifier honnêtement (User-Agent « Gamelle/0.1 ») : ne jamais imiter un navigateur ni
  contourner un blocage anti-robot (Carrefour, Leclerc Drive, Intermarché bloquent : on n'y va pas).
- **Vidéos.** Une vidéo TikTok ou Instagram n'entre que si les quantités viennent de sa **légende complète**
  ou d'un **article du même créateur** (`quantites_depuis`). On ne devine jamais des grammages vus dans une vidéo.
- **Calories = Ciqual 2025 (Anses)**, recalculées par `npm run compute`. Ne jamais recopier les kcal d'un blog.
  Ingrédients pesés crus → valeur crue. Écart > 15 % avec les kcal annoncées → signalé dans `reports/nutrition.md`.
- **Droit d'auteur.** Étapes reformulées avec nos mots, jamais copiées. Aucune photo de blog, d'Instagram ou de TikTok.
  Les visuels sont des **illustrations SVG dessinées pour l'app** (style herbier/riso), une par famille de plat.
  Toujours créditer la source avec un lien, et écrire « adaptée de » quand on modifie.
- **Prix (Lyon).** Ordre (`npm run prices`, choix de l'utilisateur : « prends les prix Lidl ») : ticket saisi à la main
  → **Lidl** (relevés Open Prices faits dans les magasins Lidl de France, `npm run lidl` ; lidl.fr ne publie pas ses
  prix alimentaires et interdit sa recherche aux robots) → prix affiché sur aldi.fr (`npm run aldi`)
  → médiane Open Prices 12 mois Lyon → médiane Open Prices France (estimation). Filtres `mots` / `exclure`
  dans `data/prix-correspondances.json` pour comparer à produit équivalent. Conditionnements réels.
- **100 % gratuit, local, privé.** Aucune IA ni API payante appelée par l'app, pas de compte, pas de tracking.
  Aucune requête vers un tiers au chargement (sauf au tap sur une vidéo). Polices auto-hébergées.
- **Équipement autorisé** : plaques (2 feux), four, micro-ondes, rice cooker. Rien d'autre.
- **Profil** : 1 personne, Lyon (ville fixe), 950–1 150 kcal pour déj + dîner (~300 kcal libres),
  380–650 kcal et ≥ 20 g de protéines par repas, budget 25–35 € / semaine (viser 25–30 €).
  Frigo J+3 maximum, puis congélateur. Batch le dimanche pour la semaine suivante
  (lun., mar., mer. au frigo, le reste au congélateur), au plus 2 soirs de cuisine en semaine.

## Répartition visée de la base
~50 % batch (≥ 3 parts, frigo ≤ 3 j ou congelable), ~35 % express (≤ 20 min), ~15 % assemblage (sans cuisson).
≥ 40 % avec une source TikTok ou Instagram. Varier protéines, cuisines et saisons.

## Données
- `data/recipes/<slug>.json` : une recette, schéma Zod `src/domain/schema.ts`.
- `data/ciqual-map.json` : catalogue d'ingrédients (code Ciqual, rayon, rangement, conservation).
- `data/prix-reference.json` : un prix par ingrédient (conditionnement réel, enseigne, URL, date, méthode).
- `data/ciqual/ciqual-2025.min.json` : généré par `npm run ciqual` (Etalab 2.0, doi:10.57745/RDMHWY).
  Énergie absente mais macros présentes → recalculée (4P + 4G + 9L + 2F, UE 1169/2011), codes listés dans `kcal_recalculees`.
- `data/prix-correspondances.json` : pour chaque ingrédient, produit réel, conditionnement, référence Aldi, catégorie Open Prices.
- `npm run compute` remplit `ciqual_code`, `rayon`, `etat` des ingrédients depuis le catalogue : ne pas les éditer à la main.
- Mesures : 1 c. à soupe = 15 ml (huile 13,7 g), 1 c. à café = 5 ml, épice en poudre 1 c. à café = 2 g. Liquides en ml.
- Visuels : illustrations SVG par famille de plat dans `src/ui/illustrations/` (champ `illustration`), `image: null`.

## Moteur (src/domain, TypeScript pur, testé)
- `planner.ts` : menu déterministe (graine = semaine ISO + réglages) : 2 batchs le dimanche + 1 batch un soir de
  semaine (3–4 parts) + 2 à 4 express/assemblages. Assouplit saison puis historique puis budget en le disant
  (`menu.relachements`). Règles dans `regles.ts` (`verifierMenu`, dures vs souples).
- `courses.ts` (paquets, stock, placard de base, prix corrigés), `timeline.ts` (session batch en parallèle),
  `remplacement.ts` (3 alternatives), `echange.ts` (favori → créneaux, avertissements), `frigo.ts` (événements).
- `npm run simuler` : 52 semaines avec stock et historique → `reports/simulation.md`.
- Budget (simulé avec 83 recettes), ~35,5 € en caisse / semaine en moyenne (24/52 dans le budget, ~25 € mangés) : plus de
  variété = plus de paquets différents. Priorité de la base : recettes à moins de 2 € la part, qui réutilisent les mêmes paquets.

## Interface (src/app, src/ui, src/ecrans)
- `app/base.ts` : recettes, catalogue et prix lus au build (validés par Zod au démarrage).
- `app/db.ts` : Dexie (kv, favoris, menus, coches, evenements du frigo, prix corrigés, echanges, mesRecettes), export/import JSON.
- Recettes perso (`#/nouvelle`, id `perso-…`) : calculées sur le téléphone (lignes Ciqual du catalogue embarquées dans
  `virtual:gamelle-donnees`), ajoutées à `BASE` au démarrage (`main.tsx`) et envoyées au worker avec chaque génération.
- `app/etat.ts` : hooks (`useMenu`, `useContexte`, `useFrigo`…) et actions. Le menu est généré dans un worker
  (`generateur.worker.ts`) puis gardé par semaine ; un échange ou remplacement l'enregistre avec « Annuler ».
  Courses : le stock compté exclut les achats cochés de la semaine (sinon les lignes disparaîtraient).
- Routeur par ancre (`#/recette/<id>?s=<semaine>&c=<créneau>`), `?date=AAAA-MM-JJ` fige la date (démos, captures).
- `ui/composants.tsx` (Chiffre en double impression, Puce, BoutonPlus tampon, Etiquette, Feuille, annonces),
  `ui/Icone.tsx` (icônes au trait dessinées), `styles/tokens.css` + `styles/app.css`.
- Captures iPhone 15 : `npx vite build`, `npx vite preview --port 4173`, puis `node scripts/captures.mjs`.
- Données : module virtuel `virtual:gamelle-donnees` (`scripts/lib/vite-donnees.ts`) validé par Zod au build ;
  l'app n'embarque pas Zod (constantes dans `domain/constantes.ts`). Écrans en `lazy`, sauf Semaine.
- PWA : `vite-plugin-pwa` (generateSW, tout précaché, annonce « Recharger » à la mise à jour). Icône dessinée
  `public/icone.svg` → `node scripts/icones.mjs` (PNG + écrans de lancement iOS listés dans `index.html`).
  `BASE=/gamelle/` au build pour GitHub Pages. Lighthouse mobile (92 recettes, build Pages) : perf 96, accessibilité 100, bonnes pratiques 100.
- `npm run e2e` : build + Playwright (Chromium en émulation iPhone ; WebKit absent de la session cloud) :
  les 2 parcours du cahier des charges, hors ligne, manifeste, axe (a11y), minuteurs du mode cuisine.

## Commandes
Dans une session cloud, le `fetch` de Node passe par le proxy seulement avec `export NODE_USE_ENV_PROXY=1`.
- `npm run lidl` : relevés Open Prices des magasins Lidl → `data/prix-sources/lidl.json`.
- `npm run aldi` : relève les prix affichés sur aldi.fr → `data/prix-sources/aldi.json`.
- `npm run ciqual` : télécharge et convertit Ciqual.
- `npm run prices` : rafraîchit les prix Open Prices et écrit `reports/prix.md`.
- `npm run links` : revérifie toutes les sources (met à jour `verifie_le`).
- `npm run compute` : recalcule nutrition et coût par part de toutes les recettes.
- `npm run validate` : schéma, équipement, liens, Ciqual, prix → `reports/`. Doit passer avant tout commit de données.
- `npm run add-recipe -- <url>` : prépare un brouillon de fiche à montrer à l'utilisateur avant ajout.
- `npm test` : Vitest. `npm run e2e` : tests d'interface.

## Sources de recettes qui marchent
- Cuisine Addict (cuisine-addict.com, JSON-LD avec kcal et protéines) + ses posts Instagram de menus de batch cooking
  ou « La recette du jour » (@cuisineaddict) → `quantites_depuis: article-meme-createur`.
- Jow (jow.fr, JSON-LD par portion) + vidéos TikTok @jow_france (lunchbox : quantités dans la légende).
- Tri rapide d'une liste d'URL par kcal/protéines annoncées : `.cache/tri.mjs` (outil local, non versionné).

## Ajouter des recettes (« ajoute 20 recettes d'hiver », « ajoute cette vidéo TikTok »)
1. `npm run add-recipe -- <url>` → brouillon dans `.cache/brouillons/`.
2. Compléter : ingrédients mappés au catalogue (ajouter ingrédient + prix si nouveau), étapes reformulées,
   durées et appareils par étape, saison, protéine, illustration.
3. `npm run compute && npm run validate`, puis montrer la fiche à l'utilisateur avant de la commiter.

## Design « Herbier imprimé en risographie »
Tokens : papier `#F4EEE1`, papier clair `#FAF6EC`, encre `#24402F`, encre douce `#4F5E53`, sauge `#A8BBA0`/`#DCE5D3`,
menthe `#8FD3B0`, rose `#F4A6A6`, abricot `#EDB99A`. Polices : Young Serif (titres), Bricolage Grotesque 700–800
(gros chiffres, double impression rose décalée), Schibsted Grotesk (texte). Grain papier, trames, filets en tirets,
illustrations au trait avec aplats décalés. Interdits : dégradés violet/bleu, glassmorphism, ombres floues,
bordure colorée à gauche, emoji comme icônes, Inter/Roboto/Poppins/Montserrat, icônes pleines, blobs 3D.
Interface en français, formats français (« 1 010 kcal », « 0,99 € », « lun. 16 »). Cibles tactiles ≥ 44 px.

## Mise en ligne (jalon 6)
- GitHub Pages : https://matthiasc71.github.io/gamelle/ (dépôt public). `.github/workflows/deploiement.yml` construit
  avec `BASE=/<dépôt>/` et publie à chaque push sur main (Pages → Source : GitHub Actions, activé). En ligne depuis le 9 novembre 2026.
- `.github/workflows/donnees-mensuelles.yml` : le 2 du mois, prix + liens + compute + validate + simulation, commit
  puis `gh workflow run deploiement.yml` (un push du jeton du workflow ne déclenche pas les autres workflows).
- README : installation iPhone, rappel Raccourcis, sauvegarde, ajout de recettes, prix.

## Travail
Commits petits et clairs. Demander avant toute action irréversible (visibilité du dépôt, suppression de données,
domaine). Si un site est bloqué par le réseau, le dire au lieu de contourner.
