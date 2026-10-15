'use strict';

// Reconstruct lines and true circular arcs from the study's quantized SVG paths.
// Endpoint-constrained fits keep every joint closed at the serialized precision.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const TOLERANCE = 0.002; // mm; study vertices were rounded to 0.001 mm
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const round = v => Number(v.toFixed(6));
const point = p => p.map(round);

function sourceContours(root, id) {
  const html = fs.readFileSync(path.join(root, 'keyboard-flex-study/key-flex-cuts.html'), 'utf8');
  const section = html.split(`<title id="${id}-title">`)[1]?.split('</svg>')[0];
  assert(section, `Missing study section ${id}`);
  const d = section.match(/<path class="cell-cut"[^>]* d="([^"]+)"/)[1];
  return [...d.matchAll(/M([^M]+?)Z/g)].map(match => {
    const coords = [...match[1].matchAll(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g)]
      .map(m => [Number(m[1]), Number(m[2])]);
    const vertices = coords.filter((p, i) => !i || distance(p, coords[i - 1]) > 0.0001);
    if (distance(vertices[0], vertices.at(-1)) > 0.0001) vertices.push(vertices[0]);
    return vertices;
  });
}

function fitLine(points) {
  const start = points[0], end = points.at(-1), delta = sub(end, start);
  const length = distance(start, end);
  if (length < 0.01) return;
  let previous = -Infinity;
  for (const p of points) {
    const d = sub(p, start);
    const t = (d[0] * delta[0] + d[1] * delta[1]) / length;
    if (Math.abs(cross(delta, d)) / length > TOLERANCE || t < previous - 0.001) return;
    previous = t;
  }
  return { type: 'line', start, end };
}

function fitArc(points) {
  if (points.length < 6) return;
  const start = points[0], end = points.at(-1), chord = sub(end, start);
  const length = distance(start, end);
  if (length < 0.04) return;
  const middle = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const normal = [-chord[1] / length, chord[0] / length];
  let numerator = 0, denominator = 0;
  for (const p of points.slice(1, -1)) {
    const d = sub(p, middle);
    const a = 2 * (d[0] * normal[0] + d[1] * normal[1]);
    const b = d[0] ** 2 + d[1] ** 2 - length ** 2 / 4;
    numerator += a * b;
    denominator += a * a;
  }
  if (denominator < 1e-12) return;
  const t = numerator / denominator;
  const center = [middle[0] + t * normal[0], middle[1] + t * normal[1]];
  const radius = distance(start, center);
  // Do not reconstruct tiny quantization artifacts as toolpath fillets.
  if (radius < 0.54 || radius > 40) return;
  let sweep = 0, direction = 0;
  for (let i = 1; i < points.length; i++) {
    if (Math.abs(distance(points[i], center) - radius) > TOLERANCE) return;
    // Vertex-only fits could bend a long straight SVG edge into a large-radius
    // arc. Bound the bow between every pair of source vertices as well.
    const gap = distance(points[i - 1], points[i]);
    if (gap >= 2 * radius || radius - Math.sqrt(radius ** 2 - gap ** 2 / 4) > 0.001) return;
    const a = sub(points[i - 1], center), b = sub(points[i], center);
    const angle = Math.atan2(cross(a, b), a[0] * b[0] + a[1] * b[1]);
    if (Math.abs(angle) > 0.0001) {
      if (direction && Math.sign(angle) !== direction) return;
      direction = Math.sign(angle);
    }
    sweep += angle;
  }
  if (Math.abs(sweep) < 0.06 || Math.abs(sweep) > Math.PI * 1.8) return;
  const angle = Math.atan2(start[1] - center[1], start[0] - center[0]) + sweep / 2;
  return {
    type: 'arc', start, end,
    mid: [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)],
    center, radius, sweep,
  };
}

function fitContour(vertices) {
  const result = [];
  let start = 0;
  while (start < vertices.length - 1) {
    let best;
    // Prefer long analytic primitives. Look beyond short failures because a
    // quantized three-point arc can be unstable while a longer fit is sound.
    let failures = 0;
    for (let end = start + 1; end < vertices.length; end++) {
      const section = vertices.slice(start, end + 1);
      const candidate = fitLine(section) || fitArc(section);
      if (candidate) {
        best = { ...candidate, last: end };
        failures = 0;
      } else if (++failures > 20 && best) break;
    }
    if (!best) best = { type: 'line', start: vertices[start], end: vertices[start + 1], last: start + 1 };
    result.push({
      ...best, start: point(best.start), end: point(best.end),
      ...(best.mid ? { mid: point(best.mid), center: point(best.center), radius: round(best.radius), sweep: best.sweep } : {}),
      first: start,
    });
    start = best.last;
  }
  return result;
}

function circleThrough(start, mid, end) {
  const a = sub(mid, start), b = sub(end, start);
  const d = 2 * cross(a, b);
  assert(Math.abs(d) > 1e-10, 'Degenerate arc');
  const aa = a[0] ** 2 + a[1] ** 2, bb = b[0] ** 2 + b[1] ** 2;
  const center = [start[0] + (b[1] * aa - a[1] * bb) / d,
    start[1] + (a[0] * bb - b[0] * aa) / d];
  const angle = p => Math.atan2(p[1] - center[1], p[0] - center[0]);
  const positive = v => (v + Math.PI * 4) % (Math.PI * 2);
  let sweep = positive(angle(end) - angle(start));
  if (positive(angle(mid) - angle(start)) > sweep) sweep -= Math.PI * 2;
  return { center, radius: distance(start, center), sweep, angle: angle(start) };
}

function samplePrimitive(primitive, step = 0.01) {
  if (primitive.type === 'line') return [primitive.start, primitive.end];
  const arc = circleThrough(primitive.start, primitive.mid, primitive.end);
  const n = Math.ceil(Math.abs(arc.sweep) * arc.radius / step);
  return Array.from({ length: n + 1 }, (_, i) => {
    const angle = arc.angle + arc.sweep * i / n;
    return [arc.center[0] + arc.radius * Math.cos(angle), arc.center[1] + arc.radius * Math.sin(angle)];
  });
}

function pointSegmentDistance(p, a, b) {
  const d = sub(b, a), w = sub(p, a);
  const len2 = d[0] ** 2 + d[1] ** 2;
  if (!len2) return distance(p, a);
  const t = Math.max(0, Math.min(1, (w[0] * d[0] + w[1] * d[1]) / len2));
  return distance(p, [a[0] + t * d[0], a[1] + t * d[1]]);
}

module.exports = { sourceContours, fitContour, circleThrough, samplePrimitive,
  distance, pointSegmentDistance, TOLERANCE };
