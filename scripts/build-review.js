'use strict';

const fs = require('node:fs');
const path = require('node:path');
const specs = require('./lib/switches');
const { parse, child, children, numbers, primitives, parameters } = require('./lib/sexpr');
const { circleThrough } = require('./lib/geometry');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'build/review');
const library = path.join(output, 'SwitchFlex.pretty');
fs.mkdirSync(library, { recursive: true });
const htmlEscape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const xy = p => p.map(v => Number(v.toFixed(6))).join(' ');

function cutPaths(edges) {
  const paths = [];
  let d = '', start;
  for (const edge of edges) {
    if (!d) { start = edge.start; d = `M ${xy(start)} `; }
    if (edge.type === 'line') d += `L ${xy(edge.end)} `;
    else {
      const arc = circleThrough(edge.start, edge.mid, edge.end);
      d += `A ${arc.radius} ${arc.radius} 0 ${Math.abs(arc.sweep) > Math.PI ? 1 : 0} ${arc.sweep > 0 ? 1 : 0} ${xy(edge.end)} `;
    }
    if (edge.end.every((v, i) => v === start[i])) {
      paths.push(`<path d="${d}Z" fill="#000000"/>`);
      d = '';
    }
  }
  if (d) throw new Error('Open emitted cut contour');
  return paths.join('\n');
}

function draw(tree) {
  const pads = children(tree, 'pad');
  const graphics = [
    '<rect x="-13.525" y="-13.525" width="27.05" height="27.05" rx="1.2" fill="#c9b77a"/>',
    '<rect x="-9.525" y="-9.525" width="19.05" height="19.05" fill="none" stroke="#506781" stroke-width=".07" stroke-dasharray=".4 .25"/>',
    cutPaths(primitives(tree)),
  ];
  for (const rect of children(tree, 'fp_rect')) {
    if (child(rect, 'layer')[1] !== 'F.Fab') continue;
    const [x, y] = numbers(rect, 'start'), [x2, y2] = numbers(rect, 'end');
    graphics.push(`<rect class="envelope" x="${x}" y="${y}" width="${x2 - x}" height="${y2 - y}" fill="none" stroke="#1460a8" stroke-width=".07" stroke-dasharray=".35 .25"/>`);
  }
  for (const pad of pads) {
    const [x, y] = numbers(pad, 'at'), [w, h] = numbers(pad, 'size');
    const drill = child(pad, 'drill');
    if (pad[2] === 'thru_hole') {
      graphics.push(`<rect class="copper" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${w / 2}" fill="#d9252a"/>`);
    }
    const [dw, dh] = drill[1] === 'oval' ? drill.slice(2).map(Number) : [Number(drill[1]), Number(drill[1])];
    graphics.push(`<rect x="${x - dw / 2}" y="${y - dh / 2}" width="${dw}" height="${dh}" rx="${dw / 2}" fill="#000000"/>`);
    if (pad[1]) graphics.push(`<text class="pin" x="${x}" y="${y + 0.22}" text-anchor="middle" font-size=".65" fill="white">${pad[1]}</text>`);
  }
  return `<svg viewBox="-14 -14 28 28" role="img" aria-label="Footprint top view with bottom copper visible"><g class="physical">${graphics.join('\n')}</g></svg>`;
}

const drawings = [];
const cards = specs.map(spec => {
  const fp = require(path.join(root, `ergogen/footprints/${spec.id}.js`));
  const body = fp.body(parameters(fp));
  // Library files must not contain board net assignments or board placement.
  const standalone = body.replace(`"keyboard-design:${spec.id}"`, `"${spec.id}"`)
    .replace(' (layer "F.Cu")', ' (version 20240108) (generator "keyboard_design") (layer "F.Cu")')
    .replace(/^\(at 0 0 0\)\n/m, '')
    .replace(/ \(net [12] "REVIEW_(?:FROM|TO)"\)/g, '')
    .replace('(fp_text reference "SW1"', '(fp_text reference "REF**"');
  parse(standalone);
  fs.writeFileSync(path.join(library, `${spec.id}.kicad_mod`), standalone + '\n');
  const drawing = draw(parse(body));
  drawings.push(drawing.replace('<svg ', `<svg x="${drawings.length * 400}" y="50" width="400" height="400" `));
  fs.writeFileSync(path.join(output, `${spec.id}.svg`), drawing.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" '));
  return `<article><h2>${htmlEscape(spec.name)}</h2>${drawing}
    <p>${htmlEscape(spec.note)}</p><p>Center hole: ${spec.center} mm · signal pads: Ø2.30 / drill Ø${spec.drill} mm</p>
    <a href="SwitchFlex.pretty/${spec.id}.kicad_mod">KiCad footprint</a> · <a href="../../ergogen/footprints/${spec.id}.js">Ergogen source</a>
    <table><thead><tr><th>Pad</th><th>X (mm)</th><th>Y (mm)</th><th>Net parameter</th></tr></thead><tbody>${spec.pins.map(pin => `<tr><td>${pin.number}</td><td>${pin.x}</td><td>${pin.y}</td><td>${pin.number === '1' ? 'from' : 'to'}</td></tr>`).join('')}
    ${spec.holes.map(h => `<tr><td>Locator Ø${h.diameter} NPTH</td><td>${h.x}</td><td>${h.y}</td><td>None</td></tr>`).join('')}
    ${spec.support ? '<tr><td>V2 solder support</td><td>-5</td><td>5.15</td><td>Unconnected</td></tr>' : ''}</tbody></table></article>`;
});

// Show the Choc changes repeated at the real pitch: opposing V1 locator
// scallops reduce a shared rail from 4.0 mm to approximately 2.65 mm.
const choc = require(path.join(root, 'ergogen/footprints/choc.js'));
const chocDrawing = draw(parse(choc.body(parameters(choc))));
const chocCell = chocDrawing.split('<g class="physical">')[1].split('</g>')[0]
  .replace(/<rect x="-13\.525"[^>]+\/>/, '');
const matrix = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-34 -34 68 68" width="850" height="850" role="img" aria-label="Three by three Choc V1 V2 PCB; black cutouts; red solder pads"><defs><g id="choc-key">${chocCell}</g></defs><rect x="-32.575" y="-32.575" width="65.15" height="65.15" rx="1.2" fill="#c9b77a"/>${[-19.05,0,19.05].flatMap(y => [-19.05,0,19.05].map(x => `<use href="#choc-key" transform="translate(${x} ${y})"/>`)).join('')}</svg>`;
fs.writeFileSync(path.join(output, 'choc-3x3.svg'), matrix);

const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Switch footprint review</title>
<style>
:root{color-scheme:dark;font:15px/1.55 system-ui,sans-serif;background:#18202a;color:#e5eaf0}body{max-width:1280px;margin:32px auto;padding:0 22px}h1{font-size:26px;line-height:1.2}h2{font-size:20px;margin:0 0 12px}p{color:#c1cbd6}a{color:#80bdff}header{max-width:960px}.controls{display:flex;gap:24px;flex-wrap:wrap;margin:22px 0}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}article{background:#212d3a;padding:18px;border:1px solid #435263;border-radius:10px}article svg{display:block;width:100%;height:auto}article p{font-size:13px}table{width:100%;font-size:12px;border-collapse:collapse;margin-top:16px}th,td{text-align:left;border-bottom:1px solid #435263;padding:5px}label{cursor:pointer}body.bottom .physical{transform:scaleX(-1)}body.bottom .pin{transform-box:fill-box;transform-origin:center;transform:scaleX(-1)}body.front .copper{display:none}body.no-envelope .envelope{display:none}.legend{display:flex;flex-wrap:wrap;gap:18px;font-size:13px;margin:20px 0}.dot{display:inline-block;width:13px;height:13px;vertical-align:middle;border-radius:3px;margin-right:5px}.status{border-left:3px solid #d3ab56;padding-left:14px}@media(max-width:850px){main{grid-template-columns:1fr}}
</style><body><header><h1>Switch footprint review</h1>
<p>Three solder-only footprints with per-key flex cuts. These drawings are rendered from the emitted KiCad footprint expressions. Default view: looking down from the switch side with bottom copper visible. Coordinates use +X right, +Y down.</p>
<p class="status">Review artifacts only. No schematic or keyboard has been designed. Automated source/geometry checks run separately with <code>npm test</code>; native KiCad loading, Gerber/drill exports and physical fit still require verification.</p></header>
<div class="controls"><label>View <select id="view"><option value="xray">Top view, bottom copper visible</option><option value="front">Front copper only</option><option value="bottom">Bottom view (mirrored)</option></select></label><label><input id="envelope" type="checkbox" checked> Show body envelope</label></div>
<div class="legend"><span><i class="dot" style="background:#c9b77a"></i>Retained FR-4</span><span><i class="dot" style="background:#18202a;border:1px solid white"></i>Routed cuts / holes</span><span><i class="dot" style="background:#b93640"></i>B.Cu solder pads</span><span>Dashed square: 19.05 mm cell</span></div>
<main>${cards.join('\n')}</main><p>Choc V1: two Ø1.90 mm unplated locating holes at (±5.5, 0), retained on the moving island. Choc V2 support: 2.4 × 3.9 mm bottom copper capsule, 1.5 × 3.0 mm plated slot, no pad number or net. Copper is on B.Cu/B.Mask only; no F.Cu annular pads and no solder paste apertures.</p>
<h2>Choc V1 / V2 at 19.05 mm pitch</h2><div style="max-width:750px">${matrix}</div><p>65.15 × 65.15 mm 3×3 coupon. Facing V1 hole lobes leave approximately 2.65 mm of stationary shared rail. Follow the scalloped rails with rigid case ribs and relieved one-piece gasket webs; retain 0.30 mm clearance from each cut edge, giving approximately 2.05 mm gasket web at the narrowest section.</p>
<p>Nominal study geometry: 1.35 mm beams, 1.20 mm routed channels, 2.0 mm half-rails, approximately 0.40 mm copper-to-route clearance. Envelope guides are non-fabricating body bounds, not plate openings. The outer square is a review coupon illustration, not part of the switch footprint.</p>
<script>document.querySelector('#view').addEventListener('change',e=>{document.body.classList.remove('front','bottom');if(e.target.value!=='xray')document.body.classList.add(e.target.value)});document.querySelector('#envelope').addEventListener('change',e=>document.body.classList.toggle('no-envelope',!e.target.checked));</script></body></html>`;
fs.writeFileSync(path.join(output, 'index.html'), html);
fs.writeFileSync(path.join(output, 'footprints.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="500" viewBox="0 0 1200 500"><rect width="1200" height="500" fill="#18202a"/>
${specs.map((spec, i) => `<text x="${i * 400 + 200}" y="30" text-anchor="middle" fill="#e5eaf0" font-family="sans-serif" font-size="22">${spec.name}</text>`).join('')}
${drawings.join('\n')}<text x="600" y="480" text-anchor="middle" fill="#e5eaf0" font-family="sans-serif" font-size="15">Top view · bottom copper visible · black = routed cuts / drilled holes</text></svg>`);
console.log(`Review: ${path.join(output, 'index.html')}`);
console.log(`KiCad footprint library: ${library}`);
