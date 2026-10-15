'use strict';

// SOD-123 land dimensions: KiCad Diode_SMD:D_SOD-123, pad centres
// +/-1.65, 0.9 x 1.2 mm pads; 4.7 x 2.3 mm courtyard. Independently
// written bottom-side implementation. 1 = K, 2 = A. Exact SKU is pending.
module.exports = {
  params: { designator: 'D', anode: undefined, cathode: undefined },
  body: p => {
    if (!p.anode || !p.cathode) throw new Error('Diode requires anode/cathode nets');
    return `(footprint "keyboard-design:diode_sod123" (layer "B.Cu") ${p.at}
      (descr "SOD-123; bottom assembly; 1 cathode, 2 anode; candidate 1N4148W")
      (attr smd)
      (fp_text reference "${p.ref}" (at 0 0 ${p.r}) (layer "B.Fab")
        (effects (font (size 0.6 0.6) (thickness 0.1)) (justify mirror)))
      (fp_text value "1N4148W" (at 0 0 ${p.r}) (layer "B.Fab") hide
        (effects (font (size 0.6 0.6) (thickness 0.1)) (justify mirror)))
      (fp_rect (start -1.4 -0.9) (end 1.4 0.9) (stroke (width 0.1) (type default)) (fill none) (layer "B.Fab"))
      (fp_rect (start -2.35 -1.15) (end 2.35 1.15) (stroke (width 0.05) (type default)) (fill none) (layer "B.CrtYd"))
      (fp_line (start -2.25 -0.8) (end -2.25 0.8) (stroke (width 0.12) (type default)) (layer "B.SilkS"))
      (pad "1" smd rect (at -1.65 0 ${p.r}) (size 0.9 1.2) (layers "B.Cu" "B.Paste" "B.Mask") ${p.cathode})
      (pad "2" smd rect (at 1.65 0 ${p.r}) (size 0.9 1.2) (layers "B.Cu" "B.Paste" "B.Mask") ${p.anode})
    )`;
  },
};
