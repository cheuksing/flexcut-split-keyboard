'use strict';

// This function is serialized into each footprint by build-footprints.js.
// Keep it dependency-free: Ergogen's bundle loader disallows local require().
module.exports = function makeFootprint(spec, contours) {
  const q = value => JSON.stringify(String(value));
  const n = value => Number(value.toFixed(6));
  const xy = p => p.map(n).join(' ');
  const stroke = '(stroke (width 0.05) (type default))';
  return {
    params: {
      designator: 'SW', from: undefined, to: undefined,
      flex: true, show_envelope: true, show_cell: false,
    },
    body: p => {
      if (!p.from || !p.to) throw new Error(`${spec.id}: both from and to nets are required`);
      const lines = [
        `(footprint "keyboard-design:${spec.id}" (layer "F.Cu")`, p.at,
        `(descr ${q(spec.note + ' Switch on top; solder pads B.Cu/B.Mask only; fixed orientation, no hotswap.')})`,
        '(attr through_hole)',
        `(fp_text reference ${q(p.ref)} (at 0 8.6 ${p.r}) (layer "F.SilkS") ${p.ref_hide || ''} (effects (font (size 0.8 0.8) (thickness 0.12))))`,
        `(fp_text value ${q(spec.name)} (at 0 -8.6 ${p.r}) (layer "F.Fab") hide (effects (font (size 0.8 0.8) (thickness 0.12))))`,
      ];
      // Mechanical holes have no annular copper: size equals drill. *.Cu
      // describes the hole/clearance through both layers, not a solder pad.
      const hole = (x, y, diameter) => lines.push(
        `(pad "" np_thru_hole circle (at ${x} ${y} ${p.r}) (size ${diameter} ${diameter}) (drill ${diameter}) (layers "*.Cu" "*.Mask"))`);
      hole(0, 0, spec.center);
      spec.holes.forEach(h => hole(h.x, h.y, h.diameter));
      for (const pin of spec.pins) {
        const net = pin.number === '1' ? p.from : p.to;
        lines.push(`(pad ${q(pin.number)} thru_hole circle (at ${pin.x} ${pin.y} ${p.r}) (size 2.3 2.3) (drill ${spec.drill}) (layers "B.Cu" "B.Mask") ${net})`);
      }
      if (spec.support) {
        const s = spec.support;
        lines.push(`(pad "" thru_hole oval (at ${s.x} ${s.y} ${p.r}) (size ${s.size.join(' ')}) (drill oval ${s.drill.join(' ')}) (layers "B.Cu" "B.Mask") (property pad_prop_mechanical))`);
      }
      const rect = (width, height, layer) => lines.push(
        `(fp_rect (start ${-width / 2} ${-height / 2}) (end ${width / 2} ${height / 2}) ${stroke} (fill none) (layer ${q(layer)}))`);
      // Fabrication envelope is separate from the 14 mm plate opening.
      if (p.show_envelope) rect(...spec.envelope, 'F.Fab');
      if (p.show_cell) rect(19.05, 19.05, 'Dwgs.User');
      if (p.flex) for (const contour of contours) for (const primitive of contour) {
        const mid = primitive.mid ? `(mid ${xy(primitive.mid)}) ` : '';
        lines.push(`(fp_${primitive.type} (start ${xy(primitive.start)}) ${mid}(end ${xy(primitive.end)}) ${stroke} (layer "Edge.Cuts"))`);
      }
      lines.push(')');
      return lines.join('\n');
    },
  };
};
