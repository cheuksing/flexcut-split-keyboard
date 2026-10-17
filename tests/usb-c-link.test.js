'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const spec=require('../scripts/lib/interface-spec.json');
const {orientationTable,singleKeyInput,reachablePairs}=require('../scripts/lib/usb-c-link');

test('requested pinout preserves independence but swaps GPIOs on either single reversal',()=>{
  const result=orientationTable(spec.requested_pairs,spec.nc);
  assert(result.every(r=>r.independent));
  assert.deepEqual(result.map(r=>r.destinations.flat()),[
    [1,2,3,4,5],[3,4,1,2,5],[3,4,1,2,5],[1,2,3,4,5]]);
  assert.throws(()=>orientationTable(spec.requested_pairs,[...spec.nc,'A2']));
});

test('selected reversal-mate pairs have one fixed cable crossing for all four orientations',()=>{
  const table=orientationTable(spec.selected_pairs,spec.nc);
  for(const row of table) {
    assert(row.independent);
    assert.deepEqual(row.destinations.flat(),[4,3,2,1,5]);
    const controllerAssignment=[4,3,2,1,5];
    assert.deepEqual(controllerAssignment.map(group=>row.destinations[group-1][0]),[1,2,3,4,5]);
  }
});

test('key loop includes both series resistors on both sense and sink legs',()=>{
  const p={vdd:3.3,vf:0.6,vol:0,pullup:20000,series:{adapter:1000,half:1000}};
  const r=singleKeyInput(p);
  assert.equal(r.loop_ohms,4000);
  assert(Math.abs(r.current_amps-112.5e-6)<1e-12);
  assert(Math.abs(r.input_volts-1.05)<1e-12);
  assert(r.input_volts>0.3*p.vdd);
});

test('two directed closures create the absent third forward path in the actual matrix',()=>{
  const keys=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'../build/keyboard/keys.json'),'utf8'));
  for(const [a,b] of [[0,1],[1,2],[0,2]])
    assert(keys.some(k=>k.sense===`P${a}`&&k.sink===`P${b}`));
  assert.deepEqual(reachablePairs([[0,1],[1,2]]),[[0,1],[0,2],[1,2]]);
  assert.deepEqual(reachablePairs([[0,1]]),[[0,1]]);
});


test('per-contact isolation adds 2k to the full two-leg cable loop',()=>{
  const r=singleKeyInput({vdd:3.3,vf:.6,vol:0,pullup:20000,
    series:{adapter:1000,half:1000,contact_adapter:1000,contact_half:1000}});
  assert.equal(r.loop_ohms,6000);
  assert(Math.abs(r.input_volts-1.223076923)<1e-8);
});

test('native sockets keep all USB2/power/CC/ground contacts NC and isolate every signal contact',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const {boardModel}=require('../scripts/lib/keyboard');
  const views=require('../scripts/lib/board-views').readBoardViews(path.join(__dirname,'../build/keyboard'));
  for(const [file,ports] of [['half',[['JH1','H',false]]],['adapter',[['JL','L',true],['JR','R',true]]]]) {
    const pcb=boardModel(views[file]);
    for(const [ref,bank,isAdapter] of ports) {
      const socket=pcb.footprints.find(f=>f.ref===ref);
      assert.equal(socket.pads.filter(p=>/^[AB]\d+$/.test(p.number)).length,24);
      for(const contact of ['A1','A4','A5','A6','A7','A9','A12','B1','B4','B5','B6','B7','B9','B12'])
        assert.equal(socket.pads.find(p=>p.number===contact).net,null,ref+'.'+contact);
      const raw=new Set();
      for(const [i,pair] of [['A2','B2'],['A3','B3'],['A10','B10'],['A11','B11'],['A8','B8']].entries()) {
        const logical=isAdapter?[3,2,1,0,4][i]:i;
        for(const contact of pair) {
          const net=socket.pads.find(p=>p.number===contact).net;
          assert(!raw.has(net));raw.add(net);
          const attached=pcb.footprints.filter(f=>f.pads.some(p=>p.net===net));
          assert.equal(attached.length,2,'Only socket and one isolation resistor may use '+net);
          const r=attached.find(f=>f.ref!==ref);
          assert.equal(r.value,'1k contact isolation');
          assert.equal(r.pads.find(p=>p.net!==net).net,isAdapter?bank+'_C'+logical:'HC'+logical);
        }
        const series=pcb.footprints.find(f=>f.ref===(isAdapter?'RA'+bank:'RH')+(logical+1));
        assert.equal(series.value,'1k');
        assert.deepEqual(new Set(series.pads.map(p=>p.net)),new Set(isAdapter?[bank+'_M'+logical,bank+'_C'+logical]:['HC'+logical,'P'+logical]));
      }
    }
    assert(!pcb.footprints.some(f=>/LM7705|LM4040|ADG7421|LDO/.test(f.value)));
  }
});

test('all generated assembly lands use the bottom face and USB-C contacts mirror physically',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const {boardModel}=require('../scripts/lib/keyboard');
  const views=require('../scripts/lib/board-views').readBoardViews(path.join(__dirname,'../build/keyboard'));
  for(const file of ['half','adapter','panel']) {
    const pcb=boardModel(views[file]);
    for(const f of pcb.footprints) {
      for(const p of f.pads.filter(p=>p.type==='smd')) {
        assert.equal(f.side,'B',`${file}: assembly face ${f.ref}`);
        assert.deepEqual(p.layers,['B.Cu','B.Paste','B.Mask'],`${file}: assembly layers ${f.ref}.${p.number}`);
      }
      if(f.name!=='keyboard-design:usb4115')continue;
      // Manufacturer's component-side A1/B12 are at negative X. When fitted
      // underneath, their top-view locations must be at positive X.
      for(const [pin,dx,dy] of [['A1',2.75,-0.83],['A12',-2.75,-0.83],['B12',2.75,0.83],['B1',-2.75,0.83]]) {
        const p=f.pads.find(p=>p.number===pin);
        assert(Math.abs(p.at[0]-f.at[0]-dx)<1e-6,`${file}: mirrored ${f.ref}.${pin} X`);
        assert(Math.abs(p.at[1]-f.at[1]-dy)<1e-6,`${file}: mirrored ${f.ref}.${pin} Y`);
      }
    }
  }
});
