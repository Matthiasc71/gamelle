# Gamelle

Menu de la semaine (déjeuner + dîner, 7 jours) léger, pas cher et en batch cooking, pour iPhone.
Web app installable, hors ligne, sans compte ni pisteur : tout reste sur le téléphone.

**Adresse : https://matthiasc71.github.io/gamelle/**

- Recettes réelles, chacune liée à sa source (blog, TikTok, Instagram), étapes reformulées.
- Calories recalculées avec la table Ciqual 2025 de l'Anses, prix des supermarchés (Lidl, Aldi, Open Prices).
- Liste de courses par rayon, frigo tenu à jour tout seul, session batch du dimanche minute par minute,
  mode cuisine (écran allumé, minuteurs), favoris à échanger dans la semaine.

## Mise en ligne (une seule fois)

Le site est publié par GitHub Actions à chaque push sur `main` (`.github/workflows/deploiement.yml`).

1. Sur GitHub : **Settings → Pages → Build and deployment → Source : « GitHub Actions »**.
2. Onglet **Actions → Déploiement GitHub Pages → Run workflow** (ou pousse un commit).
3. Au bout de 2 à 3 minutes, l'app est en ligne à l'adresse ci-dessus.

## Installer sur l'iPhone

1. Ouvre **https://matthiasc71.github.io/gamelle/** dans **Safari**.
2. Touche **Partager** (le carré avec la flèche), puis **« Sur l'écran d'accueil »**, puis **Ajouter**.
3. Ouvre Gamelle depuis l'icône : plein écran, et elle marche sans réseau au supermarché.

L'écran reste allumé en mode cuisine depuis iOS 18.4, quand l'app est ouverte depuis l'écran d'accueil.
Une nouvelle version s'annonce d'elle-même (« Recharger »).

## Au quotidien

- **Semaine** : le menu suivant se débloque le samedi à 8 h (réglable) pour faire les courses avant la session
  du dimanche. Lundi, mardi, mercredi au frigo (J+3 au maximum), le reste au congélateur.
- **Courses** : coche ce que tu achètes, ça arrive dans le frigo ; « déjà au frigo » et correction de prix
  en touchant le prix ; **Partager** envoie la liste vers Rappels, Notes ou Messages.
- **Favoris** : touche + sur une recette, puis « Mettre dans ma semaine ». **Ajouter ma recette** : colle un lien,
  choisis les ingrédients dans le catalogue, les calories et le prix sont calculés sur le téléphone.
- **Frigo** : marqué tout seul par les courses cochées et les plats cuisinés, corrigeable à la main.

### Rappel « menu de la semaine prêt » (Raccourcis)

Pas de notifications sans serveur : on passe par l'app **Raccourcis** d'iOS.

1. Raccourcis → **Automatisation** → **+** → **Heure de la journée**.
2. Choisis **8:05**, **Hebdomadaire**, **samedi**, puis **Exécuter immédiatement** → Suivant.
3. **Nouveau raccourci vide** → ajoute l'action **Afficher la notification** : « Ton menu Gamelle est prêt ».
4. (Facultatif) ajoute l'action **Ouvrir les URL** avec `https://matthiasc71.github.io/gamelle/`.

## Sauvegarder et restaurer

Les données (réglages, favoris, menus, coches, frigo, prix corrigés, recettes ajoutées) vivent dans le stockage
de l'app sur le téléphone. **Supprimer l'icône de l'écran d'accueil peut les effacer.**

- **Sauvegarder** : Semaine → Réglages (icône en haut à droite) → **Exporter** : un fichier
  `gamelle-sauvegarde-AAAA-MM-JJ.json`, à ranger dans Fichiers ou iCloud Drive.
- **Restaurer** : Réglages → **Restaurer** → choisis le fichier. Toutes les données de l'app sont remplacées.

## Ajouter des recettes à la base

Règles complètes dans [`CLAUDE.md`](CLAUDE.md) (sources vérifiées, Ciqual, droit d'auteur, équipement).

**Avec Claude Code** dans ce dépôt : « ajoute 20 recettes d'hiver », « ajoute cette vidéo TikTok : <lien> ».

**À la main** :

```bash
npm run add-recipe -- https://exemple.com/ma-recette
```

1. Le brouillon arrive dans `.cache/brouillons/` (ingrédients de la source, suggestions Ciqual).
2. Écris `data/recipes/<slug>.json` (schéma : `src/domain/schema.ts`) : ingrédients du catalogue
   `data/ciqual-map.json` (ajoute l'ingrédient et sa correspondance de prix s'il manque), étapes **reformulées**,
   durée et appareil par étape, saison, protéine, illustration.
3. Une vidéo n'entre que si les quantités sont dans sa légende ou dans un article du même créateur.
4. Recalcule et valide, puis commite :

```bash
npm run compute
```

```bash
npm run validate
```

Garde-fous de la validation : 380 à 650 kcal et au moins 20 g de protéines par part, 80 g de légumes,
plaques / four / micro-ondes / rice cooker seulement, prix et liens présents. Rapports dans `reports/`.

## Rafraîchir les prix

**Automatique** : le workflow `donnees-mensuelles.yml` tourne le 2 de chaque mois (relevés Lidl, prix aldi.fr,
Open Prices, vérification des liens, recalcul, validation, simulation) ; il commite et redéploie si besoin.
On peut le lancer à la main : Actions → Mise à jour mensuelle des données → Run workflow.

**À la main** (ordre : ticket → Lidl → aldi.fr → médiane Lyon → médiane France) :

```bash
npm run lidl && npm run aldi && npm run prices && npm run compute && npm run validate
```

Un prix de ticket de caisse se saisit dans `data/prix-correspondances.json`, champ
`"manuel": { "prix_eur": 1.19, "enseigne": "Lidl Lyon 7e", "releve_le": "2026-11-21" }` : il passe avant tout le reste.
Dans l'app, la correction de prix d'une ligne de courses reste sur le téléphone.

## Développement

```bash
npm ci
```

```bash
npm run dev
```

- `npm test` : moteur de menu, prix, nutrition, frigo, 52 semaines d'affilée (Vitest).
- `npm run e2e` : build puis parcours de l'interface au format iPhone (Playwright), hors ligne, accessibilité.
- `npm run simuler` : 52 semaines de menus → `reports/simulation.md` (coût en caisse, sessions, règles assouplies).
- `BASE=/gamelle/ npm run build` : build comme sur GitHub Pages.

État actuel de la base : 92 recettes vérifiées (≈ 43 % avec une source TikTok ou Instagram). Avec cette base, la
simulation donne environ 35 € de courses par semaine à la caisse en régime établi (≈ 25 € de portions mangées) :
ajouter des recettes à moins de 2 € la part, qui partagent les mêmes paquets, fait baisser ce chiffre.

## Données et crédits

- Calories : Anses, table de composition nutritionnelle des aliments Ciqual 2025, licence Etalab 2.0
  (doi:10.57745/RDMHWY).
- Prix : Open Prices / Open Food Facts (ODbL), prix affichés sur aldi.fr ; relevés de 12 mois.
- Recettes : chaque fiche crédite et lie sa source ; les étapes sont reformulées, aucune photo n'est reprise.
  Illustrations dessinées pour Gamelle.
- Polices Young Serif, Bricolage Grotesque et Schibsted Grotesk (SIL Open Font License), incluses dans l'app.
