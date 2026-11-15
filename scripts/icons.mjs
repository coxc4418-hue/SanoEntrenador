// Genera los iconos PNG de la app y el logo con nombre a partir de public/assets/logo.svg
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(here, '..', 'public', 'assets');
const svg = readFileSync(path.join(assets, 'logo.svg'), 'utf8');
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
const shot = async (file, size, { pad = 0, bg = 'transparent', radius = true } = {}) => {
  await page.setViewport({ width: size, height: size });
  const inner = size - pad * 2;
  const s = radius ? svg : svg.replaceAll('rx="112"', 'rx="0"');
  await page.setContent(`<html><body style="margin:0;background:${bg};display:grid;place-items:center;width:${size}px;height:${size}px">${s.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body></html>`);
  await page.screenshot({ path: path.join(assets, file), omitBackground: bg === 'transparent' });
  console.log('✔', file);
};
await shot('icon-192.png', 192);
await shot('icon-512.png', 512);
await shot('favicon.png', 48);
await shot('apple-touch-icon.png', 180, { radius: false });
await shot('icon-maskable.png', 512, { radius: false });
await shot('icon-1024.png', 1024);

// Logo horizontal con nombre (claro y oscuro) para documentos, redes y el README
const brand = async (file, dark) => {
  await page.setViewport({ width: 2100, height: 560 });
  await page.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;800&display=swap" rel="stylesheet"></head>
  <body style="margin:0;width:2100px;height:560px;display:flex;align-items:center;justify-content:center;gap:56px;background:${dark ? '#070a14' : 'transparent'};font-family:'Plus Jakarta Sans',sans-serif">
    ${svg.replace('<svg ', '<svg width="360" height="360" ')}
    <div><div style="font-size:150px;font-weight:800;letter-spacing:-5px;line-height:1;color:${dark ? '#ffffff' : '#0b1020'}">Sano<span style="background:linear-gradient(90deg,#fdba74,#f97316 50%,#f43f5e);-webkit-background-clip:text;color:transparent">Entrenador</span></div>
    <div style="font-size:44px;font-weight:500;color:${dark ? '#a3adc2' : '#566079'};margin-top:18px;letter-spacing:.5px">Tus alumnos, rutinas y cobros en un solo lugar</div></div>
  </body></html>`, { waitUntil: 'load', timeout: 15000 }).catch(() => {});
  await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 4000))]));
  await page.screenshot({ path: path.join(here, '..', file), omitBackground: !dark });
  console.log('✔', file);
};
await brand('LOGO_SANO_ENTRENADOR.png', false);
await brand('LOGO_SANO_ENTRENADOR_OSCURO.png', true);
await browser.close();
