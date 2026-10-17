'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const vm=require('node:vm');
const {parseHTML}=require('linkedom');
const {createServer}=require('../scripts/serve-ergogen');
const {parse,children,child}=require('../scripts/lib/sexpr');
const root=path.resolve(__dirname,'..');
let server,base,config;
before(async()=>{
  config=await fs.readFile(path.join(root,'ergogen/config.yaml'),'utf8');
  server=createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
const post=(value,options={})=>fetch(base+'/api/generate',{
  method:'POST',headers:{'Content-Type':'application/json',...options.headers},body:JSON.stringify({config:value}),
});

test('local editor serves its assets and the actual project YAML',async()=>{
  for(const route of ['/','/app.js','/style.css']) {
    const r=await fetch(base+route);assert.equal(r.status,200);
    assert.match(r.headers.get('content-security-policy'),/default-src 'self'/);
    assert.equal(r.headers.get('cache-control'),'no-store');
    assert((await r.text()).length>100);
  }
  const r=await fetch(base+'/api/project'),project=await r.json();
  assert.equal(project.config,config);assert.equal(project.version,'4.2.1');
  assert(project.footprints.includes('choc'));assert.equal(project.thicknessMm,1.2);
});
test('real Ergogen generation includes custom Choc flex cuts, five-net pads and exports, without writing source',async()=>{
  const fpPath=path.join(root,'ergogen/footprints/choc.js');
  const before=await fs.readFile(fpPath,'utf8');
  const r=await post(config);assert.equal(r.status,200);
  const result=await r.json();
  assert.equal(result.ok,true);assert.equal(result.status,'preview-only');
  assert.equal(result.points.length,20);
  assert.equal(new Set(result.points.map(p=>`${p.sense}>${p.sink}`)).size,20);
  assert.equal(result.pcbs.length,1);
  assert.equal(result.pcbs[0].name,'choc5x4_panel');
  assert.equal(result.pcbs[0].footprints,106);assert.equal(result.pcbs[0].drills,160);
  assert.equal(result.pcbs[0].thicknessMm,1.2);
  assert.equal(result.pcbs[0].widthMm,98.2);assert.equal(result.pcbs[0].heightMm,99.475);
  for(const id of ['points','points-dxf','outline:half','outline-dxf:half','pcb:choc5x4_panel','pcb-svg:choc5x4_panel','points-json']) assert(result.assets.some(a=>a.id===id));
  const pcb=result.assets.find(a=>a.id==='pcb:choc5x4_panel');
  assert.match(pcb.svg,/A /);assert.match(pcb.svg,/#2563eb/);assert.match(pcb.svg,/SW20/);
  const switches=children(parse(pcb.content),'footprint').filter(f=>f[1]==='keyboard-design:choc');
  assert.equal(switches.length,20);
  for(const sw of switches) {
    const pads=children(sw,'pad');
    assert.equal(pads.filter(p=>p[2]==='np_thru_hole').length,3);
    const support=pads.find(p=>p[2]==='thru_hole'&&!p[1]);
    assert(!child(support,'net'));assert.deepEqual(child(support,'layers').slice(1),['B.Cu','B.Mask']);
  }
  assert.equal(await fs.readFile(fpPath,'utf8'),before);
  assert.equal(await fs.readFile(path.join(root,'ergogen/config.yaml'),'utf8'),config);
});
test('draft changes generate fresh geometry but never save the project file',async()=>{
  const r=await post(config.replace('pitch: 19.05','pitch: 20'));
  assert.equal(r.status,200);const result=await r.json();
  assert.equal(result.pcbs[0].widthMm,102.95);
  assert.equal(result.pcbs[0].heightMm,102.8);
  assert.equal(await fs.readFile(path.join(root,'ergogen/config.yaml'),'utf8'),config);
});
test('bad YAML and unsupported JS return errors; a later valid preview still works',async()=>{
  for(const input of ['points: [', 'return { points: {} };', config.replace('what: choc','what: missing_footprint')]) {
    const r=await post(input);assert.equal(r.status,422);
    const result=await r.json();assert.equal(result.ok,false);assert(result.error.length>0);
  }
  const r=await post(config);assert.equal(r.status,200);assert.equal((await r.json()).points.length,20);
});
test('local API rejects wrong methods, origins, content types, oversized input and private file paths',async()=>{
  assert.equal((await fetch(base+'/api/generate')).status,405);
  assert.equal((await post(config,{headers:{Origin:'https://example.com'}})).status,403);
  assert.equal((await post(config,{headers:{'Content-Type':'text/plain'}})).status,415);
  assert.equal((await post(' '.repeat(270000))).status,413);
  assert.equal((await post('')).status,400);
  for(const route of ['/.git/config','/package.json','/checked/../../AGENTS.md','/api/save']) assert.equal((await fetch(base+route)).status,404);
  const response=await new Promise((resolve,reject)=>{
    const req=http.get(base+'/',{headers:{Host:'other.example'}},resolve);req.on('error',reject);
  });
  assert.equal(response.statusCode,403);response.resume();
});

test('editor interactions generate drafts, recover from errors, export the matching output and control zoom (DOM, no browser)',async()=>{
  const html=await fs.readFile(path.join(root,'web/index.html'),'utf8');
  const script=await fs.readFile(path.join(root,'web/app.js'),'utf8');
  const {window}=parseHTML(html), document=window.document;
  const $=id=>document.getElementById(id);
  // LinkeDOM provides the DOM, not browser form state; supply its missing
  // standard select-value setter and default checkbox state for this harness.
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{
    configurable:true,
    get(){return this.querySelector('option[selected]')?.value||this.options[0]?.value||'';},
    set(value){
      for(const option of this.options) option.removeAttribute('selected');
      [...this.options].find(option=>option.value===value)?.setAttribute('selected','');
    },
  });
  $('auto-preview').checked=true;
  const downloads=[],timers=new Set();
  window.HTMLAnchorElement.prototype.click=function(){downloads.push({href:this.href,name:this.download});};
  const context=vm.createContext({document,window:{confirm:()=>true},Blob,URL,AbortController,
    fetch:(url,options)=>fetch(url.startsWith('/')?base+url:url,options),
    setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);timers.add(t);return t;},
    clearTimeout:t=>{clearTimeout(t);timers.delete(t);},
  });
  const waitFor=async(predicate,label)=>{
    const deadline=Date.now()+5000;
    while(!predicate()) {
      if(Date.now()>deadline) throw new Error(`${label}: ${$('status').textContent}; ${$('error-message').textContent}`);
      await new Promise(resolve=>setTimeout(resolve,15));
    }
  };
  try {
    vm.runInContext(script,context,{filename:'web/app.js'});
    await waitFor(()=>$('status').dataset.state==='ready','initial preview');
    assert.equal($('config').value,config);
    assert.equal($('key-count').textContent,'20');assert.equal($('point-rows').children.length,20);
    assert.equal($('view-select').value,'pcb:choc5x4_panel');
    assert.equal($('preview-image').hidden,false);assert.equal($('download-output').disabled,false);
    $('zoom-in').click();assert.equal($('zoom-level').textContent,'125%');
    $('fit-view').click();assert.equal($('zoom-level').textContent,'100%');
    $('view-select').value='points';$('view-select').dispatchEvent(new window.Event('change'));
    assert.equal($('preview-image').alt,'Key positions');
    $('auto-preview').checked=false;
    $('config').value=config.replace('pitch: 19.05','pitch: 20');
    $('config').dispatchEvent(new window.Event('input'));
    assert.equal($('status').dataset.state,'stale');assert.equal($('download-output').disabled,true);
    assert.equal($('stale-note').hidden,false);
    $('generate').click();await waitFor(()=>$('status').dataset.state==='ready','edited preview');
    assert.equal($('pcb-size').textContent,'102.95 × 102.80 mm');
    $('download-select').value='pcb:choc5x4_panel';$('download-output').click();
    assert.equal(downloads.at(-1).name,'choc5x4_panel.kicad_pcb');
    assert.match(await (await fetch(downloads.at(-1).href)).text(),/\(thickness 1\.2\)/);
    $('download-config').click();assert.equal(downloads.at(-1).name,'config.yaml');
    assert.equal(await (await fetch(downloads.at(-1).href)).text(),$('config').value);
    $('config').value='points: [';$('config').dispatchEvent(new window.Event('input'));$('generate').click();
    await waitFor(()=>$('status').dataset.state==='error','bad YAML error');
    assert.equal($('error-panel').hidden,false);assert.equal($('download-output').disabled,true);
    assert.equal($('stale-note').hidden,false);
    $('config').value=config;$('config').dispatchEvent(new window.Event('input'));$('generate').click();
    await waitFor(()=>$('status').dataset.state==='ready','error recovery');
    assert.equal($('error-panel').hidden,true);assert.equal($('stale-note').hidden,true);
    assert.equal($('pcb-size').textContent,'98.20 × 99.47 mm');
  } finally {
    for(const timer of timers) clearTimeout(timer);
    for(const image of [document.getElementById('preview-image').src,...downloads.map(d=>d.href)]) if(image?.startsWith('blob:')) URL.revokeObjectURL(image);
  }
});
