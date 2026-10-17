'use strict';
// Actual native panel/adapter review, not a space-reservation illustration.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {Resvg}=require('@resvg/resvg-js');
const {pcbPreview}=require('./lib/pcb-preview');
const out=path.resolve(__dirname,'../build/keyboard');
const check=JSON.parse(fs.readFileSync(path.join(out,'../review/manufacturing-check.json'),'utf8'));
assert.equal(check.status,'PASS WITH OPEN REVIEWS');assert(check.panel?.actual_adapter_and_panel_in_cad);
const p=check.panel;
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
const text=(s,x,y,size=2.6,color='#dbe6ed')=>`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${color}">${esc(s)}</text>`;
function save(name,svg){fs.writeFileSync(path.join(out,name+'.svg'),svg+'\n');fs.writeFileSync(path.join(out,name+'.png'),new Resvg(svg,{fitTo:{mode:'width',value:1800}}).render().asPng());}
const views=require('./lib/board-views').readBoardViews(out);
const panel=pcbPreview(views.panel);
const adapter=pcbPreview(views.adapter);
function nested(svg,x,y,w,h){return svg.replace('<svg ',`<svg x="${x}" y="${y}" `).replace(/width="[^"]+" height="[^"]+"/,`width="${w}" height="${h}"`);}
let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 156 168" width="156mm" height="168mm"><rect width="156" height="168" fill="#101820"/>';
svg+=text('5×4 HALF + PASSIVE BREAKAWAY ADAPTER',8,10,4);
svg+=text(`${p.width_mm.toFixed(2)} × ${p.height_mm.toFixed(3)} mm bare PCB · 1.2 mm nominal FR-4`,8,17,2.8);
svg+=nested(panel.svg,8,22,140,118);
svg+=text('Two mouse-bite tabs · upright USB-C ports · B.Cu blue / F.Cu red',8,146,2.5);
svg+=text('Mount XIAO after depaneling; module overhangs carrier on 1×6 headers.',8,153,2.5);
svg+=text('UNROUTED REVIEW · scan margins, fault safety, native DRC and CAM open',8,161,2.4,'#ffcc8f');
svg+='</svg>';save('panel-fit',svg);
let a='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104 79" width="104mm" height="79mm"><rect width="104" height="79" fill="#101820"/>';
a+=text('SIMPLE XIAO ADAPTER / COMPONENT PLACEMENT',5,9,3.1);
a+=nested(adapter.svg,5,15,94,42);
a+=text('2 USB-C ports · 10 GPIO · series resistors + TVS only',5,63,2.5);
a+=text('No added regulator or active protection. Electrical qualification open.',5,70,2.3,'#ffcc8f');
a+='</svg>';save('adapter',a);
fs.writeFileSync(path.join(out,'panel-fit.json'),JSON.stringify(p,null,2)+'\n');
console.log(`Actual panel review: ${p.width_mm.toFixed(3)} × ${p.height_mm.toFixed(3)} mm; actual adapter and mouse-bite geometry`);
