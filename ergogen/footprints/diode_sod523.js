'use strict';

// Diodes Inc. 1N4148WT SOD-523 suggested lands: 0.60 x 0.70 mm,
// 0.80 mm gap (centres +/-0.70 mm). Bottom assembly; 1=K, 2=A.
module.exports = {
  params: {designator:'D', anode:undefined, cathode:undefined},
  body: p => {
    if (!p.anode || !p.cathode) throw new Error('Diode requires anode/cathode nets');
    return `(footprint "keyboard-design:diode_sod523" (layer "B.Cu") ${p.at}
      (descr "SOD-523; bottom assembly; 1 cathode, 2 anode; candidate 1N4148WT")
      (attr smd)
      (fp_text reference "${p.ref}" (at 0 0 ${p.r}) (layer "B.Fab")
        (effects (font (size 0.5 0.5) (thickness 0.1)) (justify mirror)))
      (fp_text value "1N4148WT" (at 0 0 ${p.r}) (layer "B.Fab") hide
        (effects (font (size 0.5 0.5) (thickness 0.1)) (justify mirror)))
      (fp_rect (start -0.825 -0.425) (end 0.825 0.425) (stroke (width 0.1) (type default)) (fill none) (layer "B.Fab"))
      (fp_rect (start -1.175 -0.65) (end 1.175 0.65) (stroke (width 0.05) (type default)) (fill none) (layer "B.CrtYd"))
      (fp_line (start -1.1 -0.55) (end -1.1 0.55) (stroke (width 0.1) (type default)) (layer "B.SilkS"))
      (pad "1" smd rect (at -0.7 0 ${p.r}) (size 0.6 0.7) (layers "B.Cu" "B.Paste" "B.Mask") ${p.cathode})
      (pad "2" smd rect (at 0.7 0 ${p.r}) (size 0.6 0.7) (layers "B.Cu" "B.Paste" "B.Mask") ${p.anode})
    )`;
  },
};
