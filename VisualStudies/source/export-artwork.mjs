// Export the code-native SVG layouts to fixed-size PNGs using Playwright.
// Dependencies may be supplied through the environment without a repo install.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.STUDIES_PLAYWRIGHT_PATH || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.STUDIES_BROWSER_PATH ? { executablePath: process.env.STUDIES_BROWSER_PATH } : {}),
});
try {
  for (const [name,width,height] of [['social',1080,1350],['banner',1600,600]]) {
    const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
    await page.goto(new URL(`../assets/off-hours-${name}.svg`, import.meta.url).href);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({path:resolve(root,`assets/off-hours-${name}.png`)});
    await page.close();
  }
} finally { await browser.close(); }
