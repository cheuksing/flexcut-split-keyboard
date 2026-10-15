# Per-key keyboard PCB flex cuts

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

The combined footprint uses the Choc V2 center opening and the common electrical pin positions:

- Main opening: 5.1 mm diameter at (0, 0)
- Solderable support slot: approximately 1.5 × 2.0 mm plated slot at (−5.0, 5.15), inside a 2.5 × 3.0 mm copper pad
- Pad 1: (5.0, −3.8), 2.30 mm pad, 1.45 mm drill
- Pad 2: (0, −6.0), 2.30 mm pad, 1.45 mm drill

Pad 2 is the limiting feature. Its 1.20 mm routed moat makes a local notch in one side of the 4.0 mm shared rail. With every switch kept in the same rotation, only one side of a boundary is notched and approximately 2.775 mm of shared rail remains. The support slot is a mechanical plated-through pad so the pin can be soldered, but it remains electrically unconnected. Give it a 2.5 × 3.0 mm oval copper pad, a 1.5 × 2.0 mm plated slot, and approximately 0.5 mm copper annular ring. The retained PCB lobe is about 3.32 × 3.82 mm, leaving at least 0.40 mm nominal copper-to-route clearance. Blend all three solderable lobes into one island contour with rounded 2.0 mm minimum necks; do not leave primitive-intersection cusps beside the lobes. Confirm the support-pin pattern of the exact Choc SKU before ordering.

In KiCad, implement the support feature as a through-hole pad with an oval plated drill and an empty pad number. Enable copper on both outer layers but assign no net and place no trace to it. Do not draw this plated slot on `Edge.Cuts`; it belongs in the plated drill output.

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

Keep all switches in the same rotation. Choc and Gateron pad-clearance notches then occur on only one side of each shared boundary. Rotating alternate switches can place two notches opposite one another and unnecessarily weaken the rail.

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

Checked against JLCPCB's published rigid-PCB capabilities on 2026-10-14:

| Item | JLCPCB published capability | This design |
| --- | --- | --- |
| PCB construction | 1.2 mm two-layer FR-4 available | 1.2 mm, two layer |
| Non-plated routed slot | 1.0 mm minimum | 1.20 mm nominal minimum routed channel |
| Copper to routed edge/slot | 0.20 mm minimum | 0.40 mm around exposed pad lobes |
| Non-plated hole | 0.50 mm minimum | Smallest switch locating hole is approximately 1.5 mm |
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
- Kailh Choc V2 datasheet: https://www.kailhswitch.com/uploads/15927/files/CPG1353S01D01-01-data-sheet.pdf
- Gateron KS-33 drawing: https://gateron.com/u_file/2311/10/file/GATERONKS-33LowProfile20RedSwitchBlackBottomHousing-KS-33H10B050NN-Y24.pdf
