/**
 * Génère les icônes PNG et les écrans de lancement iOS à partir de public/icone.svg.
 *   node scripts/icones.mjs
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const svg = readFileSync('public/icone.svg', 'utf8');
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const PAPIER = '#F4EEE1';

const icones = [
  ['apple-touch-icon.png', 180, 1],
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['maskable-512.png', 512, 0.72], // zone sûre des icônes masquables
];
// écrans de lancement (largeur, hauteur en points, échelle) des iPhone récents
const splash = [
  [393, 852, 3], // 15, 15 Pro, 14 Pro, 16
  [430, 932, 3], // 15 Plus/Pro Max, 14 Pro Max, 16 Plus
  [402, 874, 3], // 16 Pro
  [440, 956, 3], // 16 Pro Max
  [390, 844, 3], // 12, 13, 14
  [428, 926, 3], // 12/13 Pro Max, 14 Plus
  [375, 812, 3], // X, XS, 11 Pro, 12/13 mini
  [375, 667, 2], // SE
];

const b = await chromium.launch();
const p = await b.newPage();
for (const [nom, taille, echelle] of icones) {
  await p.setViewportSize({ width: taille, height: taille });
  await p.setContent(`<body style="margin:0;background:${PAPIER};display:grid;place-items:center;height:${taille}px">
    <img src="${dataUrl}" style="width:${taille * echelle}px;height:${taille * echelle}px"></body>`);
  await p.screenshot({ path: `public/icons/${nom}` });
}
const liens = [];
for (const [l, h, e] of splash) {
  await p.setViewportSize({ width: l, height: h });
  await p.setContent(`<body style="margin:0;height:${h}px;background:${PAPIER};display:grid;place-items:center;font-family:Georgia,serif;color:#24402F">
    <div style="display:grid;justify-items:center;gap:10px"><img src="${dataUrl}" style="width:150px;height:150px"></div></body>`);
  const nom = `splash-${l * e}x${h * e}.png`;
  // rendu à la vraie densité de l'écran
  const ctx = await b.newContext({ viewport: { width: l, height: h }, deviceScaleFactor: e });
  const pp = await ctx.newPage();
  await pp.setContent(await p.content());
  await pp.screenshot({ path: `public/icons/${nom}` });
  await ctx.close();
  liens.push(
    `<link rel="apple-touch-startup-image" href="/icons/${nom}" media="(device-width: ${l}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${e}) and (orientation: portrait)" />`,
  );
}
writeFileSync('.cache/splash.html', liens.join('\n') + '\n'); // à recopier dans index.html si la liste change
await b.close();
console.log('icônes et écrans de lancement générés');
