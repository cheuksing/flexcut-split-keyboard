# Identical Choc 5×4 half and USB-C interface review

The keyboard uses two copies of **one PCB design**, with both switch sides up.
There are 20 keys per half, 40 across the keyboard. The user's five-copy batch can
therefore use a single half design. The requested USB-C breakaway adapter is now
under review, with electrical blockers documented in
[interface verification](usb-c-interface-verification.md). The sole native PCB contains the half and passive adapter joined by mouse-bite
tabs. It is unrouted.
No board has been ordered or sent to a manufacturer.

## Geometry and handedness

The exact Ergogen column staggers are `0, +3, +5, −5, −3 mm`. These are increments,
so the absolute column heights are **0, 3, 8, 3, 0 mm**. All horizontal and vertical
steps use **19.05 mm** pitch; the generated flex footprint cannot be compressed to
standard tighter Choc spacing without redesigning its suspension.

The supplied row order `r3, r2, r1, r0` follows Ergogen's bottom-to-top convention:
**r0 is the highest row, r3 the lowest**. No thumb keys, stabilizers or extra keys
have been added.

| Physical column left to right | Height | Left-hand name | Right-hand name | Scan sense net |
| --- | ---: | --- | --- | --- |
| COL0 | 0 mm | pinky | inner | P0 |
| COL1 | 3 mm | ring | index | P1 |
| COL2 | 8 mm | middle | middle | P2 |
| COL3 | 3 mm | index | ring | P3 |
| COL4 | 0 mm | inner | pinky | P4 |

The key centres and main outline are bilaterally symmetric; connector details keep their fixed orientation. Each Choc footprint
has an asymmetric pin/support pattern, so its artwork and holes are **not**
mirrored. Identical PCBs need neither a backside flip nor a reversible footprint.
Anatomical key mapping changes on the right-hand copy. References, diode polarity
and physical scan wiring are identical on every manufactured copy.

The shaped half bounding box is **98.20 × 88.20 mm**, reducing only the outer
stationary frame. Actual cut-to-exterior land must meet the same 2.60 mm nominal /
2.20 mm adverse guard used for stationary rails. Switch cuts and pitch are unchanged.
Nominal board thickness is **1.2 mm**, two layers, 1 oz rigid FR-4.
No promotional-price eligibility is assumed. The
stock Ergogen KiCad 8 template is overridden by `npm run build:keyboard` so the
actual emitted PCB, not only the notes, specifies 1.2 mm.

The actual native panel is **98.20×99.475 mm**, with a shaped 60 mm-wide adapter
nested in a central notch. Two 5 mm mouse-bite tabs each have five Ø0.60 mm holes
at 1 mm pitch; nominal routed separation is 1.60 mm. Mount the XIAO on two six-pin
headers **after depaneling**, overhanging the narrow carrier; omit D0/5V contacts.
Proposed standoff ≥3 mm. Bare PCB size excludes the module/cable envelope. The
upright USB-C ports are 9.3 mm tall. Actual geometry is in `panel-fit.svg`,
`adapter.svg` and `choc5x4_panel.kicad_pcb`.

## Five-line charlieplex circuit

Every key occupies a different ordered pair of P0–P4, using all **5×(5−1) = 20**
pairs. `COL*` and `ROW*` are location metadata, not separate electrical matrix
wires. The table below shows **sense → active-low sink**:

| Row (top to bottom) | COL0 | COL1 | COL2 | COL3 | COL4 |
| --- | --- | --- | --- | --- | --- |
| r0 | P0→P4 | P1→P0 | P2→P1 | P3→P2 | P4→P3 |
| r1 | P0→P3 | P1→P4 | P2→P0 | P3→P1 | P4→P2 |
| r2 | P0→P2 | P1→P3 | P2→P4 | P3→P0 | P4→P1 |
| r3 | P0→P1 | P1→P2 | P2→P3 | P3→P4 | P4→P0 |

For every key, the current path is:

```text
sense Pn (input with pull-up)
   → switch pad 1 → closed contact → switch pad 2
   → unique K_COLx_ROWy net → diode anode (pad 2)
   → diode cathode (pad 1, band) → sink Pm (output LOW)
```

One sink is selected at a time, the other four lines are inputs with pull-ups;
release the sink to input before switching phases. No scan line should be driven
HIGH against another LOW output through pressed keys. This describes the circuit
intent, not tested firmware or a drop-in conventional row/column scanner.

The selected **XIAO SAMD21** exposes D1–D5 to the left port and D6–D10 to the
right. The adapter contains only XIAO headers, two full-24-contact USB4115-03-C
ports, GPIO/contact isolation resistors and TPD1E05U06 TVS. No extra regulator,
charge pump, reference, external pull-up or active protector. Normal XIAO USB
handles PC connection/power. Both half boards are passive.

Each socket groups A2+B2, A3+B3, A10+B10, A11+B11 and A8+B8, **after individual
1k contact resistors**. Adapter logical order P3/P2/P1/P0/P4 compensates the fixed
cable crossing in all four modeled plug orientations. All VBUS, CC, USB2 D+/D−
and GND contacts are NC. Adapter shells/TVS return to MCU GND; half shells/TVS
share SHIELD_H. Cable shell/ground bonding means this is not galvanic isolation.

The full key loop is **6k**, including mandatory resistors and parallel cable
branches. The minimum internal pull-up corner lacks guaranteed digital-low
margin. Stock ZMK charlieplex digital scanning does not qualify this network.
`npm run check:interface` writes the report and returns 2 while scan, rollover,
powered/unpowered faults and ESD qualification remain open. Series resistance
and TVS do not guarantee accidental-host safety. No final Gerbers are produced.

**Electrical rollover is open.** One diode per key does not eliminate all
forward multi-key paths. For example, pressing P0→P1 and P1→P2 can also produce a
P0→P2 reading. The [original charlieplex-input experiment](https://github.com/thanks4opensource/markoplexing)
discusses distinguishing one- and two-diode paths using analog sensing. A future
controller/scan design must establish voltage margins across current, temperature,
pull-up and MCU threshold tolerances, then validate simultaneous key presses.
An ADC/comparator solution would require five suitable bidirectional sensing pins.
No NKRO or ghost-free typing claim is made for the current circuit.

Diodes use a bottom-side SOD-523 land pattern: pad centres ±0.70 mm, pads
0.60×0.70 mm, review courtyard 2.35×1.30 mm. The lands follow the
[Diodes Inc. 1N4148WT data sheet](https://www.diodes.com/datasheet/download/1N4148WT.pdf).
The candidate **1N4148WT** is not a frozen electrical part. Confirm the
purchased part's package, polarity and assembly availability.
These SMD pads have bottom paste apertures; Choc's plated solder pads retain their
existing B.Cu/B.Mask-only layer set and no paste.

All other assembled components on both the half and adapter, including the
USB-C receptacles, GPIO/contact resistors and TVS diodes, occupy **B.Cu** with
bottom paste apertures. The sockets' contact positions are mirrored for bottom
mounting; nearby passives have been moved out of their assembly courtyards.
The switches and XIAO are fitted separately from the top. This targets
[JLCPCB Economic PCBA's single-side placement](https://jlcpcb.com/capabilities/pcb-assembly-capabilities).
Exact stocked parts, bottom-side placement data, stencil, handling of the cut
islands and connector eligibility still need assembly review once routing is
complete. The 9.3 mm USB-C bodies now project below the PCB, so the lower case
needs matching port access and depth.

## Flex, diodes and support

All switches retain the generated Choc V1/V2 cuts, holes and copper. The V1
plastic-post holes remain NPTH; signal and V2 support holes remain plated; the
V2 support has no pad number or net. Every switch's features share one moving
island and its two intentional folded beams. Each diode is on the **bottom of
its moving switch island**, at (+3.60, 0) mm from the switch centre in PCB
coordinates and rotated 90°. Ergogen uses `shift: [3.4, 0]` and `rotate: 90`.
The vertical package fits between the centre bore and right locating-post hole,
clear of the switch solder terminals. Its nearest pad-to-switch solder-copper
gap is approximately 1.84 mm, increased from 0.84 mm at the former position
between the centre bore and pad 2. This improves geometric separation for manual
switch soldering; iron access, solder bridging and heat exposure need a physical
assembly check. It crosses neither a cut nor another switch feature. Its courtyard is checked against those
features and the island boundary.

The complete 20-key emitted board is checked, including its 40 cutouts, actual
drills, all neighbouring rails, both beam paths per key, island necks, and the
conservative route/drill/outer-edge tolerance screen. It does not inherit a pass
from the earlier regular 3×3 arrangement.

Separate upper/lower gasket and rib **2D concepts** are regenerated to match the
staggered stationary grid. Moving-system envelopes follow the emitted contours,
including locator scallops, with 0.30 mm gasket and 0.50 mm rib relief. Both faces clear the upper-left connector/passive bay through a stepped relief
that follows the component groups. All 20 switch windows remain enclosed in
each final gasket and rib plan, including SW4 and SW8 next to the bay. The diode
bodies fit within the same moving-island windows on both faces. Small unsupported tongues that
detach during the 1.30 mm opening screen are deliberately omitted; omitted areas
are reported, and the checker rejects large omissions or lost perimeter pieces.
The resulting sheets remain connected. This is a geometric proposal, not proof
that all intended clamp loads are supported.

Mounts, internal clamp nodes, full case Z geometry, gasket material/compression,
solder access and 0.35–0.50 mm island hard stops still need mechanical design.
The candidate diode body can extend 0.65 mm below its mounting face before
solder stand-off. Keep island hard stops outside the diode courtyard and provide
clearance for the component plus island travel. Diode underside clearance and
the resulting load paths need explicit review. Do not place case ribs or stops
under free beams. Fatigue and neighbouring-key motion
need hardware coupons, with the final switch SKU and laminate.

## Artifacts and verification

Run `npm run review`. Outputs in `build/keyboard/` include the native-format
half/adapter schematics and **one unrouted PCB**, `choc5x4_panel.kicad_pcb`,
plus the footprint library, matrix CSV, exact key placements and offline
SVG/PNG/HTML drawings. `ergogen/config.yaml` contains only `pcbs.choc5x4_panel`;
all switches, diodes, interfaces and tabs are placed once. The half and adapter
are temporary review views made by copying exact panel footprint expressions
and net IDs, then substituting their existing perimeter outlines.
`board-outlines.json` records those derived perimeter edges. No separate half or
adapter PCB is generated or maintained. Extraction rejects unassigned or duplicate
components and routed copper until routing-aware depanel extraction is implemented. The PCB footprints carry matching
schematic paths for later native CAD work. The schematic embeds its symbols.

Checks trace wires, labels and actual embedded-symbol pins in the emitted
schematic and compare every switch/diode pin to emitted PCB pad nets. They reject
reversed diodes, duplicate directed pairs, self-pairs, broken wires and shorted
schematic labels. Generation is compared byte-for-byte before manufacturing
checks, so stale generated keyboard files are refused.

The [exact-input report](manufacturing-verification.md) records the result and
hashes source and emitted PCB/schematic inputs. The [constraint register](manufacturing-limitations.md)
contains findings K01–K26 and all prior footprint limitations. A geometric pass
is not native KiCad ERC/DRC, a routed copper check, CAM approval, fatigue life,
switch fit or a confirmed quote. KiCad CLI is unavailable in this workspace;
native load/save/ERC/DRC and export validation have not been performed.
