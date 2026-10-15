'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {Resvg}=require('@resvg/resvg-js');
const {schematicNets}=require('./lib/keyboard');
const out=path.resolve(__dirname,'../build/keyboard');
const model=JSON.parse(fs.readFileSync(path.join(out,'model.json'),'utf8'));
const check=JSON.parse(fs.readFileSync(path.join(out,'../review/manufacturing-check.json'),'utf8'));
if (check.status!=='PASS WITH OPEN REVIEWS' || !check.keyboard) throw new Error('Complete manufacturing check required before review drawings');
const keys=model.keys, nets=schematicNets(fs.readFileSync(path.join(out,'choc5x4_half.kicad_sch'),'utf8'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const n=v=>Number(v.toFixed(3));
const ring=p=>'M '+p.map(x=>x.map(n).join(',')).join(' L ')+' Z';
const txt=(s,x,y,size=2.4,color='#dbe6ed',anchor='middle')=>`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" text-anchor="${anchor}" fill="${color}">${esc(s)}</text>`;
const bounds=model.perimeter[0].reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);
const [minX,minY,maxX,maxY]=bounds, width=maxX-minX,height=maxY-minY;
const polygon=(p,fill,stroke='none',sw=.1)=>`<path d="${ring(p)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
function capsule(x,y,w,h,fill) {
  return `<rect x="${n(x-w/2)}" y="${n(y-h/2)}" width="${w}" height="${h}" rx="${Math.min(w,h)/2}" fill="${fill}"/>`;
}
function board() {
  let s=polygon(model.perimeter[0],'#cab57b');
  for(const f of model.footprints) {
    for(const c of f.cuts) s+=polygon(c,'#000');
    for(const p of f.pads) {
      const [x,y]=p.at,[w,h]=p.size;
      if(p.type!=='np_thru_hole') s+=p.shape==='rect'?`<rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" fill="#2563eb"/>`:capsule(x,y,w,h,'#2563eb');
      if(p.drill) {const [dw,dh]=p.drill.length===2?p.drill:[p.drill[0],p.drill[0]];s+=capsule(x,y,dw,dh,'#000');}
    }
  }
  for(const k of keys) {
    const [x,y]=k.at;
    s+=`<rect x="${x-7.5}" y="${y-7.5}" width="15" height="15" fill="none" stroke="#2b6a88" stroke-width=".13" stroke-dasharray=".6 .4"/>`;
    s+=txt(k.switch,x+3.6,y+4.4,1.45,'#26313a');
    s+=txt(`${k.sense}→${k.sink}`,x,y+7.3,1.3,'#26313a');
  }
  return s;
}
function save(name,svg,pixels=1800) {
  fs.writeFileSync(path.join(out,name+'.svg'),svg+'\n');
  const render=new Resvg(svg,{fitTo:{mode:'width',value:pixels},font:{loadSystemFonts:true}});
  fs.writeFileSync(path.join(out,name+'.png'),render.render().asPng());
}
const start=(w,h)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}mm" height="${h}mm"><rect width="${w}" height="${h}" fill="#101820"/>`;
let layout=start(260,165);
layout+=txt('CHOC 5×4 / ONE IDENTICAL HALF PCB, USED TWICE',130,10,4.2);
layout+=txt('20 keys + 20 diodes per half · five scan lines · 19.05 mm pitch · 1.2 mm nominal FR-4',130,17,2.6,'#95aebc');
for(let hand=0;hand<2;hand++) {
  const ox=16+hand*126,oy=38;
  layout+=txt(hand?'RIGHT HAND — same PCB orientation':'LEFT HAND',ox+width/2,27,3.2);
  const names=hand?['inner','index','middle','ring','pinky']:['pinky','ring','middle','index','inner'];
  for(let c=0;c<5;c++) layout+=txt(names[c],ox+60+c*19.05-minX,34,2.1,'#95aebc');
  layout+=`<g transform="translate(${ox-minX} ${oy-minY})">${board()}</g>`;
  layout+=txt('103.25 × 92.20 mm · cutouts black · B.Cu shown blue through board',ox+width/2,136,2,'#95aebc');
}
layout+=txt('r0 top / r3 bottom · cumulative stagger 0, +3, +8, +3, 0 mm',130,144,2.5);
layout+=txt('UNROUTED MATRIX REVIEW · adapter and controller deferred · rollover / native ERC & DRC pending',130,152,2.4,'#ffcc8f');
layout+='</svg>'; save('layout',layout);

let matrix=start(305,196);
matrix+=txt('FIVE-NET CHARLIEPLEX MATRIX / PER IDENTICAL HALF',152.5,11,4.2);
matrix+=txt('sense pull-up → switch → diode anode A(2) → cathode K(1) → active-low sink',152.5,19,2.6,'#95aebc');
for(let c=0;c<5;c++) matrix+=txt(`COL${c} / P${c}`,34+c*59,30,2.8);
for(const k of keys) {
  const x=8+k.column*59,y=43+Number(k.row[1])*32;
  const sense=nets[k.switch]['1'],sink=nets[k.diode]['1'];
  matrix+=txt(k.row,x,y+2,2,'#95aebc','start');
  matrix+=txt(sense,x+8,y-3,2.2,'#93d8d0');
  matrix+=`<g stroke="#cbd9df" stroke-width=".4" fill="none">
    <path d="M ${x+7},${y} H ${x+18} M ${x+28},${y} H ${x+36} M ${x+41},${y} H ${x+51}"/>
    <circle cx="${x+18}" cy="${y}" r=".8"/><circle cx="${x+28}" cy="${y}" r=".8"/>
    <path d="M ${x+18},${y-1} L ${x+27},${y-4}"/>
    <path d="M ${x+36},${y-2} V ${y+2} L ${x+40},${y} Z M ${x+40},${y-2.5} V ${y+2.5}"/>
    </g>`;
  matrix+=txt(sink,x+50,y-3,2.2,'#93d8d0');
  matrix+=txt(k.switch,x+23,y+6,2.1); matrix+=txt(k.diode,x+38,y+6,2.1);
  matrix+=txt(k.local,x+30,y+11,1.7,'#95aebc');
}
matrix+=txt('20 distinct directed pairs, no self-pairs · COL / ROW labels are position metadata',152.5,171,2.7);
matrix+=txt('Electrical hold point: two-key forward paths can ghost; MCU thresholds / diode margins / firmware need validation.',152.5,180,2.4,'#ffcc8f');
matrix+='</svg>';save('matrix',matrix);

const support=JSON.parse(fs.readFileSync(path.join(out,'support-plan.json'),'utf8'));
let supports=start(260,258);
supports+=txt('STATIONARY SUPPORT / 2D CONCEPTS ONLY',130,10,4.2);
supports+=txt('Moving islands and both beams excluded · bottom parts relieved around diode bodies',130,18,2.6,'#95aebc');
Object.entries(support.sheets).forEach(([name,g],i)=>{
  const ox=16+(i%2)*126,oy=34+Math.floor(i/2)*108;
  supports+=txt(name.replaceAll('_',' '),ox+width/2,oy-6,3);
  const d=ring(g.exterior)+' '+g.holes.map(ring).join(' ');
  supports+=`<g transform="translate(${ox-minX} ${oy-minY})"><path d="${d}" fill="#55b2a5" fill-rule="evenodd"/></g>`;
});
supports+=txt('Mounts / clamps / lower relief load paths / Z stackup / compression / hard stops remain open.',130,249,2.3,'#ffcc8f');
supports+='</svg>';save('supports',supports);

const k=check.keyboard;
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Choc 5×4 matrix review</title>
<style>body{font:16px/1.5 system-ui;margin:0;background:#101820;color:#dbe6ed}main{max-width:1400px;margin:auto;padding:24px}a{color:#93d8d0}nav{display:flex;gap:16px;flex-wrap:wrap}img{width:100%;height:auto}section{margin:32px 0}p{max-width:1000px}.status{color:#ffcc8f}table{border-collapse:collapse}td,th{border:1px solid #42535f;padding:8px 16px}h1{margin-bottom:8px}</style>
<main><h1>Choc 5×4 · one identical half</h1><p>Use two copies component-side up. ${k.keys} switches and 20 bottom-side SOD-123 diodes per half; five scan nets. Right-hand anatomical columns reverse in firmware or the later adapter.</p>
<p class="status">PASS WITH OPEN REVIEWS — geometry and parsed schematic connectivity only. Unrouted; native KiCad ERC/DRC, charlieplex multi-key electrical margins, complete case and adapter remain open.</p>
<nav><a href="#layout">Layout</a><a href="#matrix">Circuit</a><a href="#support">Support concept</a><a href="choc5x4_half.kicad_pcb">KiCad PCB</a><a href="choc5x4_half.kicad_sch">KiCad schematic</a><a href="matrix.csv">Net map CSV</a><a href="../review/index.html">Footprints</a></nav>
<section id="layout"><h2>Same PCB for either hand</h2><img src="layout.svg" alt="Two identical 5 by 4 PCBs with symmetric cumulative staggers"><p>Rows follow the supplied Ergogen order: r3 bottom, r0 top. Dashed outlines are 15 mm switch-body guides; they are not plate cuts. The blue copper is on the underside and shown here to review clearances. Individual Choc pin and cut patterns keep their orientation.</p></section>
<section id="matrix"><h2>Twenty directed pairs</h2><img src="matrix.svg" alt="Every switch and diode connected between a distinct ordered pair of P0 through P4"><p>Only P0–P4 are electrical scan lines. One line is driven low at a time; the other lines are pulled-up inputs. Release the previous sink before selecting another. This is a circuit review, not tested firmware. Series diodes alone do not prove rollover: P0→P1 plus P1→P2 can appear as P0→P2. Controller and diode selection need voltage-margin and multi-key tests.</p></section>
<section><h2>Measured geometry</h2><table><tr><th>Half outline</th><td>${k.width_mm.toFixed(2)} × ${k.height_mm.toFixed(2)} mm</td></tr><tr><th>Nominal thickness</th><td>1.2 mm</td></tr><tr><th>Minimum stationary rail</th><td>${k.min_shared_rail_mm.toFixed(3)} mm</td></tr><tr><th>Adverse rail screen</th><td>${k.shared_rail_adverse_stack_mm.toFixed(3)} mm</td></tr><tr><th>Upper gasket web before trimming</th><td>${k.min_gasket_web_before_component_reliefs_mm.toFixed(3)} mm</td></tr></table><p>Width exceeds 100 mm; no promotional price is confirmed. Input SHA-256: <code>${check.input_sha256}</code>.</p></section>
<section id="support"><h2>Support sheets follow the new stationary grid</h2><img src="supports.svg" alt="Upper and lower continuous gasket and rib concepts with moving-system exclusions"><p>Lower plans include diode-body relief. Small unsupported tongues are deliberately cut away after the 1.30 mm opening screen; omitted areas are recorded in the verification report. These 2D concepts do not define materials, mount holes, clamp nodes, case heights, hard stops or compression. Reduced lower support coverage needs mechanical review.</p></section>
<p>Generated offline from emitted CAD. No manufacturer submission, order, CAM review or native KiCad validation was performed.</p></main></html>`;
fs.writeFileSync(path.join(out,'index.html'),html+'\n');
console.log('Keyboard review: build/keyboard/index.html; layout, matrix and support SVG/PNG drawings');
