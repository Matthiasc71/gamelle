/**
 * Captures d'écran au format iPhone 15 (393 × 852) sur le build de production.
 *   npx vite build && npx vite preview --port 4173   (dans un autre terminal)
 *   node scripts/captures.mjs [dossier]
 * Date figée par ?date= pour un menu reproductible.
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync } from 'node:fs';

const dossier = process.argv[2] ?? 'docs/captures/jalon-3';
mkdirSync(dossier, { recursive: true });

const URL0 = 'http://localhost:4173/?date=2026-11-17';
const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR' });
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
const tiers = [];
page.on('request', (r) => !r.url().startsWith('http://localhost') && !r.url().startsWith('data:') && tiers.push(r.url()));

const cliche = async (nom, pleinePage = false) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dossier}/${nom}.png`, fullPage: pleinePage });
  console.log('✓', nom);
};

await page.goto(URL0);
await page.waitForSelector('.accueil');
await cliche('01-accueil');
await page.getByRole('button', { name: 'Suivant' }).click();
await cliche('02-accueil-reperes');
await page.getByRole('button', { name: 'Suivant' }).click();
await cliche('03-accueil-installer');
await page.getByRole('button', { name: 'Voir mon menu' }).click();

await page.waitForSelector('.jours', { timeout: 60000 });
await cliche('04-semaine');
await cliche('05-semaine-entiere', true);

await page.locator('.repas').first().click();
await page.waitForSelector('.fiche__hero');
await cliche('06-fiche');
await page.locator('.fiche__boutons .plus').click();
await page.waitForTimeout(150);
await cliche('07-fiche-gardee');
await page.evaluate(() => window.scrollTo(0, 700));
await cliche('08-fiche-ingredients');
await page.getByRole('button', { name: 'Remplacer' }).click();
await page.waitForSelector('.feuille');
await cliche('09-remplacer');
await page.keyboard.press('Escape');

await page.goto(`${URL0}#/session`);
await page.waitForSelector('.couloirs');
await cliche('10-session-batch');
await page.goto(`${URL0}#/cuisine/session`);
await page.waitForSelector('.cuisine__etape');
await page.getByRole('button', { name: /Minuteur/ }).first().click().catch(() => {});
await cliche('11-mode-cuisine');

await page.goto(`${URL0}#/courses`);
await page.waitForSelector('.lignes-courses');
const cases = page.locator('.article__case');
await cases.nth(0).click();
await cases.nth(1).click();
await cliche('12-courses');

await page.goto(`${URL0}#/favoris`);
await page.waitForSelector('.grille');
await cliche('13-favoris');
await page.locator('.carte-recette__lien').first().click();
await page.getByRole('link', { name: 'Mettre dans ma semaine' }).click();
await page.waitForSelector('.plans', { timeout: 30000 });
await cliche('14-echange');
await page.locator('.plan').first().click();
await cliche('15-echange-apercu');
await page.getByRole('button', { name: 'Valider l’échange' }).click();
await page.waitForSelector('.jours');
await cliche('16-semaine-apres-echange');

await page.goto(`${URL0}#/frigo`);
await page.waitForSelector('.stock, .vide');
await cliche('17-frigo');
await page.goto(`${URL0}#/reglages`);
await cliche('18-reglages');

console.log(erreurs.length ? `Erreurs :\n${erreurs.join('\n')}` : 'Aucune erreur de console.');
console.log(tiers.length ? `Requêtes tierces :\n${tiers.join('\n')}` : 'Aucune requête vers un tiers.');
await navigateur.close();
