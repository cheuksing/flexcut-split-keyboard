'use strict';

const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { configure } = require('./lib/ergogen-engine');
const { boardModel, schematicNets, verifyElectrical } = require('./lib/keyboard');
const { schematic, uuid } = require('./lib/keyboard-schematic');
const root = path.resolve(__dirname, '..');
const out = path.join(root,'build/keyboard');

async function build(check=false) {
  if (!check) require('./invalidate-verification')();
  const write=(filename,content)=>{
    if (check) assert.equal(fs.readFileSync(filename,'utf8'),content,`Stale keyboard output: ${path.relative(root,filename)}`);
    else fs.writeFileSync(filename,content);
  };
  fs.mkdirSync(out,{recursive:true});
  const ergogen = configure();
  const config = fs.readFileSync(path.join(root,'ergogen/config.yaml'),'utf8');
  const result = await ergogen.process(config,{debug:true,svg:true});
  const keys = Object.entries(result.points).map(([id,p],i) => ({
    id, switch:`SW${i+1}`, diode:`D${i+1}`, column:Number(p.meta.column_net.slice(3)),
    column_name:p.meta.col.name, row:p.meta.row, row_net:p.meta.row_net,
    at:[p.x,-p.y], rotation:p.r, sense:p.meta.scan_from, sink:p.meta.scan_to,
    local:`K_${p.meta.column_net}_${p.meta.row_net}`,
  }));
  const sch = schematic(keys), schPath=path.join(out,'choc5x4_half.kicad_sch');
  write(schPath,sch);
  let pcb=result.pcbs.choc5x4_half;
  // Give each PCB footprint the matching schematic path so the pair can be
  // associated in KiCad. Stable UUIDs keep regenerated source diffs readable.
  for (const k of keys) for (const ref of [k.switch,k.diode]) {
    const marker = `(fp_text reference "${ref}"`;
    const position=pcb.indexOf(marker);
    if (position<0) throw new Error(`Missing PCB reference ${ref}`);
    pcb=pcb.slice(0,position)+`(path "/${uuid('root')}/${uuid(ref)}")\n`+pcb.slice(position);
  }
  write(path.join(out,'choc5x4_half.kicad_pcb'),pcb);
  write(path.join(out,'keys.json'),JSON.stringify(keys,null,2)+'\n');
  write(path.join(out,'matrix.csv'),
    'key,switch,diode,column,row,x_mm,y_mm,sense,anode_net,sink\n'+keys.map(k=>
      [k.id,k.switch,k.diode,k.column,k.row,...k.at,k.sense,k.local,k.sink].join(',')).join('\n')+'\n');
  write(path.join(out,'outline.svg'),result.outlines.half.svg);
  write(path.join(out,'outline.dxf'),result.outlines.half.dxf);
  const model=boardModel(pcb);
  model.keys=keys;
  model.electrical=verifyElectrical(model,keys,schematicNets(sch));
  write(path.join(out,'model.json'),JSON.stringify(model)+'\n');
  // Small local library for footprint assignment/editing without installing
  // a global library. Extract actual emitted footprints, reset their origins.
  // Use the source modules with a zero origin and strip synthetic review nets.
  const lib=path.join(out,'keyboard-design.pretty'); fs.mkdirSync(lib,{recursive:true});
  const { parameters }=require('./lib/sexpr');
  for (const name of ['choc','diode_sod123']) {
    const fp=require(`../ergogen/footprints/${name}`);
    const text=fp.body(parameters(fp,{ref:'REF**',anode:'(net 1 "A")',cathode:'(net 2 "K")'}))
      .replace(`"keyboard-design:${name}"`,JSON.stringify(name))
      .replace(/\(layer "([FB]\.Cu)"\)/, '(version 20240108) (generator "keyboard_design") (layer "$1")')
      .replace(/\(at 0 0 0\)\n/,'')
      .replace(/ \(net \d+ "[^"]*"\)/g,'');
    write(path.join(lib,`${name}.kicad_mod`),text+'\n');
  }
  write(path.join(out,'fp-lib-table'),'(fp_lib_table\n  (lib (name "keyboard-design") (type "KiCad") (uri "${KIPRJMOD}/keyboard-design.pretty") (options "") (descr "Generated local matrix footprints"))\n)\n');
  console.log(`keyboard: ${keys.length} Choc keys, ${model.electrical.directed_pairs} directed pairs, five scan nets; schematic/PCB agree; unrouted`);
  return model;
}

if (require.main===module) build(process.argv.includes('--check')).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={build};
