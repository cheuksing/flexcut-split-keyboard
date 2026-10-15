'use strict';

const { createHash } = require('node:crypto');
const q = s => JSON.stringify(String(s));
const n = x => Number(x.toFixed(5));
function uuid(name) {
  const h = createHash('sha256').update(`choc5x4:${name}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
const font = '(effects (font (size 1.27 1.27)))';
function pin(number, name, x, orientation, length) {
  return `(pin passive line (at ${x} 0 ${orientation}) (length ${length})
    (name ${q(name)} ${font}) (number ${q(number)} ${font}))`;
}
function library() {
  const property = (name, value, y) => `(property ${q(name)} ${q(value)} (at 0 ${y} 0) ${font})`;
  return `(lib_symbols
    (symbol "Keyboard:ChocSwitch" (pin_names (offset 0) hide) (in_bom yes) (on_board yes)
      ${property('Reference', 'SW', 3.81)} ${property('Value', 'Choc V1/V2', -3.81)}
      (symbol "ChocSwitch_0_1"
        (circle (center -2.54 0) (radius 0.508) (stroke (width 0.254) (type default)) (fill (type none)))
        (circle (center 2.54 0) (radius 0.508) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy -2.54 0.508) (xy 2.54 2.032)) (stroke (width 0.254) (type default)) (fill (type none))))
      (symbol "ChocSwitch_1_1" ${pin('1','1',-5.08,0,2.032)} ${pin('2','2',5.08,180,2.032)}))
    (symbol "Keyboard:Diode" (pin_names (offset 0) hide) (in_bom yes) (on_board yes)
      ${property('Reference', 'D', 3.81)} ${property('Value', '1N4148W', -3.81)}
      (symbol "Diode_0_1"
        (polyline (pts (xy -1.27 -1.27) (xy -1.27 1.27) (xy 1.27 0) (xy -1.27 -1.27))
          (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy 1.27 -1.27) (xy 1.27 1.27)) (stroke (width 0.254) (type default)) (fill (type none))))
      (symbol "Diode_1_1" ${pin('2','A',-5.08,0,3.81)} ${pin('1','K',5.08,180,3.81)})))`;
}

function schematic(keys) {
  const root = uuid('root');
  const output = [`(kicad_sch (version 20231120) (generator "keyboard-design")
    (uuid ${root}) (paper "A3")
    (title_block (title "Choc 5x4 identical half - five-net charlieplex matrix") (rev "0.2.0")
      (comment 1 "UNROUTED REVIEW - controller / adapter / electrical rollover validation pending"))`, library()];
  const text = (s,x,y,id) => output.push(`(text ${q(s)} (at ${n(x)} ${n(y)} 0) ${font} (uuid ${uuid(id)}))`);
  const wire = (x1,y1,x2,y2,id) => output.push(`(wire (pts (xy ${n(x1)} ${n(y1)}) (xy ${n(x2)} ${n(y2)}))
    (stroke (width 0) (type default)) (uuid ${uuid(id)}))`);
  const label = (net,x,y,id) => output.push(`(label ${q(net)} (at ${n(x)} ${n(y)} 0)
    (effects (font (size 1.016 1.016)) (justify left bottom)) (uuid ${uuid(id)}))`);
  function instance(lib, ref, value, footprint, x,y) {
    const id = uuid(ref);
    output.push(`(symbol (lib_id "Keyboard:${lib}") (at ${n(x)} ${n(y)} 0) (unit 1)
      (in_bom yes) (on_board yes) (dnp no) (uuid ${id})
      (property "Reference" ${q(ref)} (at ${n(x)} ${n(y-5.08)} 0) ${font})
      (property "Value" ${q(value)} (at ${n(x)} ${n(y+5.08)} 0) ${font})
      (property "Footprint" ${q(footprint)} (at ${n(x)} ${n(y)} 0) (effects (font (size 1.27 1.27)) hide))
      (pin "1" (uuid ${uuid(ref+'.1')})) (pin "2" (uuid ${uuid(ref+'.2')}))
      (instances (project "choc5x4_half" (path "/${root}" (reference ${q(ref)}) (unit 1)))))`);
  }
  text('ONE PCB DESIGN / BOTH HANDS / COMPONENT SIDE UP', 200.66, 15.24, 'title');
  text('P0..P4 are shared input/output lines. COL*/ROW* describe position only.',200.66,22.86,'nets');
  text('Current: sense pull-up -> SW pin 1 -> SW pin 2 -> diode A(2) -> diode K(1) -> active-low sink.',200.66,30.48,'polarity');
  for (let c=0;c<5;c++) {
    const x=12.7+c*76.2;
    text(`COL${c}: ${['pinky','ring','middle','index','inner'][c]}`,x+31.75,40.64,`col${c}`);
  }
  for (const k of keys) {
    const x=12.7+k.column*76.2, y=50.8+Number(k.row.slice(1))*45.72;
    instance('ChocSwitch',k.switch,'Choc V1/V2','keyboard-design:choc',x+17.78,y);
    instance('Diode',k.diode,'1N4148W (candidate)','keyboard-design:diode_sod123',x+43.18,y);
    // Each label is at a wire endpoint, so the connectivity checker need not
    // infer intersections or mid-wire labels.
    wire(x+5.08,y,x+12.7,y,k.id+'-sense'); label(k.sense,x+5.08,y,k.id+'-sense-label');
    wire(x+22.86,y,x+30.48,y,k.id+'-local-a');
    wire(x+30.48,y,x+38.1,y,k.id+'-local-b'); label(k.local,x+30.48,y,k.id+'-local-label');
    wire(x+48.26,y,x+58.42,y,k.id+'-sink'); label(k.sink,x+58.42,y,k.id+'-sink-label');
    text(`${k.row}: ${k.sense} -> ${k.sink}`,x+31.75,y+12.7,k.id+'-pair');
  }
  text('Scan one Pn LOW; remaining lines are pulled-up inputs. Release to input before changing the sink.',200.66,241.3,'scan');
  text('Series diodes do not establish NKRO: two-key forward paths can mimic a third key. Validate thresholds / scan method.',200.66,248.92,'ghosting');
  text('No MCU, adapter, connector, power or inter-half wiring is selected in this matrix-only revision.',200.66,256.54,'scope');
  output.push(')');
  return output.join('\n');
}
module.exports = { schematic, uuid };
