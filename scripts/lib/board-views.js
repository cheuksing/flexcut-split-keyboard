'use strict';

// The panel is the only generated PCB. These temporary views retain its exact
// footprint expressions and net IDs, replacing only its depanelled perimeter.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {parse,child,children}=require('./sexpr');
const hardware=require('./interface-hardware');

function rootForms(text) {
  parse(text);
  const forms=[];let depth=0,start=0,quoted=false,escaped=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted) {
      if(escaped)escaped=false;
      else if(c==='\\')escaped=true;
      else if(c==='"')quoted=false;
      continue;
    }
    if(c==='"'){quoted=true;continue;}
    if(c==='('){if(depth===1)start=i;depth++;}
    else if(c===')'){depth--;if(depth===1)forms.push(text.slice(start,i+1));}
  }
  return forms.map(raw=>({raw,node:parse(raw)}));
}

function deriveBoardViews(panel, outlines) {
  const forms=rootForms(panel),half=[],adapter=[],refs=new Set();
  const halfRefs=new Set(hardware.half.map(p=>p.ref));
  const adapterRefs=new Set(hardware.adapter.map(p=>p.ref));
  for(const {raw,node} of forms) {
    assert(!['segment','via','zone'].includes(node[0]),
      'Derived board views require an unrouted panel; routed copper needs explicit depanel extraction');
    if(node[0]!=='footprint')continue;
    const ref=children(node,'fp_text').find(t=>t[1]==='reference')?.[2];
    assert(ref&&!refs.has(ref),'Missing or duplicate panel reference: '+ref);refs.add(ref);
    if(node[1]==='keyboard-design:mouse_bites')continue;
    if(['keyboard-design:choc','keyboard-design:diode_sod523'].includes(node[1])||halfRefs.has(ref))half.push(raw);
    else if(adapterRefs.has(ref))adapter.push(raw);
    else assert.fail('Panel component has no derived board assignment: '+ref);
  }
  const header=forms.filter(({node})=>node[0]!=='footprint'&&
    !(node[0].startsWith('gr_')&&child(node,'layer')?.[1]==='Edge.Cuts')).map(f=>f.raw);
  const view=(name,footprints)=>{
    assert(outlines[name],`Missing derived ${name} perimeter`);
    return '(kicad_pcb\n'+[...header,...footprints,outlines[name]].join('\n')+'\n)\n';
  };
  return {half:view('half',half),adapter:view('adapter',adapter),panel};
}

function readBoardViews(directory) {
  return deriveBoardViews(fs.readFileSync(path.join(directory,'choc5x4_panel.kicad_pcb'),'utf8'),
    JSON.parse(fs.readFileSync(path.join(directory,'board-outlines.json'),'utf8')));
}

module.exports={deriveBoardViews,readBoardViews};
