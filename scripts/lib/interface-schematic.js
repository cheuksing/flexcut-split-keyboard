'use strict';

const {uuid}=require('./keyboard-schematic');
const q=s=>JSON.stringify(String(s)),n=x=>Number(x.toFixed(5));
const font='(effects (font (size 0.8 0.8)))';
function endOf(text,start) {
  let depth=0,quoted=false,escaped=false;
  for(let i=start;i<text.length;i++) {
    const c=text[i];
    if(quoted) {if(escaped) escaped=false;else if(c==='\\') escaped=true;else if(c==='"')quoted=false;}
    else if(c==='"')quoted=true;
    else if(c==='(')depth++;
    else if(c===')' && --depth===0)return i;
  }
  throw new Error('Unclosed schematic expression');
}
function appendInterface(base,parts,project,root,startY=285) {
  const libs=[],items=[];
  const columns=project==='adapter'?7:6,spacing=project==='adapter'?78:92;
  let rowY=startY,rowHeight=0;
  parts.forEach((part,index)=>{
    if(index%columns===0 && index) {rowY+=rowHeight;rowHeight=0;}
    const pins=Object.entries(part.pins),count=Math.ceil(pins.length/2),height=(count-1)*2.54;
    rowHeight=Math.max(rowHeight,height+18);
    const x=40+(index%columns)*spacing,y=rowY;
    if(y+height>410)throw new Error('Interface schematic exceeds A2 sheet');
    const id=`Interface:${part.ref}`,libId='Interface_'+part.ref;
    const pinLayout=pins.map(([number,net],i)=>({number,net,x:i<count?-15.24:15.24,y:-(i%count)*2.54,angle:i<count?0:180}));
    libs.push(`(symbol ${q(id)} (pin_names (offset 0.3)) (in_bom yes) (on_board yes)
      (property "Reference" ${q(part.ref)} (at 0 3.81 0) ${font})
      (property "Value" ${q(part.value)} (at 0 -${n(height+3.81)} 0) ${font})
      (symbol ${q(libId+'_0_1')} (rectangle (start -12.7 1.27) (end 12.7 -${n(height+1.27)}) (stroke (width 0.15) (type default)) (fill (type none))))
      (symbol ${q(libId+'_1_1')} ${pinLayout.map(p=>`(pin passive line (at ${p.x} ${n(p.y)} ${p.angle}) (length 2.54) (name ${q(p.number)} ${font}) (number ${q(p.number)} ${font}))`).join('\n')}))`);
    items.push(`(symbol (lib_id ${q(id)}) (at ${x} ${y} 0) (unit 1) (in_bom yes) (on_board yes) (dnp no) (uuid ${uuid(part.ref)})
      (property "Reference" ${q(part.ref)} (at ${x} ${y-5.08} 0) ${font})
      (property "Value" ${q(part.value)} (at ${x} ${n(y+height+4)} 0) ${font})
      (property "Footprint" ${q('keyboard-design:'+part.kind)} (at ${x} ${y} 0) ${font.slice(0,-1)} hide))
      ${pins.map(([number])=>`(pin ${q(number)} (uuid ${uuid(part.ref+'.'+number)}))`).join('\n')}
      (instances (project ${q(project)} (path "/${root}" (reference ${q(part.ref)}) (unit 1)))))`);
    for(const p of pinLayout) {
      const px=n(x+p.x),py=n(y-p.y),edge=n(px+(p.x<0?-5.08:5.08)),tag=part.ref+'.'+p.number;
      if(!p.net)items.push(`(no_connect (at ${px} ${py}) (uuid ${uuid(tag+'.nc')}))`);
      else items.push(`(wire (pts (xy ${px} ${py}) (xy ${edge} ${py})) (stroke (width 0) (type default)) (uuid ${uuid(tag+'.wire')}))
        (label ${q(p.net)} (at ${edge} ${py} 0) ${font} (uuid ${uuid(tag+'.label')}))`);
    }
  });
  const libStart=base.indexOf('(lib_symbols'),libEnd=endOf(base,libStart);
  base=base.slice(0,libEnd)+'\n'+libs.join('\n')+'\n'+base.slice(libEnd);
  return base.slice(0,base.lastIndexOf(')'))+'\n'+items.join('\n')+'\n)\n';
}
function adapterSchematic(parts) {
  const root=uuid('adapter_root');
  return appendInterface(`(kicad_sch (version 20231120) (generator "keyboard-design") (uuid ${root}) (paper "A2")
    (title_block (title "XIAO SAMD21 adapter - UNROUTED ENGINEERING REVIEW") (rev "0.3.0")
      (comment 1 "NOT FOR FABRICATION - scan margins and GPIO fault protection unresolved"))
    (lib_symbols))`,parts,'adapter',root,20);
}
module.exports={appendInterface,adapterSchematic};
