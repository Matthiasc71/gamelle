# Prompt — Construire « Gamelle », mon app iPhone de recettes légères, pas chères et en batch

Tu es un développeur front-end senior doublé d'un designer produit exigeant et d'un diététicien rigoureux. Tu vas construire de A à Z, puis mettre en ligne gratuitement, une application personnelle pour iPhone appelée **Gamelle**.

**Avant d'écrire la moindre ligne de code :** lis tout ce document, pose-moi tes questions s'il reste des zones floues, puis présente-moi ton plan (architecture, arborescence, étapes) et attends mon feu vert. Ensuite, avance jalon par jalon (section 10) et montre-moi le résultat à la fin de chaque jalon.

---

## 1. Ce que fait l'app

Chaque semaine, Gamelle me propose automatiquement un **menu complet déjeuner + dîner pour 7 jours**, composé de **vraies recettes vérifiées**, **très peu caloriques**, **pas chères**, **rapides ou cuisinées en grande quantité pour plusieurs jours**. Elle me donne le **planning jour par jour**, le **prix**, la **liste de courses**, des **photos** et les **liens vers l'article, le post Instagram ou la vidéo TikTok d'origine**. Je peux **garder mes recettes préférées** avec un bouton **+**, puis **toucher un favori pour qu'il remplace un plat de ma semaine**. Le menu, la liste de courses et le **frigo** se mettent alors à jour tout seuls.

## 2. Mon profil (valeurs par défaut, toutes modifiables dans les Réglages)

- **1 personne**, je planifie **le déjeuner et le dîner** (7 jours = 14 repas).
- **Objectif : 1 200 à 1 500 kcal par jour au total.** L'app planifie **950 à 1 150 kcal pour déj + dîner** et laisse **~300 kcal libres** pour le petit-déjeuner et les en-cas. Elle affiche clairement ce reste.
- Par repas : **380 à 650 kcal**, **au moins 20 g de protéines** (au moins 50 g par jour sur déj + dîner) et **au moins une portion de légumes**.
- **Budget : 25 à 35 € par semaine**, prix à la caisse. Vise 25 à 30 €, ne dépasse jamais 35 €.
- **Ville : Lyon.** Prix basés sur les supermarchés autour de ma ville. La ville se change dans les Réglages.
- **Je mange de tout**, sans allergie. Prévois quand même une liste « aliments exclus » dans les Réglages.
- **Équipement : four, plaques (2 feux par défaut), micro-ondes, rice cooker.** Aucune recette ne doit demander autre chose (pas d'airfryer, pas de robot).
- **Style de cuisine :** soit **très rapide** (≤ 20 min, recettes « giga simples » acceptées, même de l'assemblage sans cuisson), soit **en grande quantité** pour plusieurs repas (batch cooking). Je veux une **session batch le dimanche** d'au plus 60 à 75 min, et au maximum **2 soirs de cuisine en semaine**.

## 3. Contraintes non négociables

1. **100 % gratuit** : hébergement, données, API. Aucune clé payante, aucun abonnement, **aucune IA appelée par l'app**. Toute l'« intelligence » (générer le menu, remplacer une recette, calculer les prix) tourne **sur le téléphone, en local**.
2. **Web app installable sur l'écran d'accueil de l'iPhone (PWA)** : plein écran, icône, fonctionne **hors ligne** au supermarché.
3. **Zéro recette inventée.** Chaque recette vient d'une **source publique réelle et vérifiée** (article de blog ou de site de recettes, post Instagram, vidéo TikTok). Si tu ne peux pas vérifier une source, la recette n'entre pas dans la base.
4. **Calories vérifiées** avec la **table Ciqual de l'Anses** (base nutritionnelle officielle française, en open data, mise à jour en novembre 2025). Ne jamais recopier les calories annoncées par un blog sans les recalculer.
5. **Respect du droit d'auteur** : reformule les étapes avec tes propres mots (ne copie jamais le texte d'un blog), ne télécharge jamais les photos d'un blog, d'Instagram ou de TikTok, et crédite toujours la source avec un lien.
6. **Mes données restent sur mon téléphone** (favoris, coches, frigo, historique, réglages). Pas de compte, pas de tracking, pas d'analytics.
7. Interface **en français**, formats français (« 1 010 kcal », « 0,99 € », « lun. 16 »).

## 4. Stack technique imposée

- **Vite + React + TypeScript** (strict), **vite-plugin-pwa** (Workbox) pour le service worker et le manifest.
- **Dexie (IndexedDB)** pour les données locales. Ajoute un **export / import JSON** de sauvegarde dans les Réglages.
- **Zod** pour valider le schéma des recettes au build. **Vitest** pour les tests, **Playwright (WebKit, viewport iPhone 15 : 393×852)** pour les tests d'interface.
- Polices **auto-hébergées** via `@fontsource` (pas d'appel à Google Fonts au runtime, pour le hors-ligne et la vie privée).
- Scripts de données en **Node + TypeScript** (`tsx`) dans `scripts/`, exécutés **au build ou à la main**, jamais dans l'app.
- **Hébergement gratuit : GitHub Pages** via une GitHub Action (repo public). Si je préfère un repo privé : Cloudflare Pages (gratuit). Pense au `base` de Vite pour Pages.
- Côté iOS, gère : `apple-touch-icon`, `apple-mobile-web-app-*`, les safe areas (`env(safe-area-inset-*)`), une splash screen, et un `theme-color` assorti au papier.
- **Écran allumé en mode cuisine** avec l'API **Screen Wake Lock**. Elle marche dans les web apps de l'écran d'accueil depuis iOS 18.4. Enveloppe-la dans un try/catch avec un message de repli.
- **Pas de notifications push** en v1 (il faudrait un serveur). À la place, documente dans le README comment créer un rappel « menu de la semaine prêt » avec l'app **Raccourcis** d'iOS.

## 5. Les données : comment construire une base de recettes vraiment vérifiée

### 5.1 Schéma d'une recette (`data/recipes/<slug>.json`, validé par Zod)

```
id, slug, nom, resume (1 phrase)
type: "batch" | "express" | "assemblage"
portions_base (ex. 4 pour un batch), conservation: { frigo_jours (max 3), congelable: bool }
temps: { prepa_min, cuisson_min, total_min, actif_min }
equipement: ["plaques" | "four" | "micro-ondes" | "rice-cooker"]
saison: [mois 1–12], cuisine (ex. "indienne", "lyonnaise", "mexicaine"…), proteine_principale
ingredients: [{ ciqual_code, nom_affiche, quantite, unite ("g"|"ml"|"pièce"), poids_g, etat ("cru"|"cuit"|"égoutté"), rayon, optionnel: bool }]
etapes: [{ texte (reformulé), minuteur_s?, equipement? }]
sources: [{ type: "article"|"tiktok"|"instagram", url, titre, auteur, verifie_le (date), oembed?: { thumbnail_url, author_name, title } }]
image: { fichier, auteur, licence, url_origine } | null
nutrition_par_part: { kcal, proteines_g, glucides_g, lipides_g, fibres_g, methode: "ciqual-2025" }
cout_par_part_eur, verifications: { source_ok, nutrition_ok, prix_ok, notes }
```

### 5.2 Collecte des recettes (jalon 1 = 30 recettes, objectif final ≥ 150)

- Cherche avec **WebSearch / WebFetch**. Si le connecteur **Firecrawl** est disponible dans ta session, sers-t'en pour la recherche et l'extraction des pages. Sources visées : blogs et sites de recettes français reconnus, comptes Instagram et TikTok de cuisine healthy ou « petit budget ».
- Chaque recette doit avoir **au moins une source**. Vise **au moins 40 % des recettes avec une vidéo TikTok ou un post/reel Instagram**, en plus ou à la place d'un article.
- **Vérifie chaque lien** : HTTP 200 pour les articles, **oEmbed** pour les réseaux sociaux.
  - TikTok : `https://www.tiktok.com/oembed?url=<url>`, sans clé.
  - Instagram : l'oEmbed de Meta se passe de jeton depuis juin 2026.
  - Stocke `verifie_le`. Une URL qui ne répond pas → recette rejetée.
- **Répartition cible** : environ 50 % de batch (se garde 3 jours ou se congèle), 35 % d'express (≤ 20 min), 15 % d'assemblage sans cuisson. Varie les protéines (œufs, légumineuses, poulet, dinde, porc maigre, bœuf 5 %, thon, sardines, maquereau, colin, tofu), les cuisines du monde et les saisons.
- **Adapte** les recettes à mes contraintes (moins de matière grasse, quantités pour 1 personne ou en batch ×3/×4, uniquement mon équipement). Garde le lien vers l'original et indique « adaptée de ».

### 5.3 Calories vérifiées (Ciqual)

- Télécharge la **table Ciqual (Anses)** la plus récente depuis ciqual.anses.fr, en open data, et convertis-la en JSON compact dans `data/ciqual/`. Cite la source dans l'app (« Anses. Table de composition nutritionnelle Ciqual »).
- Associe chaque ingrédient à un **code Ciqual** (table de correspondance `data/ciqual-map.json`, éditable). Utilise la valeur **crue** pour les ingrédients pesés crus (riz, pâtes, lentilles sèches…).
- Calcule kcal, protéines, glucides, lipides et fibres **par part**, avec des tests unitaires.
- Si la source annonce des calories et que l'écart dépasse **15 %**, signale la recette dans un rapport `reports/nutrition.md` et corrige ou rejette-la.

### 5.4 Prix (Lyon par défaut)

- Source principale : **Open Prices** (Open Food Facts), API gratuite et sans clé en lecture : https://prices.openfoodfacts.org/api/docs (licence ODbL, crédite-la).
  - Récupère les prix relevés dans les magasins proches de ma ville. Calcule la **médiane des 12 derniers mois** par produit ou catégorie, en privilégiant les enseignes discount (Lidl, Aldi, Leclerc, Intermarché, Auchan, Carrefour).
- La couverture peut être partielle. Le script doit produire un rapport de couverture (`reports/prix.md`) et compléter avec une **grille de prix de référence** `data/prix-reference.json` : prix au kg, au litre ou à l'unité, **conditionnement réel** (ex. « épinards hachés surgelés 1 kg »), source et date de relevé.
- Dans l'app, affiche **deux chiffres** :
  - **coût en caisse** : paquets entiers achetés cette semaine ;
  - **coût des portions mangées**, avec ce qui reste au placard la semaine suivante (le riz, les épices…).
- Le stock restant est réutilisé par le générateur de la semaine suivante.
- Permets-moi de **corriger un prix** depuis la liste de courses. La correction est stockée en local et prioritaire.
- Une **GitHub Action mensuelle** (gratuite) rafraîchit les prix Open Prices, revérifie les liens morts, reconstruit et redéploie.

### 5.5 Photos et réseaux sociaux

- **Photos** : uniquement des images **sous licence libre**, téléchargées au build, redimensionnées (AVIF/WebP, ~800 px) et créditées (auteur + licence affichés dans la fiche).
  - Ordre de préférence : Openverse ou Wikimedia Commons (sans clé), puis Pexels ou Unsplash (clé gratuite, gardée en variable d'environnement et jamais livrée dans l'app).
  - S'il n'y a pas de photo convenable, utilise une **illustration botanique** générée en SVG dans le style de l'app.
- Dans l'app, les photos reçoivent un **traitement bichromie risographie** pour un rendu homogène (section 8). Un réglage « photos en couleurs naturelles » permet de le désactiver.
- **Cartes TikTok / Instagram** : affiche une **façade légère** (vignette oEmbed + titre + auteur + bouton lecture). Le vrai lecteur (blockquote + script officiel) ne se charge **qu'au tap**, sinon un lien ouvre l'app TikTok ou Instagram. Ne réutilise jamais ces vignettes comme photo principale.
- **Cartes article** : titre, nom du site, bouton « Lire l'article ».

## 6. Le moteur de menu hebdomadaire (le cœur de l'app)

- **Génération locale et déterministe** : graine = numéro de semaine ISO + réglages. Le même menu s'affiche toute la semaine, et **il change chaque semaine**.
- Le menu de la semaine suivante se **débloque le samedi matin** (réglable), pour que je puisse faire les courses avant la session batch du dimanche.
- **14 créneaux** (lun → dim, midi / soir). Règles à respecter, avec score et backtracking ou plusieurs essais aléatoires :
  1. kcal par repas et par jour dans les fourchettes de la section 2, protéines minimum ;
  2. **coût en caisse ≤ budget max**, en visant le bas de la fourchette ;
  3. **2 à 3 recettes batch** qui couvrent environ 9 à 11 créneaux, plus 2 à 4 repas express ou assemblage ;
  4. **sécurité alimentaire** : un plat cuisiné se mange **au plus tard à J+3 au frigo**. Au-delà, l'app marque la boîte « à congeler » et affiche un rappel « sortir du congélateur la veille » ;
  5. jamais le même plat à deux repas consécutifs, **4 fois maximum par semaine**, au moins **3 familles de protéines** différentes par semaine ;
  6. **pas de recette déjà servie ces 3 dernières semaines** (historique local), sauf favoris si l'option « inclure 1 à 2 favoris par semaine » est activée ;
  7. **synergie d'ingrédients** : privilégie les recettes qui finissent les mêmes paquets (le kilo d'épinards, le potimarron entier) pour réduire le gaspillage et le prix ;
  8. **saisonnalité** (mois en cours) et uniquement mon équipement ;
  9. **mode frigo** : les ingrédients que j'ai cochés comme déjà présents font baisser le prix et sont favorisés.
- **Planning de cuisine** : pour chaque jour, indique si je **cuisine** (« on cuisine ×4 · 35 min ») ou si je **mange une boîte** (« boîte 2/4 », « congelée »).
- **Session batch du dimanche** : fusionne les étapes de toutes les recettes du jour en **une seule timeline optimisée**. Tiens compte de l'équipement disponible en parallèle (rice cooker + 2 feux + four + micro-ondes) : ce que je lance en premier, ce qui tourne pendant que je coupe, à quelle minute.
- **Bouton « Remplacer »** sur n'importe quel repas : propose **3 alternatives** qui respectent les mêmes règles (kcal à ±10 %, budget, conservation, même type de créneau). Recalcule tout : planning, totaux, liste de courses.
- **Échanger avec un favori** : depuis l'onglet Favoris (ou depuis « Remplacer »), je touche une recette gardée et je choisis « Mettre dans ma semaine ».
  - L'app **propose les meilleurs créneaux** en tête, avec un indicateur de compatibilité (kcal, budget, conservation). Je peux aussi choisir n'importe quel créneau moi-même.
  - Si le favori est un **batch**, l'app propose de remplir automatiquement ses autres parts (ex. ×4 → 4 créneaux, sans dépasser J+3 au frigo, le reste au congélateur). Elle me montre quels plats seront retirés avant de valider.
  - Si l'échange casse une règle (budget dépassé, kcal hors fourchette, plat déjà servi 4 fois), l'app **m'avertit clairement** mais me laisse valider quand même. C'est mon choix.
  - Après validation, tout est recalculé : planning, badges « boîte x/y », totaux kcal et €, timeline batch, liste de courses et frigo (règles de la section 7, écran Frigo).
  - Bouton **Annuler** pendant quelques secondes après l'échange, et historique des échanges de la semaine.
- Tests de propriétés : génère les menus de **52 semaines d'affilée** et vérifie que chaque semaine respecte toutes les règles.

## 7. Les écrans

Barre d'onglets en bas : **Semaine · Courses · Favoris · Frigo**. Les Réglages s'ouvrent depuis l'onglet Semaine.

1. **Semaine**
   - En-tête « Du 16 au 22 novembre » et totaux : kcal/jour planifiées, kcal libres, coût en caisse, coût par repas.
   - Carte « Session batch du dimanche » (durée, nombre de boîtes, ouvre la timeline).
   - Liste jour par jour, midi et soir : vignette, nom, kcal, badge (« on cuisine ×4 », « boîte 2/4 », « congelée », « 15 min »), kcal et coût du jour.
   - Bascule vers « semaine prochaine » dès le samedi.
2. **Fiche recette**
   - Photo bichromie avec étiquette d'herbier (« Planche n° 12 · Dahl corail ») ; boutons retour et **+** (garder).
   - Nom ; puces kcal / € par part / minutes / nombre de boîtes ; macros ; mention « kcal calculées avec la table Ciqual (Anses) ».
   - Cartes sources (TikTok, Instagram, article) ; « Dans ta semaine » (créneaux concernés) ; conservation.
   - Ingrédients avec quantités ajustables (portions −/+) et prix ; étapes reformulées.
   - Boutons **Mode cuisine** et **Remplacer**.
3. **Courses**
   - Liste regroupée **par rayon** (fruits & légumes, frais, viandes & poissons, épicerie, surgelés), quantités arrondies aux **conditionnements réels**, prix par ligne et total.
   - **Cases à cocher** sauvegardées ; interrupteur « déjà au frigo » ; correction de prix.
   - **Partager** via la Web Share API (texte propre, une ligne par article, pour Rappels, Notes ou Messages) et **Copier**.
4. **Favoris**
   - Grille des recettes gardées avec le bouton **+**, tri et recherche.
   - **Toucher un favori** ouvre sa fiche avec un gros bouton **« Mettre dans ma semaine »**, qui lance l'échange décrit en section 6 (choix du créneau, aperçu des plats retirés, avertissements, validation, annuler).
   - Bouton **+** en haut de l'onglet pour **ajouter ma propre recette** : coller un lien TikTok, Instagram ou article, puis saisir nom, ingrédients et étapes. Les calories sont calculées via la table Ciqual embarquée, le prix via la grille.
   - Option « inclure mes favoris dans les prochains menus ».
5. **Frigo** : un **inventaire vivant avec quantités**, rangé en frigo / congélateur / placard.
   - Il se met à jour **automatiquement** :
     - **article coché dans les courses** → ajouté au frigo avec sa quantité de paquet ;
     - **recette marquée « cuisinée »** → ingrédients déduits, boîtes de plat ajoutées (« dahl ×3 frigo, ×1 congélateur ») avec leur date limite J+3 ;
     - **repas marqué « mangé »** → boîte retirée ;
     - **échange avec un favori ou remplacement** :
       - courses pas encore faites → les ingrédients du plat retiré quittent la liste de courses, ceux du favori y entrent, moins ce qui est déjà au frigo ;
       - courses déjà faites → les ingrédients achetés pour le plat retiré **restent dans le frigo** et sont signalés « à utiliser » ; ceux du favori déjà présents sont **réservés**, seuls les manquants vont dans une mini-liste « à racheter ».
   - Je peux toujours corriger à la main (−/+, supprimer, ajouter).
   - Badges « à utiliser vite » pour ce qui approche de sa date. Les restes de paquets de la semaine passent à la suivante.
   - Le générateur, le bouton « Remplacer » et la liste de courses favorisent ce qu'il y a déjà dans le frigo.
6. **Mode cuisine** : plein écran, écran maintenu allumé, une étape à la fois en très gros, navigation par swipe, **minuteurs intégrés** (plusieurs en parallèle, qui survivent au verrouillage grâce à un horodatage), son à la fin.
7. **Réglages** : ville, budget, cible kcal et kcal libres, repas planifiés, nombre de personnes, équipement, aliments exclus, jour de déblocage du menu, favoris inclus, photos bichromie ou naturelles, grain papier on/off, sauvegarde et restauration JSON, crédits et sources de données.
8. **Onboarding** en 3 écrans : présentation, réglages essentiels, et **comment installer l'app sur l'iPhone** (Safari → Partager → « Sur l'écran d'accueil »).

## 8. Direction artistique : « Herbier imprimé en risographie »

Un mélange de deux pistes que j'ai validées. La rigueur délicate d'un **herbier** (planches botaniques au trait, étiquettes de spécimen, filets fins, serif élégante) est **imprimée en risographie** : deux encres pastel qui se superposent, grain du papier, léger décalage d'impression, gros chiffres qui claquent. L'ensemble doit ressembler à un **objet imprimé fait main, pas à une app générée par IA**.

### 8.1 Couleurs (tokens CSS)

| Token | Hex | Usage |
|---|---|---|
| `--papier` | `#F4EEE1` | fond principal |
| `--papier-clair` | `#FAF6EC` | cartes, barre d'onglets |
| `--encre` | `#24402F` | texte, traits, boutons principaux (vert forêt) |
| `--encre-douce` | `#4F5E53` | texte secondaire (contraste ≥ 4,5:1 sur papier) |
| `--sauge` / `--sauge-pale` | `#A8BBA0` / `#DCE5D3` | surfaces, fonds d'illustration |
| `--menthe` | `#8FD3B0` | encre riso n° 1 (aplats, surlignages) |
| `--rose` | `#F4A6A6` | encre riso n° 2 (double impression, pastilles prix) |
| `--abricot` | `#EDB99A` | accent chaud ponctuel (bandeau batch) |

Pas de mode sombre en v1. Vérifie tous les contrastes texte/fond (AA minimum).

### 8.2 Typographie (auto-hébergée)

- **Young Serif** : noms de recettes, titres éditoriaux (« Du 16 au 22 novembre »).
- **Bricolage Grotesque** (700–800) : gros chiffres (kcal, €), titres de section en capitales, avec **double impression** rose décalée de 3 à 5 px derrière l'encre (copie `aria-hidden`).
- **Schibsted Grotesk** : interface et texte courant.

### 8.3 Éléments signature

1. **Illustrations botaniques au trait** (encre 1–1,4 px) avec aplats menthe, rose ou sauge **légèrement décalés** du trait, comme une impression mal calée. Feuilles, brins d'herbes, ingrédients.
2. **Grain papier** sur tout l'écran : SVG `feTurbulence`, `mix-blend-mode: multiply`, opacité faible, désactivable.
3. **Photos en bichromie riso** : niveaux de gris contrastés multipliés par deux calques menthe et rose, avec un léger décalage.
4. **Étiquette d'herbier** sur chaque photo : fond papier, filet encre, « Planche n° X » en petites capitales, nom en Young Serif, rotation −2°.
5. **Trames de points** (halftone) pour les bandeaux, **séparateurs en tirets**, filets fins.
6. **Bouton +** rond à l'encre. Au tap, effet **tampon** (scale 0,92 → 1, rotation −6°) et petit tampon « gardée ! ».
7. **Liste de courses** : cocher un article le **barre d'un trait de crayon animé** (stroke-dashoffset).
8. Respecte `prefers-reduced-motion` : animations coupées, grain fixe.

### 8.4 Interdits (pour que ça ne fasse pas « IA »)

Dégradés violets ou bleus, glassmorphism, ombres floues génériques, cartes avec une bordure colorée à gauche, emoji utilisés comme icônes, polices Inter, Roboto, Poppins, Montserrat ou la police système par défaut, icônes pleines génériques, illustrations 3D « blob », textes marketing creux. Icônes **au trait** (1,75 px, extrémités arrondies), dessinées sur mesure ou issues de Lucide restylé.

### 8.5 Accessibilité

Cibles tactiles ≥ 44 px, vrais `<button>` et `<a>`, `aria-label` sur les boutons-icônes, texte alternatif sur les photos, VoiceOver testé sur les parcours principaux.

> Si je joins des captures de mes maquettes (pistes « Herbier » et « Risographie »), sers-t'en comme référence visuelle : l'app finale est le mélange des deux décrit ci-dessus.

## 9. Qualité : ce que tu dois vérifier toi-même

- `npm run validate` : schéma Zod de toutes les recettes, liens vérifiés, calories Ciqual recalculées, prix présents, aucune recette hors équipement. Rapports dans `reports/`.
- Tests Vitest :
  - calculs nutritionnels et de prix ;
  - arrondis aux conditionnements ;
  - moteur de menu, avec les tests de propriétés sur 52 semaines.
- Tests Playwright WebKit au format iPhone : parcours « voir la semaine → ouvrir une recette → + favoris → remplacer → liste de courses → cocher → partager », et « Favoris → toucher un favori → Mettre dans ma semaine → choisir le créneau → vérifier que le planning, les totaux, la liste de courses et le frigo sont à jour → annuler ». Ajoute des tests unitaires sur la mise à jour du frigo dans les deux cas (courses faites ou non). Captures d'écran à chaque jalon.
- **Lighthouse** : PWA installable, hors ligne fonctionnel, performance ≥ 90 sur mobile.
- Aucune requête réseau vers un tiers au chargement de l'app (sauf au tap sur une vidéo).

## 10. Jalons (montre-moi le résultat à la fin de chacun)

0. **Questions + plan** : tu attends mon accord.
1. **Données** : scripts Ciqual, Open Prices et grille de prix, schéma, **30 premières recettes vérifiées** avec sources et photos. Je valide la qualité avant que tu passes à 150.
2. **Moteur** de menu, remplacement, frigo, liste de courses, avec tests.
3. **Design system** (tokens, typo, composants, illustrations) et **écrans**.
4. **PWA** : hors ligne, installation iOS, mode cuisine avec wake lock, minuteurs, partage.
5. **Base complète** : ≥ 150 recettes, saisonnalité, cartes sociales.
6. **Mise en ligne** sur GitHub Pages + GitHub Action mensuelle. Donne-moi **l'URL**, les étapes d'installation sur iPhone, et un **README** qui explique comment ajouter des recettes, rafraîchir les prix et restaurer une sauvegarde.

## 11. Règles de travail

- Crée un **`CLAUDE.md`** à la racine qui résume ces règles (sources vérifiées, Ciqual, droit d'auteur, gratuité, design) pour les prochaines sessions. Plus tard, je pourrai simplement te dire « ajoute 20 recettes d'hiver » ou « ajoute cette vidéo TikTok à la base ».
- Ajoute un script **`npm run add-recipe -- <url>`** qui prépare une fiche à partir d'un lien : vérification du lien, ingrédients, reformulation, calcul Ciqual et prix. Tu me la montres avant de l'ajouter.
- **N'invente jamais** une recette, une source, un auteur, un prix ou une valeur nutritionnelle. Une estimation est marquée comme telle, avec sa méthode.
- Commits petits et clairs. Demande-moi avant toute action irréversible (rendre un repo public, supprimer des données, changer de nom de domaine).
- Si un téléchargement ou un site est bloqué par le réseau de ta session, dis-le-moi au lieu de contourner.
