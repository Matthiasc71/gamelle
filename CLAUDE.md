# Gamelle : règles du projet

PWA iPhone personnelle : menu hebdomadaire déj + dîner (7 jours, 14 repas), léger, pas cher, batch cooking.
Cahier des charges complet : `docs/cahier-des-charges.md`. Maquettes de référence : `docs/maquettes/`.

## Règles non négociables
- **Zéro invention.** Jamais de recette, source, auteur, prix ou valeur nutritionnelle inventés. Une estimation est marquée comme telle, avec sa méthode.
- **Sources vérifiées.** Chaque recette a au moins une source publique (article, TikTok, Instagram), vérifiée :
  HTTP 200 pour un article, oEmbed pour TikTok (`https://www.tiktok.com/oembed?url=`) et Instagram
  (`https://graph.facebook.com/v21.0/instagram_oembed?url=`, sans jeton). Lien mort → recette rejetée.
- **Vidéos.** Une vidéo TikTok ou Instagram n'entre que si les quantités viennent de sa **légende complète**
  ou d'un **article du même créateur** (`quantites_depuis`). On ne devine jamais des grammages vus dans une vidéo.
- **Calories = Ciqual 2025 (Anses)**, recalculées par `npm run compute`. Ne jamais recopier les kcal d'un blog.
  Ingrédients pesés crus → valeur crue. Écart > 15 % avec les kcal annoncées → signalé dans `reports/nutrition.md`.
- **Droit d'auteur.** Étapes reformulées avec nos mots, jamais copiées. Aucune photo de blog, d'Instagram ou de TikTok.
  Les visuels sont des **illustrations SVG dessinées pour l'app** (style herbier/riso), une par famille de plat.
  Toujours créditer la source avec un lien, et écrire « adaptée de » quand on modifie.
- **Prix (Lyon).** Ordre : Open Prices (médiane 12 mois, Lyon et environs) → prix relevés sur le site d'une enseigne
  (`site-enseigne`, avec URL et date) → médiane Open Prices France (marquée estimation). Conditionnements réels.
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

## Commandes
- `npm run ciqual` : télécharge et convertit Ciqual.
- `npm run prices` : rafraîchit les prix Open Prices et écrit `reports/prix.md`.
- `npm run links` : revérifie toutes les sources (met à jour `verifie_le`).
- `npm run compute` : recalcule nutrition et coût par part de toutes les recettes.
- `npm run validate` : schéma, équipement, liens, Ciqual, prix → `reports/`. Doit passer avant tout commit de données.
- `npm run add-recipe -- <url>` : prépare un brouillon de fiche à montrer à l'utilisateur avant ajout.
- `npm test` : Vitest.

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

## Travail
Commits petits et clairs. Demander avant toute action irréversible (visibilité du dépôt, suppression de données,
domaine). Si un site est bloqué par le réseau, le dire au lieu de contourner.
