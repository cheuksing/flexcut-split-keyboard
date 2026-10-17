'use strict';

// Pin coordinates are component-side views. Bottom-side SMDs are mirrored in
// emit(), rather than silently reusing a top land pattern on the other face.
const spec=require('./interface-spec.json');
const n=v=>Number(v.toFixed(5)), q=s=>JSON.stringify(String(s));
const pad=(number,x,y,w,h,type='smd',drill=null)=>({number:String(number),at:[x,y],size:[w,h],type,drill,shape:type==='smd'?'rect':'circle'});
const packages={
  r0603:{side:'B',body:[1.6,.8],courtyard:[3.2,1.8],pads:[pad(1,-.825,0,.8,.95),pad(2,.825,0,.8,.95)]},
  r0402:{side:'B',body:[1,.5],courtyard:[2,1.2],pads:[pad(1,-.48,0,.54,.64),pad(2,.48,0,.54,.64)]},
  usb4115:{side:'B',body:[8.94,3.16],courtyard:[10.5,5.6],pads:[
    ...Array.from({length:12},(_,i)=>pad(`A${i+1}`,-2.75+i*.5,-.83,.3,.85)),
    ...Array.from({length:12},(_,i)=>pad(`B${12-i}`,-2.75+i*.5,.83,.3,.85)),
    ...[[-2.4,-2.15],[2.4,-2.15],[-2.4,2.15],[2.4,2.15]].map(([x,y],i)=>pad(`S${i+1}`,x,y,1.2,1.2,'thru_hole',[.7])),
    pad('',-3.75,0,.7,.7,'np_thru_hole',[.7]),pad('',3.75,0,.7,.7,'np_thru_hole',[.7])]},
  xiao12:{side:'F',body:[17.8,21],courtyard:[18.4,21.6],pads:[
    ...Array.from({length:6},(_,i)=>pad(i+2,-7.62,-5.08+i*2.54,1.7,1.7,'thru_hole',[1])),
    ...Array.from({length:6},(_,i)=>pad(13-i,7.62,-5.08+i*2.54,1.7,1.7,'thru_hole',[1]))]},
  sod523:{side:'B',body:[1.2,.8],courtyard:[2.35,1.3],pads:[pad(1,-.74,0,.67,.4),pad(2,.74,0,.67,.4)]},
};

function portPins(lines,shell) {
  const pins={}; for(const pair of spec.selected_pairs) for(const pin of pair) pins[pin]=lines[spec.selected_pairs.indexOf(pair)];
  for(const pin of spec.nc) pins[pin]=null;
  for(let i=1;i<=4;i++) pins['S'+i]=shell;
  return pins;
}
function addPort(parts,component,lines,shell,prefix,positions) {
  const pins=portPins(lines,shell);
  let index=0;
  for(let i=0;i<spec.selected_pairs.length;i++)for(const contact of spec.selected_pairs[i]) {
    const raw=prefix+'_'+contact;
    pins[contact]=raw;
    const [x,y,rotation=90]=positions[index];
    parts.push({ref:'RC'+prefix+(index+1),kind:'r0402',value:'1k contact isolation',rotation,at:[x,y],pins:{1:raw,2:lines[i]}});
    index++;
  }
  parts.push({...component,pins});
}
const half=[];
addPort(half,{ref:'JH1',kind:'usb4115',value:'USB4115-03-C / GPIO ONLY',at:[60,47.3]},
  Array.from({length:5},(_,i)=>'HC'+i),'SHIELD_H','H',
  [66.6,69].flatMap(px=>[44.15,45.5,46.85,48.2,49.55].map(y=>[px,y,0])));
for(let i=0;i<5;i++) {
  half.push({ref:'RH'+(i+1),kind:'r0603',value:'1k',at:[53.2+i*3.4,51.1],pins:{1:'HC'+i,2:'P'+i}});
  half.push({ref:'EH'+(i+1),kind:'sod523',value:'TPD1E05U06DYA',at:[52,44.2+i*1.3],pins:{1:'HC'+i,2:'SHIELD_H'}});
}
const xiaoPins={};
for(let pin=2;pin<=11;pin++) xiaoPins[pin]=(pin<=6?'L':'R')+'_M'+(pin<=6?pin-2:pin-7);
xiaoPins[12]=null;xiaoPins[13]='GND_A';
const adapter=[{ref:'U1',kind:'xiao12',value:'XIAO SAMD21 / mount after depanel',at:[98.1,133.4],pins:xiaoPins}];
for(const [bank,x] of [['L',81.5],['R',114.7]]) {
  const coords=[72.5,74.9].flatMap(px=>[134.4,135.8,137.2,138.6,140].map(y=>[px,y,0]));
  addPort(adapter,{ref:'J'+bank,kind:'usb4115',value:'USB4115-03-C / GPIO ONLY',at:[x,136.5]},
    spec.adapter_logical_order_by_connector_group.map(i=>bank+'_C'+i),'GND_A',bank,
    coords.map(([px,y,r])=>[bank==='L'?px:196.2-px,y,r]));
  for(let i=0;i<5;i++) {
    const px=bank==='L'?70.5+i*3.5:125.7-i*3.5;
    adapter.push({ref:'RA'+bank+(i+1),kind:'r0603',value:'1k',at:[px,141.7],pins:{1:bank+'_M'+i,2:bank+'_C'+i}});
    adapter.push({ref:'EA'+bank+(i+1),kind:'sod523',value:'TPD1E05U06DYA',at:[bank==='L'?70.1:126.1,134.4+i*1.4],pins:{1:bank+'_C'+i,2:'GND_A'}});
  }
}

function emit(component,offset,net) {
  const def=packages[component.kind],side=component.side||def.side;
  const [x,y]=component.at.map((v,i)=>n(v+offset[i]));
  const rotated=component.rotation===90;
  const [cw,ch]=rotated?[...def.courtyard].reverse():def.courtyard,[bw,bh]=rotated?[...def.body].reverse():def.body;
  let out=`(footprint ${q('keyboard-design:'+component.kind)} (layer "${side}.Cu") (at ${x} ${y})
    (attr ${component.kind==='xiao12'?'through_hole':'smd'})
    (fp_text reference ${q(component.ref)} (at 0 ${n(-ch/2-.8)}) (layer "${side}.SilkS") (effects (font (size 0.65 0.65))${side==='B'?' (justify mirror)':''}))
    (fp_text value ${q(component.value)} (at 0 0) (layer "${side}.Fab") (effects (font (size 0.5 0.5)) hide))
    (fp_rect (start ${-cw/2} ${-ch/2}) (end ${cw/2} ${ch/2}) (stroke (width 0.05) (type default)) (fill none) (layer "${side}.CrtYd"))
    (fp_rect (start ${-bw/2} ${-bh/2}) (end ${bw/2} ${bh/2}) (stroke (width 0.1) (type default)) (fill none) (layer "${side}.Fab"))`;
  if(component.kind==='usb4115')out+=`\n(fp_text user "GPIO ONLY" (at 0 3.6) (layer "${side}.SilkS") (effects (font (size 0.65 0.65))${side==='B'?' (justify mirror)':''}))`;
  for(const p of def.pads) {
    let px=side==='B'?-p.at[0]:p.at[0],py=p.at[1];
    if(rotated) [px,py]=[-py,px];
    const dims=rotated?[...p.size].reverse():p.size;
    const layers=p.type==='smd'?`"${side}.Cu" "${side}.Paste" "${side}.Mask"`:p.type==='thru_hole'?'"*.Cu" "*.Mask"':'"*.Cu" "*.Mask"';
    const drill=p.drill?`(drill ${p.drill.join(' ')})`:'';
    const name=component.pins[p.number];
    out+=`\n(pad ${q(p.number)} ${p.type} ${p.shape} (at ${n(px)} ${n(py)}) (size ${dims.join(' ')}) ${drill} (layers ${layers}) ${name?net(name):''})`;
  }
  return out+'\n)';
}
function macro(parts,designator) {
  const nets=[...new Set(parts.flatMap(p=>Object.values(p.pins)).filter(Boolean))];
  return {params:{designator,...Object.fromEntries(nets.map((name,i)=>['n'+i,{type:'net',value:name}]))},
    body:p=>{
      if(Math.abs(p.r||0)>1e-8) throw new Error('Interface macros require zero rotation');
      const map=Object.fromEntries(nets.map((name,i)=>[name,p['n'+i]]));
      return parts.map(c=>emit(c,[p.x-98.1,p.y-112],name=>String(map[name]))).join('\n');
    }};
}
function bites() {
  const rules=require('./manufacturing-rules.json').keyboard;
  return {params:{designator:'MB'},body:p=>[-18.1,18.1].map((dx,index)=>`(footprint "keyboard-design:mouse_bites" (layer "F.Cu") (at ${n(p.x+dx)} ${n(p.y+20.2)})
    (attr board_only exclude_from_pos_files exclude_from_bom)
    (fp_text reference "MB${index+1}" (at 0 0) (layer "F.Fab") (effects (font (size 0.5 0.5)) hide))
    ${Array.from({length:rules.mouse_bite_holes_per_tab},(_,i)=>`(pad "" np_thru_hole circle (at ${n((i-2)*rules.mouse_bite_hole_pitch_mm)} 0) (size ${rules.mouse_bite_hole_diameter_mm} ${rules.mouse_bite_hole_diameter_mm}) (drill ${rules.mouse_bite_hole_diameter_mm}) (layers "*.Cu" "*.Mask"))`).join('\n')})`).join('\n')};
}
module.exports={packages,half,adapter,portPins,emit,halfMacro:()=>macro(half,'IFH'),adapterMacro:()=>macro(adapter,'IFA'),bites};
