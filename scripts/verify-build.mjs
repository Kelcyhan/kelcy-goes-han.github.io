import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const failures = [];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function requireFile(relativePath) {
  const path = resolve(dist, relativePath);
  if (!(await exists(path))) failures.push(`Missing: ${relativePath}`);
}

async function verifyHtmlReferences(relativePath) {
  const fullPath = resolve(dist, relativePath);
  const source = await readFile(fullPath, 'utf8');
  const references = [...source.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((value) => !/^(?:https?:|data:|mailto:|#)/.test(value));

  for (const reference of references) {
    const clean = reference.split(/[?#]/)[0];
    if (!clean || clean === '/') continue;
    const target = clean.startsWith('/')
      ? resolve(dist, clean.slice(1))
      : resolve(dirname(fullPath), clean);
    if (!(await exists(target))) failures.push(`${relativePath} -> ${reference}`);
  }
}

await requireFile('index.html');
await requireFile('noise.png');
await requireFile('audio-processor.js');
await verifyHtmlReferences('index.html');

for (const [name, path] of [
  ['agent-system', 'demos/agent-system/index.html'],
  ['supply-net', 'demos/supply-net/index.html'],
  ['swarm', 'demos/swarm/index.html'],
]) {
  await requireFile(path);
  if (await exists(resolve(dist, path))) await verifyHtmlReferences(path);
  if (!name) failures.push('Invalid demo name');
}

for (const demoId of ['agent-system', 'supply-net', 'swarm']) {
  const demoHtml = await readFile(resolve(dist, `demos/${demoId}/index.html`), 'utf8');
  if (!demoHtml.includes("source: 'kelcy-demo'")) {
    failures.push(`${demoId} demo is missing its versioned ready-message source`);
  }
  if (!demoHtml.includes(`demo: '${demoId}'`)) {
    failures.push(`${demoId} demo ready message has the wrong identity`);
  }
  if (!demoHtml.includes('window.location.origin')) {
    failures.push(`${demoId} demo ready message is not restricted to its own origin`);
  }
}

const vercelConfig = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));
const rewriteSources = new Set(vercelConfig.rewrites?.map((rewrite) => rewrite.source));
if (!rewriteSources.has('/projects/:path*')) failures.push('Vercel project-route SPA fallback is missing');
for (const legacy of ['AISpeakingLab', 'AgentSystem', 'DiscussAgain', 'MetacogReef', 'PointFit', 'Puri', 'SupplyNet', 'Swarm']) {
  if (!rewriteSources.has(`/${legacy}`) || !rewriteSources.has(`/${legacy}/`)) {
    failures.push(`Vercel legacy fallback is incomplete for ${legacy}`);
  }
}
if ([...rewriteSources].some((source) => source.startsWith('/demos'))) {
  failures.push('Vercel rewrites must not intercept isolated demo files');
}

for (let scene = 1; scene <= 4; scene += 1) {
  for (let frame = 1; frame <= 121; frame += 1) {
    await requireFile(`assets/frames/scene_${scene}/frame_${String(frame).padStart(3, '0')}.webp`);
  }
}

const builtAssets = await readdir(resolve(dist, 'assets'));
const requiredAssetGroups = [
  ['background music', (name) => extname(name) === '.mp3'],
  ['water droplet video', (name) => name.startsWith('water_drop-') && extname(name) === '.mp4'],
  ['DiscussAgain video', (name) => name.startsWith('demo-') && extname(name) === '.mp4'],
  ['PointFit training video', (name) => name.startsWith('pt-home-training-') && extname(name) === '.mp4'],
  ['PointFit data video', (name) => name.startsWith('pt-home-data-') && extname(name) === '.mp4'],
];

for (const [label, matcher] of requiredAssetGroups) {
  if (!builtAssets.some(matcher)) failures.push(`Missing built asset group: ${label}`);
}

const supplyBundle = await readFile(resolve(dist, 'demos/supply-net/static/js/main-tljh7hw2.js'), 'utf8');
if (supplyBundle.includes('./imgs/company.png')) failures.push('SupplyNet still references missing company.png');
if (supplyBundle.includes('"/imgs/map.jpg"') || supplyBundle.includes("'/imgs/map.jpg'")) {
  failures.push('SupplyNet still references the domain-root map image');
}

if (failures.length) {
  console.error(`Site verification failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('Site verification passed: routes, demos, frame sequences, audio, and videos are present.');
}
