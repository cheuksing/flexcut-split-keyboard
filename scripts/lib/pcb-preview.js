'use strict';

// Review renderer for the emitted KiCad subset, including actual flex arcs,
// pad capsules and mechanical holes. This is not a native KiCad render/DRC.
const {parse, child, children, numbers} = require('./sexpr');
const {circleThrough, samplePrimitive, distance} = require('./geometry');
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const n = v => Number(v.toFixed(5));
const xy = p => p.map(n).join(' ');

function graphics(tree, prefix) {
  return tree.filter(e => [prefix+'line', prefix+'arc'].includes(e[0]) && child(e,'layer')?.[1] === 'Edge.Cuts')
    .map(e => ({type:e[0].slice(prefix.length), start:numbers(e,'start'), end:numbers(e,'end'),
      ...(e[0].endsWith('arc') ? {mid:numbers(e,'mid')} : {})}));
}
function contourPaths(edges) {
  const pending=[...edges], paths=[];
  while(pending.length) {
    const first=pending.shift(); let last=first, d=`M ${xy(first.start)} `;
    for(let count=0;;count++) {
      if(last.type==='line') d+=`L ${xy(last.end)} `;
      else {
        const a=circleThrough(last.start,last.mid,last.end);
        d+=`A ${n(a.radius)} ${n(a.radius)} 0 ${Math.abs(a.sweep)>Math.PI?1:0} ${a.sweep>0?1:0} ${xy(last.end)} `;
      }
      if(distance(last.end,first.start)<.00001) {paths.push(d+'Z');break;}
      const i=pending.findIndex(e=>distance(e.start,last.end)<.00001 || distance(e.end,last.end)<.00001);
      if(i<0) throw new Error('PCB preview found an open Edge.Cuts contour');
      let next=pending.splice(i,1)[0];
      if(distance(next.end,last.end)<.00001) next={...next,start:next.end,end:next.start};
      last=next;
      if(count>100000) throw new Error('PCB preview contour is too large');
    }
  }
  return paths;
}

function pcbPreview(text) {
  const tree=parse(text), outer=graphics(tree,'gr_'), footprints=children(tree,'footprint');
  const bounds=[Infinity,Infinity,-Infinity,-Infinity];
  function include(p) {bounds[0]=Math.min(bounds[0],p[0]);bounds[1]=Math.min(bounds[1],p[1]);bounds[2]=Math.max(bounds[2],p[0]);bounds[3]=Math.max(bounds[3],p[1]);}
  function collect(edges,transform=p=>p) {for(const e of edges) for(const p of samplePrimitive(e,.2)) include(transform(p));}
  collect(outer);
  const transformed=footprints.map(fp=>{
    const [x=0,y=0,r=0]=numbers(fp,'at')||[], angle=-r*Math.PI/180;
    const transform=([a,b])=>[x+a*Math.cos(angle)-b*Math.sin(angle),y+a*Math.sin(angle)+b*Math.cos(angle)];
    const edges=graphics(fp,'fp_'); collect(edges,transform);
    for(const p of children(fp,'pad')) {
      const [px,py]=numbers(p,'at'),[w,h]=numbers(p,'size');
      for(const dx of [-w/2,w/2]) for(const dy of [-h/2,h/2]) include(transform([px+dx,py+dy]));
    }
    return {fp,x,y,r,edges,transform};
  });
  if(!Number.isFinite(bounds[0])) throw new Error('PCB contains no drawable geometry');
  const path=contourPaths(outer).join(' ');
  const [x,y,x2,y2]=bounds, width=x2-x,height=y2-y, pad=3;
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(x-pad)} ${n(y-pad)} ${n(width+2*pad)} ${n(height+2*pad)}" width="${n(width+2*pad)}mm" height="${n(height+2*pad)}mm"><title>Generated PCB preview, top view with bottom copper visible</title>`;
  svg+=`<rect x="${n(x-pad)}" y="${n(y-pad)}" width="${n(width+2*pad)}" height="${n(height+2*pad)}" fill="#edf0f4"/>`;
  if(path) svg+=`<path d="${path}" fill="#cbb77c" fill-rule="evenodd" stroke="#81754d" stroke-width=".08"/>`;
  const rect=(cx,cy,w,h,fill,r=0)=>`<rect x="${n(cx-w/2)}" y="${n(cy-h/2)}" width="${n(w)}" height="${n(h)}" rx="${n(r)}" fill="${fill}"/>`;
  let pads=0, drills=0;
  for(const {fp,x,y,r,edges} of transformed) {
    svg+=`<g transform="translate(${n(x)} ${n(y)}) rotate(${n(-r)})">`;
    for(const d of contourPaths(edges)) svg+=`<path d="${d}" fill="#000"/>`;
    for(const p of children(fp,'pad')) {
      const [px,py]=numbers(p,'at'),[w,h]=numbers(p,'size');
      const layers=child(p,'layers')?.slice(1)||[];
      if(p[2]!=='np_thru_hole') {
        svg+=rect(px,py,w,h,layers.includes('B.Cu')?'#d9252a':'#26775f',p[3]==='rect'?0:Math.min(w,h)/2); pads++;
      }
      const drill=child(p,'drill');
      if(drill) {
        const [dw,dh]=drill[1]==='oval'?drill.slice(2).map(Number):[Number(drill[1]),Number(drill[1])];
        svg+=rect(px,py,dw,dh,'#000',Math.min(dw,dh)/2); drills++;
      }
    }
    for(const guide of children(fp,'fp_rect')) if(['F.Fab','B.Fab'].includes(child(guide,'layer')?.[1])) {
      const [a,b]=numbers(guide,'start'),[c,d]=numbers(guide,'end');
      svg+=`<rect x="${n(a)}" y="${n(b)}" width="${n(c-a)}" height="${n(d-b)}" fill="none" stroke="#1b698a" stroke-width=".1" stroke-dasharray=".6 .4"/>`;
    }
    const ref=children(fp,'fp_text').find(t=>t[1]==='reference')?.[2]||'';
    svg+=`<text x="0" y="3.8" text-anchor="middle" fill="#203846" font-family="sans-serif" font-size="1.4">${esc(ref)}</text></g>`;
  }
  svg+='</svg>';
  return {svg,widthMm:n(width),heightMm:n(height),footprints:footprints.length,pads,drills,
    thicknessMm:numbers(child(tree,'general'),'thickness')?.[0]};
}
module.exports={pcbPreview};
