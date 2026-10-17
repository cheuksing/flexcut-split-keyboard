'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),yaml=require('js-yaml');
const {deriveBoardViews}=require('../scripts/lib/board-views');
const {parse,children,child}=require('../scripts/lib/sexpr');
const panel=`(kicad_pcb (general (thickness 1.2)) (net 1 "SCAN")
  (footprint "keyboard-design:diode_sod523" (layer "B.Cu") (at 63.6 120 90)
    (fp_text reference "D1" (at 0 0) (layer "B.Fab"))
    (fp_text value "Quoted \\\"body\\\" (test)" (at 0 0) (layer "B.Fab"))
    (pad "1" smd rect (at -0.7 0 90) (size 0.6 0.7) (layers "B.Cu") (net 1 "SCAN")))
  (footprint "keyboard-design:xiao12" (layer "F.Cu") (at 98.1 133.4)
    (fp_text reference "U1" (at 0 0) (layer "F.Fab")))
  (footprint "keyboard-design:mouse_bites" (layer "F.Cu") (at 80 132.2)
    (fp_text reference "MB1" (at 0 0) (layer "F.Fab")))
  (gr_line (start 0 0) (end 5 0) (layer "Edge.Cuts")))`;
const outlines={half:'(gr_line (start 1 1) (end 2 1) (layer "Edge.Cuts"))',
  adapter:'(gr_line (start 3 3) (end 4 3) (layer "Edge.Cuts"))'};

test('project has one panel PCB and defines each matrix footprint group once',()=>{
  const config=yaml.safeLoad(fs.readFileSync(path.join(__dirname,'../ergogen/config.yaml'),'utf8'));
  assert.deepEqual(Object.keys(config.pcbs),['choc5x4_panel']);
  const types=Object.values(config.pcbs.choc5x4_panel.footprints).map(f=>f.what);
  for(const type of ['choc','diode_sod523','interface_half','interface_adapter','mouse_bites'])
    assert.equal(types.filter(t=>t===type).length,1,type);
});

test('derived views preserve panel footprint expressions/nets and replace only outer edges',()=>{
  const views=deriveBoardViews(panel,outlines),source=parse(panel);
  assert.equal(views.panel,panel);
  const half=parse(views.half),adapter=parse(views.adapter);
  assert.deepEqual(children(half,'footprint'),children(source,'footprint').slice(0,1));
  assert.deepEqual(children(adapter,'footprint'),children(source,'footprint').slice(1,2));
  assert.deepEqual(children(half,'net'),children(source,'net'));
  assert.deepEqual(children(adapter,'net'),children(source,'net'));
  assert.deepEqual(children(half,'gr_line'),[parse(outlines.half)]);
  assert.deepEqual(children(adapter,'gr_line'),[parse(outlines.adapter)]);
  const edited=deriveBoardViews(panel.replace('(at 63.6 120 90)','(at 63.5 120 90)'),outlines);
  assert.deepEqual(child(children(parse(edited.half),'footprint')[0],'at').slice(1),['63.5','120','90']);
  assert.equal(edited.adapter,views.adapter);
});

test('extraction rejects lost components, repeated references and unhandled routed copper',()=>{
  const append=raw=>panel.slice(0,-1)+raw+')';
  assert.throws(()=>deriveBoardViews(append('(footprint "unknown" (fp_text reference "X1"))'),outlines),/no derived board assignment/);
  assert.throws(()=>deriveBoardViews(append('(footprint "keyboard-design:xiao12" (fp_text reference "U1"))'),outlines),/duplicate panel reference/);
  assert.throws(()=>deriveBoardViews(append('(segment (start 0 0) (end 1 1))'),outlines),/unrouted panel/);
});
