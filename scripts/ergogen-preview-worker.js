'use strict';
const {parentPort, workerData}=require('node:worker_threads');
const yaml=require('js-yaml');
const {configure}=require('./lib/ergogen-engine');
const {pcbPreview}=require('./lib/pcb-preview');

(async()=>{
  const logs=[];
  try {
    // Parse YAML explicitly: never invoke Ergogen's JS-config fallback on web input.
    const config=yaml.safeLoad(workerData.config);
    if(!config || typeof config!=='object' || Array.isArray(config)) throw new Error('Configuration must be a YAML mapping.');
    const engine=configure();
    const result=await engine.process(config,{debug:true,svg:true},s=>{if(logs.length<200) logs.push(String(s));});
    const assets=[], pcbs=[];
    const add=(id,label,filename,type,content,svg=null)=>assets.push({id,label,filename,type,content,svg});
    if(result.demo?.svg) add('points','Key positions','points.svg','image/svg+xml',result.demo.svg,result.demo.svg);
    if(result.demo?.dxf) add('points-dxf','Key positions · DXF','points.dxf','application/dxf',result.demo.dxf);
    for(const [name,outline] of Object.entries(result.outlines)) {
      if(outline.svg) add('outline:'+name,`Outline · ${name}`,name+'.svg','image/svg+xml',outline.svg,outline.svg);
      if(outline.dxf) add('outline-dxf:'+name,`Outline · ${name} · DXF`,name+'.dxf','application/dxf',outline.dxf);
    }
    for(const [name,text] of Object.entries(result.pcbs)) {
      const preview=pcbPreview(text); pcbs.push({name,...preview,svg:undefined});
      add('pcb:'+name,`PCB · ${name}`,name+'.kicad_pcb','text/plain',text,preview.svg);
      add('pcb-svg:'+name,`PCB · ${name} · SVG`,name+'-preview.svg','image/svg+xml',preview.svg);
    }
    const points=Object.entries(result.points||{}).map(([name,p])=>({name,x:p.x,y:p.y,rotation:p.r,
      sense:p.meta.scan_from||'',sink:p.meta.scan_to||''}));
    add('points-json','Key positions · JSON','points.json','application/json',JSON.stringify(points,null,2));
    for(const [name,c] of Object.entries(result.cases)) if(c.jscad) add('case:'+name,`Case · ${name}`,name+'.jscad','text/plain',c.jscad);
    parentPort.postMessage({ok:true,version:engine.version,points,pcbs,assets,logs,status:'preview-only'});
  } catch(error) {parentPort.postMessage({ok:false,error:error.message,logs});}
})().catch(error=>parentPort.postMessage({ok:false,error:error.message,logs:[]}));
