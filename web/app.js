'use strict';
const $=id=>document.getElementById(id);
const config=$('config'), generateButton=$('generate'), viewSelect=$('view-select'), downloadSelect=$('download-select');
let projectConfig='', result=null, dirty=true, revision=0, request=null, timer=null, imageURL=null;
let zoom=1, panX=0, panY=0, drag=null;
function status(message,state) {$('status').textContent=message;$('status').dataset.state=state;}
function option(asset) {const element=document.createElement('option');element.textContent=asset.label;element.value=asset.id;return element;}
function updateEditor() {
  $('line-count').textContent=`${config.value.split('\n').length} lines`;
  $('download-config').disabled=!config.value.trim();
}
function markChanged() {
  revision++;dirty=true;updateEditor();
  $('stale-note').hidden=!result;$('download-output').disabled=true;
  status('Draft changed','stale');
  clearTimeout(timer);
  // Cancel obsolete work immediately; a failed or old response must never
  // relabel a newer draft as the successfully generated configuration.
  request?.abort();request=null;generateButton.disabled=false;
  if($('auto-preview').checked) timer=setTimeout(generate,650);
}
function transform() {
  $('preview-image').style.transform=`translate(${panX}px, ${panY}px) scale(${zoom})`;
  $('zoom-level').textContent=`${Math.round(zoom*100)}%`;
}
function fit() {zoom=1;panX=0;panY=0;transform();}
function setZoom(value) {zoom=Math.min(8,Math.max(.25,value));transform();}
function selectPreview() {
  if(!result) return;
  const asset=result.assets.find(a=>a.id===viewSelect.value);
  if(!asset?.svg) return;
  const next=URL.createObjectURL(new Blob([asset.svg],{type:'image/svg+xml'}));
  $('preview-image').src=next;$('preview-image').alt=asset.label;
  $('preview-image').hidden=false;$('empty-preview').hidden=true;
  if(imageURL) URL.revokeObjectURL(imageURL);imageURL=next;
  $('preview-caption').textContent=asset.label+' · top view';
  downloadSelect.value=asset.id;fit();
}
function showResult(data) {
  result=data;dirty=false;
  const previous=viewSelect.value;
  viewSelect.replaceChildren(...data.assets.filter(a=>a.svg).map(option));
  downloadSelect.replaceChildren(...data.assets.map(option));
  viewSelect.disabled=false;downloadSelect.disabled=false;
  viewSelect.value=data.assets.some(a=>a.svg&&a.id===previous)?previous:(data.assets.find(a=>a.id.startsWith('pcb:'))?.id||data.assets.find(a=>a.svg)?.id||'');
  $('key-count').textContent=String(data.points.length);
  const board=data.pcbs[0];
  $('pcb-size').textContent=board?`${board.widthMm.toFixed(2)} × ${board.heightMm.toFixed(2)} mm`:'—';
  $('footprint-count').textContent=board?String(board.footprints):'—';
  $('board-thickness').textContent=board?.thicknessMm?`${board.thicknessMm} mm`:'—';
  $('point-rows').replaceChildren(...data.points.map(p=>{
    const row=document.createElement('tr');
    for(const value of [p.name,p.x.toFixed(3),p.y.toFixed(3),`${p.rotation}°`,p.sense&&p.sink?`${p.sense} → ${p.sink}`:'—']) {
      const cell=document.createElement('td');cell.textContent=value;row.append(cell);
    }
    return row;
  }));
  $('stale-note').hidden=true;$('download-output').disabled=!data.assets.length;
  $('generator-log').textContent=data.logs.join('\n')||'Generation complete.';
  selectPreview();status('Preview ready · unverified','ready');
}
async function generate() {
  clearTimeout(timer);request?.abort();
  const controller=new AbortController(), current=revision;request=controller;
  generateButton.disabled=true;status('Generating…','loading');
  $('error-panel').hidden=true;
  try {
    const response=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({config:config.value}),signal:controller.signal});
    const data=await response.json();
    if(controller.signal.aborted || current!==revision) return;
    if(!response.ok || !data.ok) {
      $('generator-log').textContent=(data.logs||[]).join('\n');
      throw new Error(data.error||'Could not generate preview.');
    }
    showResult(data);
  } catch(error) {
    if(error.name==='AbortError' || controller.signal.aborted || current!==revision) return;
    dirty=true;$('download-output').disabled=true;$('stale-note').hidden=!result;
    $('error-panel').hidden=false;$('error-message').textContent=error.message;
    status('Generation error','error');
  } finally {
    if(request===controller) {generateButton.disabled=false;request=null;}
  }
}
async function loadProject(initial=false) {
  if(!initial && config.value!==projectConfig && !window.confirm('Replace this draft with the configuration currently saved in the project?')) return;
  clearTimeout(timer);request?.abort();status('Loading project','loading');
  try {
    const response=await fetch('/api/project');
    if(!response.ok) throw new Error('Could not load the project configuration.');
    const project=await response.json();projectConfig=project.config;config.value=project.config;
    $('engine-version').textContent=`Ergogen ${project.version}`;
    revision++;dirty=true;updateEditor();$('download-output').disabled=true;
    generateButton.disabled=false;await generate();
  } catch(error) {
    $('error-panel').hidden=false;$('error-message').textContent=error.message;
    status('Project unavailable','error');generateButton.disabled=false;
  }
}
function download(filename,content,type) {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a');a.href=url;a.download=filename.replaceAll(/[\\/]/g,'_');
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
config.addEventListener('input',markChanged);
config.addEventListener('keydown',event=>{
  if((event.metaKey||event.ctrlKey)&&event.key==='Enter') {event.preventDefault();generate();}
});
generateButton.addEventListener('click',generate);
$('reload-project').addEventListener('click',()=>loadProject());
$('auto-preview').addEventListener('change',()=>{clearTimeout(timer);if($('auto-preview').checked&&dirty) generate();});
viewSelect.addEventListener('change',selectPreview);
$('download-config').addEventListener('click',()=>download('config.yaml',config.value,'text/yaml'));
$('download-output').addEventListener('click',()=>{
  if(dirty) return;
  const asset=result?.assets.find(a=>a.id===downloadSelect.value);
  if(asset) download(asset.filename,asset.content,asset.type);
});
$('zoom-in').addEventListener('click',()=>setZoom(zoom*1.25));
$('zoom-out').addEventListener('click',()=>setZoom(zoom/1.25));
$('fit-view').addEventListener('click',fit);
const viewport=$('viewport');
viewport.addEventListener('wheel',event=>{event.preventDefault();setZoom(zoom*(event.deltaY<0?1.1:1/1.1));},{passive:false});
viewport.addEventListener('pointerdown',event=>{
  if(event.button!==0) return;
  drag={x:event.clientX-panX,y:event.clientY-panY};viewport.setPointerCapture(event.pointerId);viewport.classList.add('dragging');
});
viewport.addEventListener('pointermove',event=>{if(drag){panX=event.clientX-drag.x;panY=event.clientY-drag.y;transform();}});
function stopDrag(){drag=null;viewport.classList.remove('dragging');}
viewport.addEventListener('pointerup',stopDrag);viewport.addEventListener('pointercancel',stopDrag);viewport.addEventListener('lostpointercapture',stopDrag);
viewport.addEventListener('keydown',event=>{
  if(event.key==='+'||event.key==='='){event.preventDefault();setZoom(zoom*1.25);}
  if(event.key==='-'){event.preventDefault();setZoom(zoom/1.25);}
  if(event.key==='0'){event.preventDefault();fit();}
});
loadProject(true);
