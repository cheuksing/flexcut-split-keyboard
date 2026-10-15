# Identical Choc 5×4 half: basic matrix revision

The keyboard uses two copies of **one PCB design**, with both component sides up.
There are 20 keys per half, 40 across the keyboard. The user's five-copy batch can
therefore use a single design. Adapter, connector and controller design are deferred.
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

The key centres and outer boundary are bilaterally symmetric. Each Choc footprint
has an asymmetric pin/support pattern, so its artwork and holes are **not**
mirrored. Identical PCBs need neither a backside flip nor a reversible footprint.
Anatomical key mapping changes on the right-hand copy. References, diode polarity
and physical scan wiring are identical on every manufactured copy.

The rounded rectangular half is **103.25 × 92.20 mm**, retaining 4 mm outside the
nominal key cells. Nominal board thickness is **1.2 mm**, two layers, 1 oz rigid
FR-4. Width exceeds 100 mm; no promotional-price eligibility is assumed. The
stock Ergogen KiCad 8 template is overridden by `npm run build:keyboard` so the
actual emitted PCB, not only the notes, specifies 1.2 mm.

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

Five GPIO per half is the confirmed **scan budget**. MCU pin numbers, transport,
USB, reset, power and any extra functions are not allocated yet. These passive
boards have no power circuit or selected connector. The adapter must keep their
scan banks distinguishable; directly paralleling identical P0–P4 banks would
alias matching keys.

**Electrical rollover is open.** One diode per key does not eliminate all
forward multi-key paths. For example, pressing P0→P1 and P1→P2 can also produce a
P0→P2 reading. The [original charlieplex-input experiment](https://github.com/thanks4opensource/markoplexing)
discusses distinguishing one- and two-diode paths using analog sensing. A future
controller/scan design must establish voltage margins across current, temperature,
pull-up and MCU threshold tolerances, then validate simultaneous key presses.
An ADC/comparator solution would require five suitable bidirectional sensing pins.
No NKRO or ghost-free typing claim is made for the current circuit.

Diodes use a bottom-side SOD-123 land pattern: pad centres ±1.65 mm, pads
0.9×1.2 mm, courtyard 4.7×2.3 mm, following
[KiCad's land dimensions](https://github.com/KiCad/kicad-footprints/blob/master/Diode_SMD.pretty/D_SOD-123.kicad_mod).
The implementation is independently written; the candidate **1N4148W** is not a
frozen electrical part. Confirm the purchased part's package and polarity.
These SMD pads have bottom paste apertures; Choc's plated solder pads retain their
existing B.Cu/B.Mask-only layer set and no paste.

## Flex, diodes and support

All switches retain the generated Choc V1/V2 cuts, holes and copper. The V1
plastic-post holes remain NPTH; signal and V2 support holes remain plated; the
V2 support has no pad number or net. Every switch's features share one moving
island and its two intentional folded beams. The diodes are on the **stationary
horizontal grid**, displaced +5 mm X and +9.525 mm Y in PCB coordinates from their
switches. Their complete assembly courtyards are checked against stationary
material after island/beam separation.

The complete 20-key emitted board is checked, including its 40 cutouts, actual
drills, all neighbouring rails, both beam paths per key, island necks, and the
conservative route/drill/outer-edge tolerance screen. It does not inherit a pass
from the earlier regular 3×3 arrangement.

Separate upper/lower gasket and rib **2D concepts** are regenerated to match the
staggered stationary grid. Moving-system envelopes follow the emitted contours,
including locator scallops, with 0.30 mm gasket and 0.50 mm rib relief. The lower
plans also clear the diode courtyards and bodies. Small unsupported tongues that
detach during the 1.30 mm opening screen are deliberately omitted; omitted areas
are reported, and the checker rejects large omissions or lost perimeter pieces.
The resulting sheets remain connected. This is a geometric proposal, not proof
that all intended clamp loads are supported.

Mounts, internal clamp nodes, full case Z geometry, gasket material/compression,
solder access and 0.35–0.50 mm island hard stops still need mechanical design.
The thinner lower support paths after diode relief need explicit review. Do not
place case ribs or stops under free beams. Fatigue and neighbouring-key motion
need hardware coupons, with the final switch SKU and laminate.

## Artifacts and verification

Run `npm run review`. Outputs in `build/keyboard/` include the native-format
schematic and unrouted PCB, matching footprint library, matrix CSV, exact key
placements and offline SVG/PNG/HTML drawings. The PCB footprints carry matching
schematic paths for later native CAD work. The schematic embeds its symbols.

Checks trace wires, labels and actual embedded-symbol pins in the emitted
schematic and compare every switch/diode pin to emitted PCB pad nets. They reject
reversed diodes, duplicate directed pairs, self-pairs, broken wires and shorted
schematic labels. Generation is compared byte-for-byte before manufacturing
checks, so stale generated keyboard files are refused.

The [exact-input report](manufacturing-verification.md) records the result and
hashes source and emitted PCB/schematic inputs. The [constraint register](manufacturing-limitations.md)
contains findings K01–K09 and all prior footprint limitations. A geometric pass
is not native KiCad ERC/DRC, a routed copper check, CAM approval, fatigue life,
switch fit or a confirmed quote. KiCad CLI is unavailable in this workspace;
native load/save/ERC/DRC and export validation have not been performed.
