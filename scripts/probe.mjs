// Diagnóstico rápido de una URL: muestra consola, errores y el texto final.
import puppeteer from 'puppeteer-core';
const url = process.argv[2];
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await browser.newPage();
await p.setViewport({ width: 390, height: 844 });
p.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 300)));
p.on('pageerror', (e) => console.log('[pageerror]', e.message, e.stack));
p.on('requestfailed', (r) => console.log('[reqfail]', r.url().slice(0, 120), r.failure()?.errorText));
await p.goto(url, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, Number(process.argv[3] || 8000)));
console.log('TEXT:', (await p.evaluate(() => document.body.innerText)).slice(0, 600));
await browser.close();
