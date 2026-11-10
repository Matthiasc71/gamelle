/**
 * Les deux parcours du cahier des charges (§ 9).
 */
import { expect, test } from '@playwright/test';
import { ouvrir, repasDe } from './aide';

test('semaine → recette → + favoris → remplacer → courses → cocher → partager', async ({ page }) => {
  await page.addInitScript(() => {
    // capture le texte partagé (la feuille de partage d'iOS n'existe pas ici)
    Object.defineProperty(navigator, 'share', {
      value: async (d: { text: string }) => {
        (window as unknown as { partage: string }).partage = d.text;
      },
    });
  });
  await ouvrir(page);
  const avant = await repasDe(page);
  await expect(page.locator('.totaux')).toContainText('€');

  // ouvrir une recette et la garder
  await page.locator('.repas').first().click();
  const nom = await page.locator('#titre-recette').innerText();
  await page.getByRole('button', { name: `Garder ${nom} dans les favoris` }).click();
  await expect(page.getByRole('button', { name: `Retirer ${nom} des favoris` })).toHaveAttribute('aria-pressed', 'true');

  // remplacer le repas par la première alternative
  await page.getByRole('button', { name: 'Remplacer' }).click();
  const feuille = page.getByRole('dialog');
  await expect(feuille.locator('.alternative').first()).toBeVisible();
  const choisie = await feuille.locator('.alternative__nom').first().innerText();
  await feuille.getByRole('button', { name: 'Choisir' }).first().click();
  await expect(page.locator('.jours')).toBeVisible();
  await expect(page.getByRole('status')).toContainText(`${choisie} est dans ta semaine`);
  const apres = await repasDe(page);
  expect(apres[0]).toBe(choisie);
  expect(apres.slice(1)).toEqual(avant.slice(1));

  // liste de courses : cocher un article, il reste coché après rechargement et entre au frigo
  await page.getByRole('link', { name: 'Courses' }).click();
  const premier = page.locator('.article').first();
  const produit = await premier.locator('.article__nom').innerText();
  await premier.locator('.article__case').click();
  // l'article coché descend dans « Dans le panier », replié
  const panier = page.locator('details.panier');
  await expect(panier.locator('summary')).toContainText('Dans le panier · 1');
  await expect(page.locator('.article').first().locator('.article__nom')).not.toHaveText(produit);
  await page.reload();
  await panier.locator('summary').click();
  await expect(panier.locator('.article__nom')).toHaveText([produit]);
  await expect(panier.locator('input[type=checkbox]')).toBeChecked();

  // partager : une ligne par article non coché, total à la fin
  await page.getByRole('button', { name: 'Partager' }).click();
  const texte = await page.evaluate(() => (window as unknown as { partage: string }).partage);
  expect(texte).toMatch(/Total : \d+,\d\d €$/);
  expect(texte).not.toContain(produit);

  // le frigo a reçu l'article coché
  await page.getByRole('link', { name: 'Frigo' }).click();
  await expect(page.locator('.stock__ligne')).toHaveCount(1);

  // le favori est dans l'onglet Favoris
  await page.getByRole('link', { name: 'Favoris' }).click();
  await expect(page.locator('section[aria-labelledby="mes-favoris"] .carte-recette__nom')).toHaveText([nom]);
});

test('Favoris → mettre un favori dans ma semaine → tout se met à jour → annuler', async ({ page }) => {
  await ouvrir(page);
  const avant = await repasDe(page);
  const totalAvant = await page.locator('.totaux__case').nth(1).innerText();
  await page.getByRole('link', { name: 'Courses' }).click();
  const coursesAvant = await page.locator('.article__nom').allInnerTexts();
  await page.getByRole('link', { name: 'Semaine' }).click();

  // garder une recette express qui n'est pas au menu
  await page.getByRole('link', { name: 'Favoris' }).click();
  await page.getByRole('button', { name: 'Express', exact: true }).click();
  const cartes = page.locator('section[aria-labelledby="toute-la-base"] .carte-recette');
  let nom = '';
  for (let i = 0; i < (await cartes.count()); i++) {
    const n = await cartes.nth(i).locator('.carte-recette__nom').innerText();
    if (!avant.includes(n)) {
      nom = n;
      await cartes.nth(i).getByRole('button', { name: `Garder ${n} dans les favoris` }).click();
      break;
    }
  }
  expect(nom).not.toBe('');

  // toucher le favori → « Mettre dans ma semaine » → meilleur créneau → aperçu
  await page.locator('section[aria-labelledby="mes-favoris"] .carte-recette__lien').first().click();
  await page.getByRole('link', { name: 'Mettre dans ma semaine' }).click();
  await page.locator('.plan').first().click();
  await expect(page.getByText('Plats retirés')).toBeVisible();
  const retire = (await page.locator('.apercu .liste-simple li').first().innerText()).split('\n')[0];
  await page.getByRole('button', { name: 'Valider l’échange' }).click();

  // planning, totaux, courses et frigo à jour
  await expect(page.locator('.jours')).toBeVisible();
  const apres = await repasDe(page);
  expect(apres).toContain(nom);
  expect(apres.filter((x) => x === retire).length).toBeLessThan(avant.filter((x) => x === retire).length);
  const totalApres = await page.locator('.totaux__case').nth(1).innerText();
  expect(totalApres).not.toBe(totalAvant);

  await page.getByRole('link', { name: 'Courses' }).click();
  await expect.poll(() => page.locator('.article__nom').allInnerTexts()).not.toEqual(coursesAvant);
  await page.getByRole('link', { name: 'Frigo' }).click();
  await expect(page.locator('.vide')).toBeVisible(); // courses pas encore faites : frigo inchangé

  // annuler depuis la semaine
  await page.getByRole('link', { name: 'Semaine' }).click();
  await page.locator('.note--ligne').getByRole('button', { name: 'Annuler' }).click();
  await expect.poll(() => repasDe(page)).toEqual(avant);
  await expect.poll(() => page.locator('.totaux__case').nth(1).innerText()).toBe(totalAvant);
});

test('ajouter ma propre recette : calcul Ciqual et prix sur le téléphone, rangée dans les favoris', async ({ page }) => {
  await ouvrir(page);
  await page.getByRole('link', { name: 'Favoris' }).click();
  await page.getByRole('link', { name: 'Ajouter ma recette' }).click();
  await page.getByLabel('Lien (article, TikTok ou Instagram)').fill('https://www.tiktok.com/@exemple/video/123');
  await page.getByLabel('Nom de la recette').fill('Omelette feta épinards de test');
  for (const [cherche, qte] of [['oeuf', '3'], ['epinards', '100'], ['feta', '50']]) {
    await page.getByLabel('Chercher un ingrédient').fill(cherche);
    await page.locator('.liste-choix button').first().click();
    await page.locator('.ligne-saisie input').last().fill(qte);
  }
  await page.getByLabel('Une ligne par étape, avec tes mots').fill('Bats les œufs avec la feta.\nCuis l’omelette avec les épinards.');
  await expect(page.locator('.note')).toContainText('kcal');
  await page.getByRole('button', { name: 'Enregistrer ma recette' }).click();
  await expect(page.locator('#titre-recette')).toHaveText('Omelette feta épinards de test');
  await expect(page.getByText('Ma recette', { exact: true })).toBeVisible();
  await page.reload(); // relue depuis IndexedDB
  await expect(page.locator('#titre-recette')).toHaveText('Omelette feta épinards de test');
  await page.getByRole('link', { name: 'Favoris' }).click();
  await expect(page.locator('section[aria-labelledby="mes-favoris"] .carte-recette__nom')).toContainText(['Omelette feta épinards de test']);
});
