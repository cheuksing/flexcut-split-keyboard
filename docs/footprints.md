# Switch footprints

## Scope and coordinate convention

These footprints implement the local study's per-key moving islands, two folded
beams, pad lobes, and two closed routed regions. They assume a regular **19.05 mm
pitch**, consistently oriented switches, nominal **1.35 mm beams**, **1.20 mm routed
channels**, and **2.0 mm half-rails**. Cuts are integral footprint graphics on
`Edge.Cuts`; locating and solder holes are pad drill features, never outline cuts.
No perimeter outline is included in the switch footprint.

The origin is the switch center. Coordinates below are the top/component view:
+X right and +Y down, matching the study's SVG and KiCad footprint coordinates.
Mount switches from the front; solder from the back. A `F.Cu` footprint container
keeps the switch top-mounted even though its solder pads are on `B.Cu`.
Do not flip the footprint to the back just to put the solder pads on the bottom.
Mirrored Ergogen point sets must retain the physical pin pattern; these files
deliberately do not mirror their internal coordinates.

`from` connects to pad 1 and `to` to pad 2. The names are arbitrary switch nets,
not diode polarity. MX numbering follows the study and differs from Ergogen's
built-in MX footprint; use this mapping when the schematic is created later.

| Footprint | Feature | X | Y | Copper size | Finished drill |
| --- | --- | ---: | ---: | --- | --- |
| KS-33 | Center NPTH | 0 | 0 | None | Ø5.25 |
| KS-33 | Pad 1 (`from`) | -4.4 | 4.7 | Ø2.30 | Ø1.45 plated |
| KS-33 | Pad 2 (`to`) | 2.6 | 5.75 | Ø2.30 | Ø1.45 plated |
| Choc V1/V2 | Center NPTH | 0 | 0 | None | Ø5.10 |
| Choc V1 | Locating NPTHs | ±5.50 | 0 | None | Ø1.90 |
| Choc V1/V2 | Pad 1 (`from`) | 5 | -3.8 | Ø2.30 | Ø1.45 plated |
| Choc V1/V2 | Pad 2 (`to`) | 0 | -5.9 | Ø2.30 | Ø1.45 plated |
| Choc V1/V2 | Support, no number/net | -5 | 5.15 | 2.40 × 3.90 capsule | 1.50 × 3.00 plated capsule slot |
| MX | Center NPTH | 0 | 0 | None | Ø3.99 |
| MX | Locating NPTHs | ±5.08 | 0 | None | Ø1.70 |
| MX | Pad 1 (`from`) | -3.81 | -2.54 | Ø2.30 | Ø1.524 plated |
| MX | Pad 2 (`to`) | 2.54 | -5.08 | Ø2.30 | Ø1.524 plated |

All dimensions are mm. Every plated pad, including the Choc support, explicitly
uses `(layers "B.Cu" "B.Mask")`. There are no front solder pads, front solder-mask
openings on those pads, or paste apertures. NPTH pads use `*.Cu / *.Mask` with pad
size equal to drill size; this defines mechanical holes without annular copper.
The top-side drill barrel is still present on plated holes: bottom-only annular
pads do not make the plated holes blind holes.

## Deliberate changes from the study

- **Choc V1 / V2 combined**: two V1 Ø1.90 mm NPTH locating holes at
  (±5.50, 0) now have their own retained island lobes. The V2 center bore remains
  Ø5.10 mm and the V2 solder support remains an unnumbered no-net plated pad.
  Electrical pad 2 is corrected to Y = -5.90 mm from Kailh's drawings.
  Both folded beams were repositioned to clear the new lobes. Facing locator
  scallops leave a 2.65 mm local shared rail at 19.05 mm pitch. Matching case ribs
  and a locally relieved continuous gasket sheet are required; with 0.30 mm
  clearance on each side, the local gasket web is 2.05 mm.
- **KS-33 center hole: 5.25 mm**, corrected from the study's 5.10 mm to the PCB
  layout dimension in the supplied `gateron-ks33-drawing.png`. Signal drills keep
  the study's smaller 1.45 mm solder-hole sizing. This footprint omits the LED
  aperture and is not a general declaration of KS-27 compatibility.
- **Choc support copper: 2.40 × 3.90 mm capsule**, around a 1.50 × 3.00 mm
  plated slot. JLCPCB's published plated-slot length is at least twice its width,
  so the previous 1.50 × 2.00 mm aperture has been lengthened. It still encompasses
  that earlier aperture. The 0.45 mm annular ring is solderable and the regenerated
  contour keeps about 0.408 mm copper-to-route clearance. The study and emitted
  pad now both use an actual capsule, eliminating the ellipse/capsule mismatch.
- **All solder copper is bottom-only**, including the no-net support pad.
  Plated drills are retained.
- **Body guides are separate from plate openings**: the non-fabricating `F.Fab`
  guides use 15 mm square bounds for KS-33/Choc and 15.6 mm for MX. They are visual
  envelopes, not dimensioned plate cutouts; final mechanical CAD must use the
  selected switch's complete drawing and tolerances.

The Choc study contours and preview have been revised together with the footprint.
Treat these as engineering review footprints, pending native CAD and hardware checks.
Optional contour regeneration: install Shapely >=2 in a Python environment and run
`python3 scripts/rebuild-choc-study.py`, then `npm run check` and `npm run review`.
Ordinary Node builds use the checked-in study. The mandatory manufacturing check
uses Python/Shapely; setup is documented in the README.

## Using Ergogen

Target **Ergogen 4.1.0 or newer**, with **`template: kicad8`**. Each `.js` module is
self-contained because Ergogen's bundle loader does not allow arbitrary local
`require()` dependencies. Run a folder, not the YAML file alone, to load the
custom `footprints/` directory.

With an Ergogen CLI installed:

```sh
ergogen ergogen -o build/ergogen
```

`ergogen/config.yaml` is only a review fixture. It defines three independent,
unrouted single-key coupons using synthetic review nets; it is not the future
keyboard or its schematic. Its 27.05 mm outline provides a nominal 6 mm outside
rail relative to the study's standard opening. Set board thickness to **1.2 mm**
in KiCad before evaluating flex: Ergogen's stock KiCad 8 template defaults to
1.6 mm, and footprints cannot set PCB stackup.

For the future layout, a footprint declaration can be:

```yaml
pcbs:
  keyboard:
    template: kicad8
    footprints:
      switches:
        what: ks33 # or choc or mx
        where: true
        params:
          from: "{{column_net}}"
          to: "{{switch_net}}"
```

Those net attributes are placeholders to define when designing the schematic.
If moving the footprint files into a named subdirectory of `footprints/`, prefix
`what` with that directory name.

| Parameter | Default | Meaning |
| --- | --- | --- |
| `designator` | `SW` | Reference prefix |
| `from` | Required | Pad 1 net |
| `to` | Required | Pad 2 net |
| `flex` | `true` | Include the two closed `Edge.Cuts` regions |
| `show_envelope` | `true` | Show body bounds on `F.Fab` |
| `show_cell` | `false` | Show 19.05 mm cell on `Dwgs.User` |

There are no side, reversible or hotswap options. Fixed-size flex cuts must not
be scaled to a smaller key pitch. Board-level copper keepouts, beam traces,
gaskets, hard stops, edge support and larger-key stabilizers belong to the next
design phase. Use the study's 0.35–0.50 mm hard stop and 0.25–0.30 mm beam traces;
avoid vias, joints and component bodies on the beams.

## Validation performed

`npm run check` rebuilds all three modules and runs eight Node tests without Node
dependencies, then the mandatory Python/Shapely manufacturing gate. Checks cover
the Ergogen bundle loading contract, escaped references,
required nets, pin/net mapping, pad layers and drills, unconnected plated support,
placement at 0°, 37°, 90° and 180°, drawing toggles, two exactly closed cut loops,
and reproducible generation. The additional gate checks cutter access, plated
slot width/aspect ratio, annular rings, drill spacing, both suspension paths,
island necks, repeated 3×3 rails and adverse-tolerance connectivity for every
footprint. It also exercises malformed short/narrow slots, a thin bridge and an
inaccessible routing spur to verify rejection. See the complete
[constraint register](manufacturing-limitations.md) and generated
[verification report](manufacturing-verification.md).

The study's thousands of quantized SVG segments are reconstructed as lines and
true circular arcs with a 0.002 mm vertex-fit tolerance. Reverse sampling checks
also prevent a fitted arc from bowing across a long straight source edge.
Reconstructed arcs have radius at least 0.54 mm (the study's nominal minimum is
0.55 mm; coordinates were rounded to 0.001 mm). All joints share identical
endpoints. Source cut topology and beam geometry are preserved within the fit
tolerance; no new production routing geometry has been inferred from screenshots.

Clearance checks sample actual emitted circles/capsules against the emitted cut
contours at approximately 0.005 mm curve spacing. The minimum measured solder-pad
copper-to-route clearance is about **0.398 mm**, consistent with the study's
0.40 mm nominal target and reconstruction tolerance. MX locating holes retain
about **0.549 mm** minimum material to the routed cut. These are geometric
regression checks, not a fabrication certification.

## Pending native and hardware checks

The CLI fixture has **not** been executed by Ergogen, and no native KiCad
load/save, DRC or Gerber/drill export has been performed. The review page is
generated from parsed footprint expressions, not a native KiCad render.

Before fabrication, load the standalone footprints and generated coupons in the
target KiCad version, save/reopen, and inspect front/back copper separately. Verify
that KiCad preserves the bottom-only plated pad layer sets when saving or editing.
Export front/back copper, mask, routed contours, PTH and NPTH drill files: confirm
no front annular pads, two closed internal cuts, and a plated Choc support slot
without an assigned net. Run native DRC against the actual board and manufacturer
rules, including final routed-channel widths and small contour transitions.

Then check the exact switch SKUs against physical samples, particularly Choc V2's
support pin, and validate the 1.2 mm FR-4 flex/gasket/hard-stop assembly with a
coupon. The study's construction remains experimental until this physical work.

## References

- [Local study](../keyboard-flex-study/design-notes.md) and its original SVG contours
  in [key-flex-cuts.html](../keyboard-flex-study/key-flex-cuts.html).
- [Supplied KS-33 drawing](../keyboard-flex-study/gateron-ks33-drawing.png) and
  [Gateron manufacturer PDF](https://gateron.com/u_file/2311/10/file/GATERONKS-33LowProfile20RedSwitchBlackBottomHousing-KS-33H10B050NN-Y24.pdf).
- [Kailh V1 manufacturer drawing](https://cdn-shop.adafruit.com/product-files/5114/5114_CPG135001D03.pdf), page 1.
- [Kailh V2 manufacturer datasheet](https://www.kailh.net/pages/product-datasheet), PG1353 page 1.
- [JLCPCB capabilities](https://jlcpcb.com/capabilities/Capabilities), including NPTH, routed-edge clearance, plated-slot aspect ratio and Regular tolerance.
- [Ergogen footprint API](https://docs.ergogen.xyz/pcbs/) and
  [bundle loader](https://github.com/ergogen/ergogen/blob/master/src/io.js).
- [Ergogen's KiCad 8 template](https://github.com/ergogen/ergogen/blob/master/src/templates/kicad8.js)
  for target file format and board-thickness default.

No third-party footprint implementation was copied. The dimensions and contours
are derived from the local study, with the explicitly documented corrections.
