// Bakes public/assets/soldier/soldier.glb. Requires `npm run dev` on port 5173 and
// puppeteer-core plus a local Chrome: `CHROME_PATH=... node scripts/bake-soldier.cjs`.
const fs = require('fs');
const path = require('path');
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (error) => console.error('[page]', error.message));
  await page.goto('http://localhost:5173/scripts/bake-soldier.html', { waitUntil: 'load' });
  await page.waitForFunction(() => document.title === 'BAKED', { timeout: 300000 });
  const result = await page.evaluate(() => window.__bake);
  await browser.close();
  if (result.error) throw new Error(result.error);
  const out = path.join(__dirname, '../public/assets/soldier/soldier.glb');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(result.base64, 'base64'));
  console.log(result.log.join('\n'));
  console.log(JSON.stringify(result.info, null, 1));
  console.log(`wrote ${out} (${fs.statSync(out).size} bytes)`);
})().catch((error) => { console.error(error); process.exit(1); });
