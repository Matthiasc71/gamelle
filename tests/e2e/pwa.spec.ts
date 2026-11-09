/**
 * Hors ligne (service worker) et accessibilité automatique (axe) des écrans principaux.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DEBUT, ouvrir } from './aide';

test.describe('hors ligne', () => {
  test.use({ serviceWorkers: 'allow' });

  test('l’app se rouvre sans réseau, menu et courses compris', async ({ page, context }) => {
    await ouvrir(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload(); // la page est maintenant contrôlée par le service worker
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    // ouvrir tous les écrans une fois en ligne n'est pas nécessaire : tout est précaché
    await context.setOffline(true);
    await page.goto(`${DEBUT}#/courses`);
    await expect(page.locator('.lignes-courses').first()).toBeVisible();
    await page.goto(`${DEBUT}#/cuisine/session`);
    await expect(page.locator('.cuisine__texte')).toBeVisible();
    await page.goto(`${DEBUT}#/semaine`);
    await expect(page.locator('.jours')).toBeVisible();
  });
});

test('le manifeste permet l’installation sur l’écran d’accueil', async ({ request }) => {
  const m = await (await request.get('/manifest.webmanifest')).json();
  expect(m).toMatchObject({ name: 'Gamelle', display: 'standalone', lang: 'fr' });
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  const html = await (await request.get('/')).text();
  expect(html).toContain('apple-touch-icon');
  expect(html).toContain('apple-touch-startup-image');
});

test('aucune violation d’accessibilité sérieuse sur les écrans principaux', async ({ page }) => {
  await ouvrir(page);
  const ecrans = ['#/semaine', '#/courses', '#/favoris', '#/frigo', '#/session', '#/reglages', '#/cuisine/dahl-lentilles-corail-epinards'];
  await page.locator('.repas').first().click();
  ecrans.push(new URL(page.url()).hash);
  for (const e of ecrans) {
    await page.goto(`${DEBUT}${e}`);
    await page.waitForSelector('main');
    await page.waitForTimeout(500);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const graves = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(graves.map((v) => `${e} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
  }
});

test('mode cuisine : minuteur horodaté qui survit au rechargement, étapes au clavier', async ({ page }) => {
  await ouvrir(page);
  await page.goto(`${DEBUT}#/cuisine/session`);
  await expect(page.locator('.cuisine__texte')).toBeVisible();
  // aller jusqu'à la première étape qui propose un minuteur
  for (let i = 0; i < 12 && !(await page.getByRole('button', { name: /^Minuteur/ }).isVisible()); i++)
    await page.getByRole('button', { name: 'Suivante' }).click();
  await page.getByRole('button', { name: /^Minuteur/ }).click();
  const temps = page.locator('.minuteur__temps');
  await expect(temps).toHaveText(/^\d+:\d\d$/);
  const t1 = await temps.innerText();
  await page.waitForTimeout(1500);
  expect(await temps.innerText()).not.toBe(t1); // il décompte
  await page.reload();
  await expect(page.locator('.minuteur__temps')).toHaveText(/^\d+:\d\d$/); // toujours là
  // flèche droite : étape suivante (le balayage tactile appelle la même navigation)
  const avant = await page.locator('.cuisine__titre .kicker').innerText();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.cuisine__titre .kicker')).not.toHaveText(avant);
});
