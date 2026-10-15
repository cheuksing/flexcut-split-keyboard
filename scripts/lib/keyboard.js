'use strict';

const assert = require('node:assert/strict');
const { parse, child, children, numbers, primitives } = require('./sexpr');
const { samplePrimitive, distance } = require('./geometry');

function loops(edges) {
  const remaining = [...edges], result = [];
  while (remaining.length) {
    const first = remaining.shift(), chain = [first];
    while (distance(chain.at(-1).end, first.start) > 1e-5) {
      const p = chain.at(-1).end;
      const i = remaining.findIndex(e => distance(e.start, p) < 1e-5 || distance(e.end, p) < 1e-5);
      assert(i >= 0, 'Open Edge.Cuts contour');
      let e = remaining.splice(i, 1)[0];
      if (distance(e.end, p) < 1e-5) e = { ...e, start: e.end, end: e.start };
      chain.push(e);
    }
    result.push(chain.flatMap(e => samplePrimitive(e, .004).slice(0, -1)));
  }
  return result;
}

function boardModel(text) {
  const tree = parse(text);
  const footprints = children(tree, 'footprint').map(fp => {
    const at = numbers(fp, 'at');
    assert(Math.abs(at[2] || 0) < 1e-8, 'Half must use fixed zero-degree footprints');
    const abs = p => [p[0] + at[0], p[1] + at[1]];
    return {
      name: fp[1], ref: children(fp, 'fp_text').find(t => t[1] === 'reference')[2], at,
      cuts: loops(primitives(fp)).map(c => c.map(abs)),
      pads: children(fp, 'pad').map(p => ({
        number: p[1], type: p[2], shape: p[3], at: abs(numbers(p, 'at')),
        size: numbers(p, 'size'), layers: child(p, 'layers').slice(1),
        drill: child(p, 'drill')?.slice(1).filter(v => v !== 'oval').map(Number),
        net: child(p, 'net')?.[2] || null,
      })),
      courtyard: children(fp, 'fp_rect').filter(r => child(r, 'layer')[1] === 'B.CrtYd')
        .map(r => [abs(numbers(r, 'start')), abs(numbers(r, 'end'))]),
    };
  });
  const edges = tree.filter(e => ['gr_line', 'gr_arc'].includes(e[0]) && child(e, 'layer')[1] === 'Edge.Cuts')
    .map(e => ({ type: e[0].slice(3), start: numbers(e, 'start'), end: numbers(e, 'end'),
      ...(e[0] === 'gr_arc' ? { mid: numbers(e, 'mid') } : {}) }));
  return { thickness: numbers(child(tree, 'general'), 'thickness')[0],
    perimeter: loops(edges), footprints,
    tracks: children(tree, 'segment').length, vias: children(tree, 'via').length,
    zones: children(tree, 'zone').length };
}

// Trace actual schematic wire connectivity and embedded symbol pin positions.
function schematicNets(text) {
  const tree = parse(text), parent = new Map();
  const coord = p => p.map(v => Number(v.toFixed(5))).join(',');
  function find(k) { if (!parent.has(k)) parent.set(k, k); if (parent.get(k) !== k) parent.set(k, find(parent.get(k))); return parent.get(k); }
  const join = (a, b) => parent.set(find(a), find(b));
  for (const w of children(tree, 'wire')) {
    const pts = child(w, 'pts').slice(1).map(p => coord(p.slice(1).map(Number)));
    join(pts[0], pts[1]);
  }
  const labels = children(tree, 'label');
  for (const l of labels) join(coord(numbers(l, 'at').slice(0, 2)), `net:${l[1]}`);
  const named = new Map();
  for (const l of labels) {
    const root = find(`net:${l[1]}`);
    assert(!named.has(root) || named.get(root) === l[1], 'Two schematic nets shorted');
    named.set(root, l[1]);
  }
  const libs = children(child(tree, 'lib_symbols'), 'symbol'), nets = {};
  for (const s of children(tree, 'symbol')) {
    const ref = children(s, 'property').find(p => p[1] === 'Reference')[2];
    const at = numbers(s, 'at');
    assert.equal(at[2], 0, 'Unexpected schematic rotation');
    const lib = libs.find(l => l[1] === child(s, 'lib_id')[1]);
    nets[ref] = {};
    for (const sub of children(lib, 'symbol')) for (const pin of children(sub, 'pin')) {
      const local = numbers(pin, 'at');
      const xy = [at[0] + local[0], at[1] - local[1]];
      const net = named.get(find(coord(xy)));
      assert(net, `Schematic unconnected pin ${ref}.${child(pin, 'number')[1]}`);
      nets[ref][child(pin, 'number')[1]] = net;
    }
  }
  return nets;
}

function verifyElectrical(model, keys, sch) {
  assert.equal(keys.length, 20, 'Expected 20 keys');
  assert.equal(model.thickness, 1.2, 'Expected 1.2 mm FR-4');
  assert.equal(model.tracks + model.vias + model.zones, 0, 'This revision is explicitly unrouted');
  const fp = new Map(model.footprints.map(f => [f.ref, f]));
  assert.equal(fp.size, 40, 'Expected exactly 20 switches and 20 diodes');
  assert.equal(Object.keys(sch).length, 40, 'Unexpected schematic population');
  const pairs = new Set(), scan = new Set();
  for (const key of keys) {
    assert.notEqual(key.sense, key.sink, 'Charlieplex self-pair');
    const pair = `${key.sense}>${key.sink}`;
    assert(!pairs.has(pair), `Duplicate charlieplex pair ${pair}`); pairs.add(pair);
    scan.add(key.sense); scan.add(key.sink);
    const sw = fp.get(key.switch), diode = fp.get(key.diode);
    assert.equal(sw.name, 'keyboard-design:choc');
    assert.equal(diode.name, 'keyboard-design:diode_sod123');
    assert(distance(sw.at, key.at) < 1e-6, 'Switch placement differs from Ergogen');
    assert(distance(diode.at, [sw.at[0] + 5, sw.at[1] + 19.05/2]) < 1e-6, 'Diode misplaced');
    const net = (f, n) => f.pads.find(p => p.number === n)?.net;
    const expectedSW = { '1': key.sense, '2': key.local };
    const expectedD = { '1': key.sink, '2': key.local };
    for (const [f, expected] of [[sw, expectedSW], [diode, expectedD]]) {
      for (const [pin, name] of Object.entries(expected)) assert.equal(net(f, pin), name, `${f.ref}.${pin}: net/polarity mismatch`);
      assert.deepEqual(sch[f.ref], expected, `${f.ref}: schematic/PCB disagree`);
    }
    for (const p of sw.pads) {
      if (p.type === 'thru_hole') assert.deepEqual(p.layers, ['B.Cu', 'B.Mask']);
      if (!p.number) assert.equal(p.net, null, 'Mechanical hole/support has a net');
    }
    assert.equal(sw.pads.filter(p => p.type === 'np_thru_hole').length, 3);
    const support = sw.pads.find(p => p.type === 'thru_hole' && !p.number);
    assert.deepEqual(support.drill, [1.5, 3]);
    for (const p of diode.pads) assert.deepEqual(p.layers, ['B.Cu', 'B.Paste', 'B.Mask']);
  }
  assert.deepEqual([...scan].sort(), ['P0', 'P1', 'P2', 'P3', 'P4']);
  assert.equal(pairs.size, 5 * (5 - 1), 'Directed-pair coverage incomplete');
  return { scan_nets: [...scan].sort(), directed_pairs: pairs.size, schematic_matches_pcb: true };
}

module.exports = { loops, boardModel, schematicNets, verifyElectrical };
