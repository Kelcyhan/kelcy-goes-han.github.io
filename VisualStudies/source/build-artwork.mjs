// Run with Node from any directory. The supplied PNG is embedded unchanged.
// SVG text, colours and coordinates remain editable; no generated illustration.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const original = await readFile(resolve(root, 'assets/colour-yellow.png'));
const illustration = `data:image/png;base64,${original.toString('base64')}`;
const palette = { paper: '#F8EED2', ink: '#493321', yellow: '#EDAF38', line: '#B9A779' };
const text = (x, y, label, size = 24, options = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" ${options}>${label}</text>`;
const rule = (x1, y, x2) => `<path d="M${x1} ${y}H${x2}" stroke="${palette.line}" stroke-width="1.5"/>`;
const arrow = (x,y) => `<path d="M${x} ${y}h27m-9-9 9 9-9 9" fill="none" stroke="currentColor" stroke-width="2"/>`;
const cta = (x, y, w = 256, h = 68) => `<g color="${palette.paper}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h/2}" fill="${palette.ink}"/>${text(x+27,y+h/2+8,'Take a break',23,`fill="${palette.paper}"`)}${arrow(x+w-56,y+h/2)}</g>`;
const logo = (x,y) => `${text(x,y,'OFF HOURS',30,'font-weight="700" letter-spacing="2.4"')}<circle cx="${x+230}" cy="${y-11}" r="8" fill="${palette.yellow}"/>`;
const photo = (x,y,size) => `<image x="${x}" y="${y}" width="${size}" height="${size}" href="${illustration}"/>`;
const title = (x,y,line1,line2,size,step) => `<g font-family="Georgia, 'Times New Roman', serif" letter-spacing="-5">${text(x,y,line1,size)}${text(x,y+step,line2,size,'font-style="italic"')}</g>`;
const svg = (w,h,name,body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title desc"><title id="title">${name}</title><desc id="desc">OFF HOURS coffee and play. Make room for a break. A fictional concept using the unaltered yellow colour study from the supplied archive. AI-assisted layout and copy, 2026.</desc><rect width="${w}" height="${h}" fill="${palette.paper}"/><g fill="${palette.ink}" color="${palette.ink}" font-family="Arial, Helvetica, sans-serif">${body}</g></svg>`;

const social = svg(1080,1350,'OFF HOURS social concept — 1080 × 1350',`
  ${logo(72,102)}
  ${text(1008,100,'COFFEE &amp; PLAY',21,'text-anchor="end" letter-spacing="2"')}
  ${rule(72,147,1008)}
  ${title(64,285,'Make room','for a break.',124,119)}
  ${text(75,469,'A LITTLE TIME, WELL SPENT.',19,'letter-spacing="2.5"')}
  ${photo(381,529,627)}
  ${text(74,587,'SIP.',35,'font-weight="700" letter-spacing="2"')}
  ${text(74,635,'SNACK.',35,'font-weight="700" letter-spacing="2"')}
  ${text(74,683,'STAY.',35,'font-weight="700" letter-spacing="2"')}
  ${text(74,766,'Coffee, something',23)}
  ${text(74,801,'sweet, and a little',23)}
  ${text(74,836,'time to play.',23)}
  ${cta(72,1028)}
  ${rule(72,1210,1008)}
  ${text(72,1265,'YOUR OFF HOURS START HERE.',20,'letter-spacing="1.8"')}
  ${text(1008,1265,'CONCEPT / 01',17,'text-anchor="end" letter-spacing="1.5"')}
`);

const banner = svg(1600,600,'OFF HOURS web banner concept — 1600 × 600',`
  ${logo(72,82)}
  ${text(956,80,'COFFEE &amp; PLAY',19,'text-anchor="end" letter-spacing="2"')}
  ${rule(72,118,956)}
  ${title(66,247,'Make room','for a break.',103,103)}
  ${text(74,410,'Coffee, something sweet, and a little time to play.',23)}
  ${cta(72,464,256,64)}
  ${text(956,520,'CONCEPT / 01',16,'text-anchor="end" letter-spacing="1.5"')}
  ${photo(1040,56,488)}
`);

await writeFile(resolve(root,'assets/off-hours-social.svg'),social);
await writeFile(resolve(root,'assets/off-hours-banner.svg'),banner);
await writeFile(resolve(root,'source/design-tokens.json'),JSON.stringify({
  name:'OFF HOURS', type:'Fictional coffee and leisure concept', version:'2026-09-26',
  palette, fonts:{display:'Georgia (system serif)',body:'Arial (system sans-serif)'},
  typography:{social:{headline:124,body:23},banner:{headline:103,body:23}},
  sizes:{social:[1080,1350],banner:[1600,600]}, margins:{social:72,banner:72},
  original:{file:'assets/colour-yellow.png',size:[627,627],pixelEdits:false},
  sourceNote:'Original date, software, references and contribution unconfirmed. Layout, copy and code prepared with Codex; concept pending owner review.',
},null,2)+'\n');
console.log('Created editable SVGs with the original illustration embedded byte-for-byte.');
