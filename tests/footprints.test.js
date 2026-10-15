'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const specs = require('../scripts/lib/switches');
const { parse, child, children, numbers, primitives, parameters } = require('../scripts/lib/sexpr');
const { sourceContours, fitContour, samplePrimitive, circleThrough,
  distance, pointSegmentDistance, TOLERANCE } = require('../scripts/lib/geometry');
const root = path.resolve(__dirname, '..');

function load(id) {
  // Exercise the real Ergogen bundle boundary: no local require, __dirname,
  // process or exports. Each generated file must be self-contained.
  const source = fs.readFileSync(path.join(root, `ergogen/footprints/${id}.js`), 'utf8');
  return new Function('require', `const module = {};\n${source}\nreturn module.exports;`)(name => {
    throw new Error(`Undeclared bundle dependency: ${name}`);
  });
}

function inside(p, vertices) {
  let result = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i], b = vertices[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) &&
      p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}

function edgeDistance(p, edges) {
  return Math.min(...edges.map(([a, b]) => pointSegmentDistance(p, a, b)));
}

for (const spec of specs) {
  test(`${spec.id}: bundle API, solder pads, mechanical holes and options`, () => {
    const fp = load(spec.id);
    for (const r of [0, 37, 90, 180]) {
      const tree = parse(fp.body(parameters(fp, { r, at: `(at 83 117 ${r})` })));
      assert.equal(tree[0], 'footprint');
      assert.deepEqual(numbers(tree, 'at'), [83, 117, r]);
      // The switch stays top-mounted; moving all copper to B.Cu must not flip it.
      assert.deepEqual(child(tree, 'layer'), ['layer', 'F.Cu']);
      const pads = children(tree, 'pad');
      const electrical = pads.filter(pad => pad[1] !== '');
      assert.equal(electrical.length, 2);
      for (const pin of spec.pins) {
        const pad = electrical.find(pad => pad[1] === pin.number);
        assert.equal(pad[2], 'thru_hole');
        assert.deepEqual(numbers(pad, 'at'), [pin.x, pin.y, r]);
        assert.deepEqual(numbers(pad, 'size'), [2.3, 2.3]);
        assert.deepEqual(numbers(pad, 'drill'), [spec.drill]);
        assert.deepEqual(child(pad, 'layers'), ['layers', 'B.Cu', 'B.Mask']);
        assert.equal(child(pad, 'net')[1], pin.number);
        assert(!JSON.stringify(pad).includes('Paste'));
      }
      for (const pad of pads.filter(pad => pad[2] === 'np_thru_hole')) {
        const [drill] = numbers(pad, 'drill');
        assert.deepEqual(numbers(pad, 'size'), [drill, drill]);
        assert(!child(pad, 'net'));
      }
      assert.equal(pads.filter(pad => pad[2] === 'np_thru_hole').length, 1 + spec.holes.length);
      assert.equal(numbers(pads.find(pad => pad[2] === 'np_thru_hole'), 'drill')[0], spec.center);
      if (spec.support) {
        const pad = pads.find(pad => pad[2] === 'thru_hole' && pad[1] === '');
        assert.deepEqual(child(pad, 'layers'), ['layers', 'B.Cu', 'B.Mask']);
        assert.deepEqual(child(pad, 'drill'), ['drill', 'oval', '1.5', '3']);
        assert.deepEqual(numbers(pad, 'size'), [2.4, 3.9]);
        assert.deepEqual(numbers(pad, 'at'), [-5, 5.15, r]);
        assert(!child(pad, 'net'));
      }
    }
    assert.equal(primitives(parse(fp.body(parameters(fp, { flex: false })))).length, 0);
    const hidden = parse(fp.body(parameters(fp, { show_envelope: false, show_cell: false })));
    assert.equal(children(hidden, 'fp_rect').length, 0);
    const visible = parse(fp.body(parameters(fp, { show_cell: true })));
    assert(children(visible, 'fp_rect').some(rect => child(rect, 'layer')[1] === 'Dwgs.User'));
    assert.throws(() => fp.body(parameters(fp, { from: undefined })), /nets are required/);
    const escaped = parse(fp.body(parameters(fp, { ref: 'SW"\\1' })));
    assert.equal(children(escaped, 'fp_text').find(t => t[1] === 'reference')[2], 'SW"\\1');
  });

  test(`${spec.id}: two closed contours, faithful arc reconstruction and pad clearances`, () => {
    const fp = load(spec.id);
    const emitted = primitives(parse(fp.body(parameters(fp))));
    const sources = sourceContours(root, spec.study);
    assert.equal(sources.length, 2);
    const fitted = sources.map(fitContour);
    assert.equal(emitted.length, fitted.flat().length);
    let offset = 0;
    const cutPolygons = [], cutEdges = [];
    for (let c = 0; c < fitted.length; c++) {
      const contour = fitted[c], polygon = [];
      for (let i = 0; i < contour.length; i++) {
        const primitive = emitted[offset++], original = contour[i];
        assert.deepEqual(primitive.end, contour[(i + 1) % contour.length].start, 'open contour');
        assert(distance(primitive.start, primitive.end) > 0.0001);
        const samples = samplePrimitive(primitive, 0.005);
        polygon.push(...samples.slice(0, -1));
        for (let j = 1; j < samples.length; j++) cutEdges.push([samples[j - 1], samples[j]]);
        if (primitive.type === 'arc') {
          const arc = circleThrough(primitive.start, primitive.mid, primitive.end);
          assert(arc.radius >= 0.5399, `Radius below reconstructed tool margin: ${arc.radius}`);
          for (const vertex of sources[c].slice(original.first, original.last + 1)) {
            assert(Math.abs(distance(vertex, arc.center) - arc.radius) <= TOLERANCE + 0.00001);
          }
        } else {
          for (const vertex of sources[c].slice(original.first, original.last + 1)) {
            assert(pointSegmentDistance(vertex, primitive.start, primitive.end) <= TOLERANCE + 0.00001);
          }
        }
        // Also check the reverse direction: the fitted curve may not shortcut
        // a notch or pass through a cut even when its vertices fit a circle.
        const source = sources[c].slice(original.first, original.last + 1);
        for (const sample of samples) {
          let nearest = Infinity;
          for (let j = 1; j < source.length; j++) nearest = Math.min(nearest,
            pointSegmentDistance(sample, source[j - 1], source[j]));
          assert(nearest < 0.004, `Reconstruction shortcuts study contour: ${nearest}`);
        }
      }
      cutPolygons.push(polygon);
    }
    const pads = children(parse(fp.body(parameters(fp))), 'pad');
    for (const pad of pads) {
      const [x, y] = numbers(pad, 'at');
      const [width, height] = numbers(pad, 'size');
      const isCopper = pad[2] === 'thru_hole';
      const radius = width / 2, halfStraight = (height - width) / 2;
      // Every pad/hole must belong to retained material, not a cutout.
      for (const polygon of cutPolygons) assert(!inside([x, y], polygon), 'Pad/hole lies in routed cut');
      // Exact capsule perimeter for the Choc support, circle for all others.
      let clearance = Infinity;
      for (let i = 0; i < 720; i++) {
        const angle = Math.PI * 2 * i / 720;
        const p = [x + radius * Math.cos(angle), y + radius * Math.sin(angle) + Math.sign(Math.sin(angle)) * halfStraight];
        for (const polygon of cutPolygons) assert(!inside(p, polygon), 'Pad/hole perimeter overlaps routed cut');
        clearance = Math.min(clearance, edgeDistance(p, cutEdges));
      }
      if (isCopper) assert(clearance >= 0.39, `Copper-to-route clearance ${clearance.toFixed(4)} mm < study margin`);
      else assert(clearance >= 0.39, `Hole-to-route retained material ${clearance.toFixed(4)} mm < 0.39 mm`);
      if (spec.id === 'choc' && !isCopper && x !== 0) {
        assert(clearance >= 0.54, `V1 locating hole has insufficient retained material: ${clearance}`);
      }
      console.log(`${spec.id} ${isCopper ? 'copper' : 'hole'} (${x}, ${y}): route clearance ${clearance.toFixed(3)} mm`);
    }
  });
}

test('Choc retains both V1 plastic locating posts and the separate V2 solder support', () => {
  const fp = load('choc');
  const pads = children(parse(fp.body(parameters(fp))), 'pad');
  const locators = pads.filter(pad => pad[2] === 'np_thru_hole' && numbers(pad, 'at')[0] !== 0);
  assert.equal(locators.length, 2, 'V1 needs two additional locating holes');
  for (const x of [-5.5, 5.5]) {
    const hole = locators.find(pad => numbers(pad, 'at')[0] === x);
    assert.deepEqual(numbers(hole, 'at'), [x, 0, 0]);
    assert.deepEqual(numbers(hole, 'drill'), [1.9]);
    assert.equal(hole[1], '');
    assert(!child(hole, 'net'));
  }
  const support = pads.find(pad => pad[2] === 'thru_hole' && pad[1] === '');
  assert(support && !child(support, 'net'));
  const [, , width, length] = child(support, 'drill');
  assert(Number(length) >= 2 * Number(width), 'JLCPCB plated slot length must be at least twice its width');
  assert.deepEqual(numbers(pads.find(pad => pad[1] === '2'), 'at'), [0, -5.9, 0]);
});

test('generated footprints are reproducible', () => {
  require('../scripts/build-footprints').build(true);
});
