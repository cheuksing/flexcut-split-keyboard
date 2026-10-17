'use strict';
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {Worker}=require('node:worker_threads');
const root=path.resolve(__dirname,'..');
const publicDir=path.join(root,'web');
const MAX_INPUT=256*1024;
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.svg':'image/svg+xml','.png':'image/png','.csv':'text/csv; charset=utf-8','.kicad_pcb':'text/plain; charset=utf-8','.kicad_sch':'text/plain; charset=utf-8'};
const pages=new Map([['/','index.html'],['/app.js','app.js'],['/style.css','style.css']]);
const checkedFiles=new Set(['index.html','layout.svg','matrix.svg','supports.svg','key-detail.svg','layout.png','matrix.png','supports.png','key-detail.png','panel-fit.svg','panel-fit.png','adapter.svg','adapter.png',
  'adapter.kicad_sch','choc5x4_panel.kicad_pcb',
  'choc5x4_half.kicad_sch','matrix.csv']);
const footprintFiles=new Set(['index.html','ks33.svg','choc.svg','mx.svg','footprints.svg','choc-3x3.svg',
  'SwitchFlex.pretty/ks33.kicad_mod','SwitchFlex.pretty/choc.kicad_mod','SwitchFlex.pretty/mx.kicad_mod']);
function fail(status,message) {return Object.assign(new Error(message),{status});}
function generate(config,signal) {
  return new Promise((resolve,reject)=>{
    const worker=new Worker(path.join(__dirname,'ergogen-preview-worker.js'),{
      workerData:{config},resourceLimits:{maxOldGenerationSizeMb:192},execArgv:[],
    });
    let finished=false;
    const finish=(error,result)=>{
      if(finished) return; finished=true; clearTimeout(timer); signal?.removeEventListener('abort',abort);
      worker.terminate(); error?reject(error):resolve(result);
    };
    const abort=()=>finish(fail(499,'Preview cancelled.'));
    const timer=setTimeout(()=>finish(fail(422,'Generation exceeded 15 seconds. Reduce the configuration and try again.')),15000);
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted) abort();
    worker.once('message',result=>finish(null,result));
    worker.once('error',error=>finish(fail(422,error.message)));
    worker.once('exit',code=>{if(!finished) finish(fail(422,`Generator stopped (${code}).`));});
  });
}
async function readBody(req) {
  const chunks=[]; let length=0;
  for await(const chunk of req.iterator({destroyOnReturn:false})) {
    length+=chunk.length;
    if(length>MAX_INPUT) throw fail(413,'Configuration is too large (256 KiB maximum).');
    chunks.push(chunk);
  }
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fail(400,'Expected a JSON request.');}
}
function createServer() {
  let active=0;
  return http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const send=(status,value,type='application/json; charset=utf-8')=>{
      if(res.destroyed) return;
      res.writeHead(status,{'Content-Type':type}); res.end(type.startsWith('application/json')?JSON.stringify(value):value);
    };
    try {
      const port=req.socket.localPort;
      const hosts=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
      if(!hosts.has(req.headers.host)) throw fail(403,'Use the local preview URL printed in the terminal.');
      const url=new URL(req.url,`http://${req.headers.host}`);
      if(req.method==='GET' && url.pathname==='/api/project') {
        const config=await fs.readFile(path.join(root,'ergogen/config.yaml'),'utf8');
        return send(200,{config,filename:'ergogen/config.yaml',version:require('ergogen').version,
          footprints:['choc','diode_sod523','ks33','mx'],thicknessMm:1.2});
      }
      if(url.pathname==='/api/generate') {
        if(req.method!=='POST') {res.setHeader('Allow','POST');throw fail(405,'Use POST to generate a preview.');}
        if(req.headers.origin && ![...hosts].some(host=>req.headers.origin===`http://${host}`)) throw fail(403,'Only the local editor can generate previews.');
        if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')) throw fail(415,'Send application/json.');
        if(Number(req.headers['content-length'])>MAX_INPUT) throw fail(413,'Configuration is too large (256 KiB maximum).');
        const body=await readBody(req);
        if(typeof body.config!=='string' || !body.config.trim()) throw fail(400,'Provide a nonempty YAML configuration.');
        if(active>=2) throw fail(429,'Two previews are already running. Please try again shortly.');
        const controller=new AbortController();
        const cancel=()=>{if(!res.writableEnded) controller.abort();}; res.once('close',cancel);
        active++;
        try {
          const result=await generate(body.config,controller.signal);
          return send(result.ok?200:422,result);
        } finally {active--;res.removeListener('close',cancel);}
      }
      if(req.method!=='GET' && req.method!=='HEAD') throw fail(405,'Method not supported.');
      let filename;
      if(pages.has(url.pathname)) filename=path.join(publicDir,pages.get(url.pathname));
      if(url.pathname==='/checked/' || url.pathname.startsWith('/checked/')) {
        const name=url.pathname.slice('/checked/'.length)||'index.html';
        if(checkedFiles.has(name)) filename=path.join(root,'build/keyboard',name);
      }
      if(url.pathname.startsWith('/review/')) {
        const name=url.pathname.slice('/review/'.length);
        if(footprintFiles.has(name)) filename=path.join(root,'build/review',name);
      }
      if(/^\/ergogen\/footprints\/(choc|diode_sod523|ks33|mx)\.js$/.test(url.pathname)) {
        filename=path.join(root,url.pathname.slice(1));
        res.setHeader('Content-Disposition','attachment');
      }
      if(!filename) throw fail(404,'Not found.');
      let data;
      try{data=await fs.readFile(filename);}catch(error){if(error.code==='ENOENT') throw fail(404,'File not available. Run npm run review to generate checked review files.');throw error;}
      if(filename.startsWith(path.join(root,'build')) && path.extname(filename)==='.html') {
        // Existing trusted review pages contain their own inline styles and
        // footprint-view controls. Draft SVGs are rendered as images instead.
        res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
      }
      res.writeHead(200,{'Content-Type':MIME[path.extname(filename)]||'application/octet-stream'});
      res.end(req.method==='HEAD'?undefined:data);
    } catch(error) {if(!req.complete) req.resume();send(error.status||500,{error:error.status?error.message:'The preview server encountered an error.'});}
  });
}
if(require.main===module) {
  const port=Number(process.env.PORT||8787);
  if(!Number.isInteger(port)||port<1||port>65535) {console.error('PORT must be between 1 and 65535.');process.exit(1);}
  const server=createServer();
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is busy. Choose another port: PORT=8788 npm run dev`:error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`Ergogen editor: http://127.0.0.1:${port}\nLocal preview only; drafts do not change project files. Ctrl+C to stop.`));
}
module.exports={createServer,generate};
