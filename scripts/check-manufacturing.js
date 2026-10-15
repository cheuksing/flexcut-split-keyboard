'use strict';

// Verify the actual emitted pads and sampled analytic Edge.Cuts, not declared
// nominal artwork dimensions. Python/Shapely performs polygon operations.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const specs = require('./lib/switches');
const { parse, children, numbers, child, primitives, parameters } = require('./lib/sexpr');
const { samplePrimitive, circleThrough, distance } = require('./lib/geometry');
const root = path.resolve(__dirname, '..');

// An interrupted run, stale generated module, or missing geometry dependency
// must not leave an old PASS displayed as though the new design was checked.
require('./invalidate-verification')();

function tangent(edge, end) {
  if (edge.type === 'line') return edge.end.map((v, i) => v - edge.start[i]);
  const arc = circleThrough(edge.start, edge.mid, edge.end);
  const p = end ? edge.end : edge.start, direction = Math.sign(arc.sweep);
  return [-(p[1] - arc.center[1]) * direction, (p[0] - arc.center[0]) * direction];
}

require('./build-footprints').build(true); // Refuse to check stale generated files.
const keyboardBuild = spawnSync(process.execPath, [path.join(__dirname,'build-keyboard.js'),'--check'], {cwd:root,encoding:'utf8'});
if (keyboardBuild.status !== 0) throw new Error(`Stale/invalid keyboard outputs; run npm run check.\n${keyboardBuild.stdout}\n${keyboardBuild.stderr}`);
const {boardModel,schematicNets,verifyElectrical}=require('./lib/keyboard');
const keyboard=boardModel(fs.readFileSync(path.join(root,'build/keyboard/choc5x4_half.kicad_pcb'),'utf8'));
keyboard.keys=JSON.parse(fs.readFileSync(path.join(root,'build/keyboard/keys.json'),'utf8'));
keyboard.electrical=verifyElectrical(keyboard,keyboard.keys,schematicNets(fs.readFileSync(path.join(root,'build/keyboard/choc5x4_half.kicad_sch'),'utf8')));
const models = specs.map(spec => {
  const fp = require(path.join(root, `ergogen/footprints/${spec.id}.js`));
  const tree = parse(fp.body(parameters(fp))), edges = primitives(tree);
  const cuts = [], radii = [], turns = [];
  let current = [];
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i], next = edges[(i + 1) % edges.length];
    if (edge.type === 'arc') radii.push(circleThrough(edge.start, edge.mid, edge.end).radius);
    current.push(...samplePrimitive(edge, 0.004).slice(0, -1));
    if (distance(edge.end, next.start) < 0.000001) {
      const a = tangent(edge, true), b = tangent(next, false);
      const cosine = (a[0]*b[0] + a[1]*b[1]) / Math.hypot(...a) / Math.hypot(...b);
      turns.push(Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI);
    }
    if (edge.end.every((v, j) => v === current[0][j])) { cuts.push(current); current = []; }
  }
  if (current.length) throw new Error(`${spec.id}: open routed contour`);
  return {
    id: spec.id, name: spec.name, cuts, radii, turns,
    pads: children(tree, 'pad').map(pad => ({
      number: pad[1], type: pad[2], shape: pad[3],
      at: numbers(pad, 'at').slice(0, 2), size: numbers(pad, 'size'),
      drill: child(pad, 'drill').slice(1).filter(v => v !== 'oval').map(Number),
      layers: child(pad, 'layers').slice(1), hasNet: Boolean(child(pad, 'net')),
    })),
  };
});
const localPython = path.join(root, '.venv-manufacturing', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const python = process.env.MANUFACTURING_PYTHON || (fs.existsSync(localPython) ? localPython : 'python3');
const result = spawnSync(python, [path.join(__dirname, 'check-manufacturing.py')], {
  cwd: root, input: JSON.stringify({ models, keyboard, toolchain: {node:process.version,ergogen:require('ergogen').version} }), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) console.error(result.error.message);
if (result.status !== 0) {
  console.error('Manufacturing verification failed; see the errors above and docs/manufacturing-verification.md.');
  if (result.error || result.stderr?.includes('Shapely')) {
    console.error('Dependency setup: python3 -m venv .venv-manufacturing; then .venv-manufacturing/bin/python -m pip install -r scripts/requirements-manufacturing.txt');
  }
  process.exit(1);
}
