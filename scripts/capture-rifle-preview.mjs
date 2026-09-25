import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const out =
  process.argv[2] ||
  path.join(root, '../cursor/stores/bc-01a0cda8-d508-720e-a455-b8dbd4043775/media/spiketactics-rifle-3d.png');

async function waitForServer(url, ms = 15000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Vite preview did not start');
}

async function main() {
  const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4173'], {
    cwd: root,
    stdio: 'ignore',
  });

  try {
    await waitForServer('http://127.0.0.1:4173/rifle-preview.html');
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    await page.goto('http://127.0.0.1:4173/rifle-preview.html', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__RIFLE_READY__ === true, { timeout: 10000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: out, type: 'png' });
    await browser.close();
    console.log('Saved', out);
  } finally {
    preview.kill('SIGTERM');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
