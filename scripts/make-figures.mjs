/* Regenerate the repository's pictures from the app's own code.
 *
 * The figures in the README and the Open Graph card are drawn by the same
 * renderer the app uses, over the same sample site, driven headlessly. So they
 * cannot drift from what the tool actually draws, and there is no hand-made
 * image in this repository that claims to be a screenshot.
 *
 *   npm run dev              # in one terminal
 *   npm i -D playwright && node scripts/make-figures.mjs
 *
 * Playwright is not a dependency of the app — only of this script — which is
 * why it is not in package.json's devDependencies by default. */

import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const ORIGIN = process.env.ORIGIN || 'http://localhost:8765';
const EXEC = process.env.CHROMIUM_PATH || undefined;
const root = new URL('..', import.meta.url).pathname;

const out = async (rel, buf) => {
  const path = join(root, rel);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buf);
  console.log('wrote', rel);
};

const browser = await chromium.launch({ executablePath: EXEC });

/* --- the Open Graph card ------------------------------------------------ */
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
  const svg = await page.evaluate(async () => {
    const [{ sampleSite }, { autoLayout }, { planFigureSvg }] = await Promise.all([
      import('/src/site.js'), import('/src/autolayout.js'), import('/src/render.js'),
    ]);
    const s = sampleSite();
    const plan = autoLayout(s);
    Object.assign(s, { heads: plan.heads, pipes: plan.pipes, drip: plan.drip });
    return planFigureSvg(s, { width: 900 }).outerHTML;
  });
  await page.setContent(`<!doctype html><html><head>
    <link rel="stylesheet" href="${ORIGIN}/styles.css">
    <style>
      /* The lot is portrait and the card is landscape, so the drawing is
         scaled to bleed off the right edge rather than shrunk to fit — at
         thumbnail size an arc you can see beats a whole plan you cannot. */
      html,body{margin:0;width:1200px;height:630px;overflow:hidden}
      body{background:var(--bg);font-family:var(--font-body);position:relative}
      .art{position:absolute;inset:0 -60px 0 540px;overflow:hidden;display:flex;align-items:center}
      .art svg{width:1000px;height:auto;margin-left:-90px}
      .fade{position:absolute;inset:0 auto 0 500px;width:200px;
            background:linear-gradient(90deg,var(--bg) 30%,transparent)}
      /* The Lab's share-card shape, same as the other experiments' cards: a
         mono kicker, the name in the grotesk, the claim in the reading serif,
         and the site's wordmark. */
      .copy{position:absolute;left:90px;top:0;bottom:0;width:440px}
      .kicker{position:absolute;top:152px;margin:0;font-size:20px;letter-spacing:0.07em}
      h1{position:absolute;top:222px;left:-3px;margin:0;font-family:var(--font-display);font-size:66px;line-height:1.04;
         letter-spacing:-0.025em;font-weight:600;color:var(--strong);white-space:nowrap}
      .claim{position:absolute;top:322px;margin:0;font-family:var(--font-serif);font-size:27px;line-height:1.48;
           color:var(--body-2);max-width:none;white-space:nowrap}
      .site{position:absolute;top:519px;margin:0;font-size:21px;font-weight:700;letter-spacing:0.16em;
            text-transform:uppercase;color:var(--strong)}
    </style></head><body>
    <div class="art">${svg}</div>
    <div class="fade"></div>
    <div class="copy">
      <p class="kicker label">App · The Lab</p>
      <h1>Irrigation Lab</h1>
      <p class="claim">A sprinkler plan for your yard,<br>down to the dig plan.</p>
      <p class="site">Ryan McCarty</p>
    </div>
  </body></html>`, { waitUntil: 'networkidle' });
  // Ask for each face by name: a font nothing has painted yet is not "ready".
  await page.evaluate(async () => {
    await Promise.all(['600 20px "Hanken Grotesk"', '700 20px "Hanken Grotesk"', '400 20px "Source Serif 4"', '400 20px "JetBrains Mono"']
      .map((f) => document.fonts.load(f)));
    await document.fonts.ready;
  });
  await out('opengraph.png', await page.screenshot({ type: 'png' }));
  await page.close();
}

/* --- README figures ----------------------------------------------------- */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
  await page.click('#start-sample');
  await page.waitForTimeout(2000);
  await out('docs/figures/plan.png', await page.screenshot({ clip: { x: 32, y: 76, width: 1376, height: 808 } }));

  await page.selectOption('#sel-focus', '3');
  await page.waitForTimeout(900);
  await out('docs/figures/zone-focus.png', await page.screenshot({ clip: { x: 32, y: 76, width: 1376, height: 808 } }));
  await page.close();
}

await browser.close();
