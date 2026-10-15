'use strict';
const {test,before}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {build}=require('../scripts/build-keyboard');
const {boardModel,schematicNets,verifyElectrical}=require('../scripts/lib/keyboard');
const out=path.join(__dirname,'../build/keyboard');
let model,keys,sch,text,pcb;
before(async()=>{
  await build();
  pcb=fs.readFileSync(path.join(out,'choc5x4_half.kicad_pcb'),'utf8');
  model=boardModel(pcb); keys=JSON.parse(fs.readFileSync(path.join(out,'keys.json'),'utf8'));
  text=fs.readFileSync(path.join(out,'choc5x4_half.kicad_sch'),'utf8'); sch=schematicNets(text);
});
test('actual schematic connectivity agrees with all 20 directed PCB circuits',()=>{
  assert.deepEqual(verifyElectrical(model,keys,sch).scan_nets,['P0','P1','P2','P3','P4']);
});
test('electrical guard rejects a reversed diode and a five-net coverage collision',()=>{
  const reversed=structuredClone(model),d=reversed.footprints.find(f=>f.ref==='D1');
  [d.pads[0].net,d.pads[1].net]=[d.pads[1].net,d.pads[0].net];
  assert.throws(()=>verifyElectrical(reversed,keys,sch),/polarity mismatch/);
  const duplicate=structuredClone(keys); duplicate[1].sense=duplicate[0].sense; duplicate[1].sink=duplicate[0].sink;
  assert.throws(()=>verifyElectrical(model,duplicate,sch),/Duplicate charlieplex pair/);
  const self=structuredClone(keys); self[0].sink=self[0].sense;
  assert.throws(()=>verifyElectrical(model,self,sch),/self-pair/);
});
test('reader rejects an actual schematic short and a broken wire',()=>{
  const short=text.slice(0,-1)+'\n(wire (pts (xy 17.78 187.96) (xy 43.18 187.96)) (stroke (width 0) (type default)) (uuid 00000000-0000-4000-a000-000000000000)))';
  assert.throws(()=>schematicNets(short),/Two schematic nets shorted|unconnected/);
  const broken=text.replace('(xy 25.4 187.96)','(xy 25.4 187.97)');
  assert.notEqual(broken,text,'Fixture must actually break a wire endpoint');
  assert.throws(()=>schematicNets(broken),/unconnected pin/);
});
test('outputs are reproducible, including exact-input stale-output check',async()=>{
  await build(true);
});
