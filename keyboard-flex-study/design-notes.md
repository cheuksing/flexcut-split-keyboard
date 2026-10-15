# Per-key keyboard PCB flex cuts

All manufacturing, physical, compatibility and assembly findings are maintained
in [the constraint register](../docs/manufacturing-limitations.md). Run
`npm run check` after every design revision; the exact-input results are in
[the verification report](../docs/manufacturing-verification.md).

## Recommended construction

- Use 1.2 mm, two-layer FR-4.
- Keep every switch and both solder pads on one rigid local island.
- Connect that island to the stationary PCB grid with two folded beams.
- Use a 1.35 mm nominal beam width. Flare both the island root and stationary-grid anchor to 2.0 mm over a 1.0 mm length.
- Use 0.55 mm minimum router radii at beam roots, anchors, and direction changes, 0.75 mm minimum radii around blended island lobes, and 1.5 mm radii at the cell-opening corners. Every value exceeds the 0.50 mm physical radius of a 1.0 mm routing cutter.
- Resolve the stationary grid, anchor flares, beams, root flares, pad lobes, locating-hole lobes, and center island as one retained-PCB shape before creating `Edge.Cuts`. Do not leave overlapping artwork primitives as the final fabrication boundary; their intersection points create cusp-like corners even when the individual primitives are rounded.
- Use 1.20 mm nominal straight channels between the completed retained shape and nearby fixed PCB. This leaves 0.20 mm dimensional margin over JLCPCB's 1.0 mm minimum for the Regular process.
- Retain a 2.0 mm half-rail at each 19.05 mm cell edge. Two adjacent cells therefore form a 4.0 mm-wide stationary grid. This grid must remain substantially stiffer than the flex beams.
- Use 0.40 mm copper-to-route clearance around the isolated pad lobes. JLCPCB publishes 0.20 mm as the routed-edge minimum.
- Join every pad and locating-hole lobe to the main switch island with an explicit rounded neck at least 2.0 mm wide. Small accidental overlaps between primitive shapes are not acceptable structural connections.
- Add a case hard stop 0.35–0.50 mm below the rigid island.

At identical geometry, 1.2 mm FR-4 has about 42% of the bending stiffness of 1.6 mm FR-4 because plate and beam stiffness scale approximately with thickness cubed. A 1.6 mm version is useful as a durability control, but it will be roughly 2.37 times as stiff.

## Footprint-specific layouts

### Cherry MX

Reference coordinates in millimetres, relative to the switch center:

- Main locating hole: 3.99 mm diameter at (0, 0)
- Side locating holes: 1.70 mm diameter at (−5.08, 0) and (5.08, 0)
- Pad 1: (−3.81, −2.54), 2.30 mm pad, 1.524 mm drill
- Pad 2: (2.54, −5.08), 2.30 mm pad, 1.524 mm drill

Two diagonal folded beams fit around these features. Pad 1 and pad 2 receive full retained lobes; pad 1 must not extend over the routed area. Blend the side locating-hole and pad lobes into the central island as one contour, using 2.0 mm minimum necks and 0.75 mm minimum concave radii. The two beam roots are placed in the clear lower-left and upper-right quadrants so the reinforced pad lobes do not shorten a free beam. Generate the black cutout as a 1.20 mm offset of the blended contour. The surrounding cut enters the space outside the 14 mm switch envelope while preserving the shared stationary rail.

### Kailh Choc V1 / V2

The combined PG1350 / PG1353 footprint now includes both V1 locating posts and the separate V2 metal support. Coordinates are component-side, +X right and +Y down:

| Feature | X | Y | Finished hole / slot | Copper |
| --- | ---: | ---: | --- | --- |
| Common center NPTH | 0 | 0 | Ø5.10 mm, sized for V2 | None |
| V1 left plastic locating post | -5.50 | 0 | Ø1.90 mm NPTH | None |
| V1 right plastic locating post | 5.50 | 0 | Ø1.90 mm NPTH | None |
| Electrical pad 1 | 5.00 | -3.80 | Ø1.45 mm plated | Ø2.30 mm, bottom only |
| Electrical pad 2 | 0 | -5.90 | Ø1.45 mm plated | Ø2.30 mm, bottom only |
| V2 solderable mechanical support | -5.00 | 5.15 | 1.50 × 3.00 mm plated capsule slot | 2.40 × 3.90 mm bottom capsule; no number/net |

The two V1 holes are plastic-post holes, not solder pads. They must be drilled through retained moving PCB. Each has a Ø3.00 mm retained lobe, leaving about 0.55 mm radial FR-4 to the cut; each lobe joins the center island through a 2.0 mm neck with smooth fillets. Both electrical pads and the V2 support pad move with the same island. The 5.10 mm center opening clears V2's larger boss and consequently provides a loose center fit for V1; V1's side posts and soldered terminals locate it.

Kailh's V1 drawing specifies the electrical pad at (0, -5.90), not the earlier study's -6.00. The corrected combined pattern uses -5.90. The drawing identifies Ø1.90 mm V1 post holes 11.0 mm apart. V2 has no matching plastic posts; those two NPTHs are simply unused for V2.

The V2 plated slot was lengthened from 2.0 to 3.0 mm because JLCPCB currently specifies plated slot length at least twice its width. Its position still encompasses the earlier 1.5 × 2.0 mm support aperture. The bottom copper pad has a 0.45 mm annular ring. Use an unnumbered mechanical through-hole pad, no assigned net, B.Cu/B.Mask copper only. Export the slot in the plated drill file, never on `Edge.Cuts`. A KiCad oval is a capsule; the contour generation now uses the same capsule geometry, rather than an ellipse.

Beam roots move from approximately Y = ±3.1 to ±3.75 mm to clear the new side lobes. The intended straight channels are 1.20 mm; final routed regions are generated from the entire retained shape and rounded with a 0.55 mm finishing radius. The regenerated footprint has two closed routed regions and one connected retained PCB. Checks against the emitted lines/arcs measure at least approximately 0.548 mm FR-4 around the V1 posts and 0.398 mm copper-to-route clearance. The smooth geometric source measures approximately 0.550 mm and 0.400 mm respectively; the difference is the documented curve-fitting tolerance.

At 19.05 mm pitch, adjacent V1 lobes scallop both sides of a shared rail: 19.05 − 2 × (5.50 + 1.50 + 1.20) = **2.65 mm**, rather than 4.0 mm at that local section. The upper electrical-pad scallop leaves approximately 2.875 mm in the corrected -5.90 mm layout. Support the 2.65 mm local rail with matching case ribs. Relieve the continuous gasket sheet around these scallops: with 0.30 mm clearance on each side, its local web is approximately 2.05 mm. A uniform 3.4 mm web is suitable only over the unscalloped 4.0 mm rail. Keep every switch in the same rotation.

This is the combined standard PG1350 V1 / PG1353 V2 solder footprint without an LED aperture. Validate the exact purchased switch against its manufacturer drawing; other low-profile Kailh series are not covered.

### Gateron KS-27 / KS-33 low profile

Reference coordinates:

- Main opening: 5.1 mm diameter at (0, 0)
- Pad 1: (−4.4, 4.7), 2.30 mm pad, 1.45 mm drill
- Pad 2: (2.6, 5.75), 2.30 mm pad, 1.45 mm drill

Both pads occupy the lower portion of the cell. Use two mirrored folded beams in the clear upper half, anchored to the left and right grid. Blend both pad lobes into one smooth island contour with rounded 2.0 mm minimum necks, then create the cutout by offsetting that contour 1.20 mm. Trying to force a diagonal lower beam between pad 2 and the grid leaves less than the required 1.20 mm routed gap and creates an unreliable thin web. The lower local rail is approximately 3.025 mm wide.

## Copper routing

- Do not place vias, copper pours, diode bodies, or solder joints on the flex beams.
- If possible, route one switch net through each beam so no beam needs more than one trace.
- Use a 0.25–0.30 mm trace near the beam centerline.
- Use curved or 45-degree trace direction changes and teardrop the trace where it enters the island and stationary grid.
- Widen traces only after they leave the flex beam.

FR-4 and surface copper are not intended as unlimited-cycle flex materials. The hard stop is essential because keycap installation, switch removal, and impacts can apply much more load than an ordinary keypress.

## Gasket and case

Use a waffle-shaped gasket and matching case ribs centered on the 4.0 mm-wide stationary grid at the 19.05 mm cell boundaries:

1. Upper case grid
2. TPU gasket
3. Stationary PCB grid
4. TPU gasket
5. Bottom case grid with hard stops

The TPU must not touch a switch island or flex beam at rest. Give every moving opening about 0.5 mm lateral clearance. Use the same support around edge keys as interior keys. A solid TPU sheet would couple neighboring keys and damp the intended local motion.

The outside perimeter of the keyboard is not shared by two cells. In the 3×3 example it is 6.0 mm from routed opening to board edge, providing room for mounting and a stiff perimeter.

## 3 × 3 assembled example

Nine keys at 19.05 mm pitch occupy a 57.15 × 57.15 mm cell field. Adding 4.0 mm outside that field on every side gives a 65.15 × 65.15 mm PCB.

The routed opening inside each cell is 15.05 × 15.05 mm. Neighboring openings are separated by a continuous 4.0 mm PCB rail. Use 1.5 mm true arc radii at the opening corners so the four-key grid intersections retain additional material. The detailed switch drawings and the 3 × 3 drawing use the same rounded opening geometry. The distance from an outside routed opening to the board edge is 6.0 mm: the cell's 2.0 mm half-rail plus the added 4.0 mm perimeter margin.

The two gaskets are each one connected sheet covering the complete keyboard. They are not nine individual gaskets. Give each sheet nine 15.65 mm windows on the 19.05 mm pitch:

- Internal TPU web: 3.40 mm wide
- Clearance from each edge of a 4.0 mm PCB rail: 0.30 mm
- Gasket border outside the outer window: 5.70 mm
- Suggested starting thickness: 0.6–1.0 mm, using relatively firm TPU such as 95A
- Suggested assembled compression: approximately 10–15%

The upper and lower case need matching continuous ribs above and below the 4.0 mm PCB grid. Without those ribs, even a wider rail can act as a second spring and move neighboring keys. Add rigid compression bosses at the four internal grid crossings of the 3×3 matrix; these bosses set the gasket compression and prevent the center of the lattice from floating. Mounting screws or posts belong in the 6.0 mm outer PCB border or at the enlarged grid intersections, never on a moving island.

Keep all switches in the same rotation. Electrical-pad scallops in the Choc and Gateron layouts then occur on only one side of each shared boundary. Choc V1 locating-hole scallops face each other even at the same orientation; their 2.65 mm shared rail is accounted for above.

## Prototype coupon

Before ordering a full keyboard, make a 3 × 3 key coupon:

- Row 1: 1.15 mm beams
- Row 2: 1.35 mm beams
- Row 3: 1.55 mm beams

Keep slot width, island geometry, gasket, and hard-stop clearance identical. The 1.35 mm row is the recommended starting point. Inspect the beam roots and copper after repeated presses and several keycap installation/removal cycles.

## KiCad and fabrication

- Draw each removed region as a closed contour on `Edge.Cuts`; do not rely on a thick graphic centerline.
- Make the narrowest internal routed opening 1.20 mm nominal in this design; JLCPCB's published fabrication minimum is 1.0 mm.
- Use true lines and arcs, or a CAD curve converted to them, rather than a visibly faceted polygon. Use at least 0.55 mm radius at beam-root and anchor transitions, 0.75 mm around island-lobe blends, and 1.5 mm at the cell-opening corners.
- Merge every retained feature first, including both beam-end flares and the stationary grid. Generate the two closed routed regions for each key from the complement of that merged shape. Applying fillets to the final routed contours eliminates the otherwise-hidden cusps where reinforcement overlaps the island or grid.
- Use rounded slot ends and close every contour.
- Run copper clearance checks against the actual routed contour. The revised pad lobes use 0.40 mm nominal copper clearance.
- Inspect JLCPCB's Gerber preview to confirm that black regions in the design preview become internal routed openings.
- Select the normal `±0.20 mm (Regular)` board-outline tolerance for a low-cost prototype. At the exposed solder-pad lobes, a route displaced 0.20 mm toward the copper still leaves 0.20 mm, which is JLCPCB's published routed-edge minimum. The optional ±0.10 mm service gives more process margin and tighter beam-width control, but the geometry does not require it.

## JLCPCB capability check

Checked against JLCPCB's published rigid-PCB capabilities on 2026-10-15:

| Item | JLCPCB published capability | This design |
| --- | --- | --- |
| PCB construction | 1.2 mm two-layer FR-4 available | 1.2 mm, two layer |
| Non-plated routed slot | 1.0 mm minimum | 1.20 mm nominal minimum routed channel |
| Copper to routed edge/slot | 0.20 mm minimum | 0.40 mm around exposed pad lobes |
| Non-plated hole | 0.50 mm minimum | Choc V1 locating holes Ø1.90 mm; center Ø5.10 mm |
| Plated slot (2-layer) | ≥0.50 mm width; length ≥2× width | Choc support 1.50 × 3.00 mm |
| PTH annular ring (1 oz, 2-layer) | Recommended ≥0.25 mm | Choc support 0.45 mm; signal pads 0.425 mm |
| Non-plated slot tolerance | ±0.20 mm regular | Use ±0.20 mm regular; ±0.10 mm is optional |
| High-precision routing eligibility | At least 50 × 50 mm and three ≥1.5 mm tooling holes in different corners | 65.15 × 65.15 mm and four 2.0 mm corner holes |
| Cutter radius implied by 1.0 mm route | 0.50 mm | 0.55 mm minimum final-contour fillets; 0.75 mm island blends; 1.5 mm cell corners |
| Rectangular internal slots | Unsupported without rounded corners | No square internal corners or primitive-intersection cusps |

The geometric capability check passes. A final manufacturing pass still has to be run on the actual KiCad `Edge.Cuts`, drill, and copper Gerbers because this preview is a dimensioned topology, not the fabrication data itself.

## Low-cost order setup

For the JLCPCB promotional prototype price, use the ordinary two-layer process: 1.2 mm FR-4, 1 oz copper, regular ±0.20 mm board-outline tolerance, and no controlled-impedance or other advanced options. Regular is JLCPCB's normal/default routing tolerance and has no precision-option surcharge. The advertised USD 2 price is a starting board price rather than a guaranteed delivered total; shipping, tax, current promotion eligibility, and any fee assigned after review of the many internal routed contours are shown by the live quote after the fabrication Gerbers are uploaded.

## Sources

- JLCPCB PCB capabilities: https://jlcpcb.com/capabilities/pcb-capabilities
- JLCPCB flex-routing guidance: https://jlcpcb.com/blog/flex-pcb-design-guide
- ai03 MX_V2 footprint library: https://github.com/ai03-2725/MX_V2
- Kailh PG1350 V1 manufacturer drawing (CPG135001D03, page 1): https://cdn-shop.adafruit.com/product-files/5114/5114_CPG135001D03.pdf
- Kailh PG1353 V2 manufacturer drawing (CPG135301D01, page 1): https://cdn.shopify.com/s/files/1/0657/6075/5954/files/SPEC-CPG135301D01_Kailh_Choc_V2_Low_Profile_Red_Switch.pdf?v=1666690444
- Kailh V2 datasheet index: https://www.kailh.net/pages/product-datasheet
- Gateron KS-33 drawing: https://gateron.com/u_file/2311/10/file/GATERONKS-33LowProfile20RedSwitchBlackBottomHousing-KS-33H10B050NN-Y24.pdf
