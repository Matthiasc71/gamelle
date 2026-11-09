import { expect, type Page } from '@playwright/test';

/** Mardi de la semaine 47 : menu reproductible. */
export const DEBUT = '/?date=2026-11-17';

/** Ouvre l'app, passe l'accueil et attend le menu de la semaine. */
export async function ouvrir(page: Page) {
  await page.goto(DEBUT);
  await page.getByRole('button', { name: 'Passer' }).click();
  await expect(page.locator('.jours')).toBeVisible({ timeout: 60_000 });
}

export const repasDe = (page: Page) => page.locator('.repas .repas__nom').allInnerTexts();
