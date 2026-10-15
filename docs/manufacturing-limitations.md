# Manufacturing, physical, and design limitations

This is the project's constraint register, including findings from the complete
design discussion. Recheck it after every design revision. The latest numeric
results are in [manufacturing-verification.md](manufacturing-verification.md).

Last manufacturer-source review: **2026-10-15**. Scope: soldered switches,
plateless mounting, two-layer 1 oz rigid FR-4, primarily 1.2 mm thickness,
19.05 mm key pitch, JLCPCB Regular routing, and one continuous gasket per side.
These are rigid PCBs with cutouts, not polyimide flex PCBs.

## Verification after every change

Run `npm run check` after every design change; `npm run review` runs the same
check before regenerating review files. Both inspect **all three footprints**.
Do not substitute the old Choc-only generator check for this verification.

The automated checks use actual emitted pad/drill shapes and sampled analytic
`Edge.Cuts`, then construct a complete 3×3 board with the holes subtracted. They
check tool access, rounded contours, copper and drill clearances, plated-slot
dimensions, annular rings, connected islands, narrow bridges, rigid island necks,
adjacent-key rails, and a conservative routing/drill tolerance screen. The report
has an input SHA-256 so its results cannot be assumed to apply to later geometry.
Starting a new manufacturing run invalidates the previous report first. An
interrupted run, stale footprint or missing dependency therefore leaves a stale
notice instead of an old pass. A completed failing run writes its failures.

Verification labels below:

- **Automatic:** checked by `npm run check` on the emitted geometry or footprint API.
- **Screen:** a geometric proxy or conservative tolerance calculation; not a strength rating.
- **Manual / pending:** needs final CAD, CAM review, order settings, or hardware.

Numeric policy is in [manufacturing-rules.json](../scripts/lib/manufacturing-rules.json).
Project guards are deliberately distinguished from JLCPCB's published capabilities.
Do not reduce them merely to accept a regression. A failed check needs a correction
or an explicitly documented engineering reassessment.

## Manufacturer capabilities and process findings

The primary source for M01–M12 is [JLCPCB's capabilities table](https://jlcpcb.com/capabilities/Capabilities).
The table is reviewed when process, material, thickness, copper weight, precision,
or hole strategy changes, and again before an order. It is not fetched silently
during each offline check, so a website change cannot silently alter the rules.

| ID | Finding and consequence | Verification |
| --- | --- | --- |
| M01 | Non-plated routed openings: **1.0 mm minimum**. Our straight channels target **1.20 mm**, rather than the fabrication minimum. Slots, closed ends and turns must admit a 1.0 mm cutter. | Automatic tool sweep and connected cutter-centre domains. The 1.20 mm straight-channel target needs inspection where redesigned; rounded ends need not be 1.20 mm circles. |
| M02 | A 1.0 mm cutter has **0.50 mm radius**. Square internal corners and narrow pointed cutout extensions are impossible. Final contours use about **0.55 mm minimum fillets**, with larger island blends and 1.50 mm main-opening corners. | Automatic emitted arc guard ≥0.5399 mm, cutter accessibility, and coarse sharp-joint rejection. The 0.5399 guard accommodates source quantization/fitting; it is above the cutter radius. |
| M03 | Regular CNC outline tolerance is **±0.20 mm**; Precision is **±0.10 mm**. Non-plated slot tolerance is ±0.20 mm. Do not treat either as zero error, or assume every edge error is independent/correlated in the same way. | Screen: grow each routed region by 0.20 mm; subtract 0.40 mm from opposing rail widths. CAM confirmation of datums/error correlation remains pending. |
| M04 | Copper to routed edge/slot: **≥0.20 mm nominal**. The study targets about 0.40 mm; automatic regression guard is 0.39 mm after curve reconstruction. **Correction to earlier wording:** a measured 0.398–0.399 mm gap minus a full 0.20 mm adverse offset is marginally below 0.20 mm. Nominal DFM passes; guaranteed finished clearance has not been demonstrated. | Automatic nominal checks plus explicit warning on the adverse screen. Add clearance or obtain CAM confirmation before claiming a guaranteed minimum. Copper pours, traces and vias on a complete keyboard still need native DRC. |
| M05 | Two-layer plated slots: **width ≥0.50 mm and total length ≥2× width**. The earlier **1.50 × 2.00 mm** support slot missed the length/width guidance; the current slot is **1.50 × 3.00 mm**. Lengthening it also requires a longer copper pad and retained PCB lobe. | Automatic minimum width and length/width check on the actual emitted drill. |
| M06 | Hole and plated-slot tolerance: **+0.13 / −0.08 mm**. Hole fit must use finished dimensions; plastic and metal pin tolerances also matter. | Automatic conservative connectivity screen expands drills by 0.065 mm radius. Exact SKU pin fit remains manual; the screen is not a registration model. |
| M07 | Non-plated hole diameter: **≥0.50 mm**. Current locating holes are larger. Use NPTH drill features for plastic posts. | Automatic drill dimensions/type and retained-hole-land checks. |
| M08 | For two-layer 1 oz PTH annular rings, JLCPCB recommends **≥0.25 mm** and lists 0.18 mm as the absolute minimum. Keep the recommended margin. Current signal rings are about 0.425 mm (MX 0.388 mm); Choc support ring is 0.45 mm. | Automatic actual drill-to-copper boundary distance, including oval ends. |
| M09 | Pad-hole to pad-hole spacing: **≥0.45 mm**. Hole spacing must be checked as edge distance, not centre distance. | Automatic all drill pairs. |
| M10 | Round drill range for two-layer boards is normally **0.15–6.30 mm**; very small drills can cost extra and have process restrictions. Holes ≥6.3 mm are CNC routed. Current holes avoid these extremes. | Automatic lower limits; changes near/above 6.3 mm require routing/process review. |
| M11 | 1.2 and 1.6 mm FR-4 are offered. Thickness ≥1.0 mm has **±10% thickness tolerance**. Board thickness changes both fit and stiffness. | Manual order/stackup verification; footprints cannot set board thickness. |
| M12 | High-precision routing requires a board at least **50 × 50 mm** and ≥3 tooling holes of ≥1.5 mm on different corners. The 65.15 mm 3×3 example with four 2.0 mm corner holes can meet this; a 27.05 mm single-key review coupon cannot meet the size condition. | Manual on final board and order. Regular is the selected/default process. |
| M13 | JLCPCB's [narrow-connection handling advice](https://jlcpcb.com/blog/how-to-prevent-breakage-of-traces-during-board-bending) says **>1 mm width and ≤30 mm length**, with widening for longer connections, in its **depaneling context**. This is relevant breakage advice, not a universal flex-beam acceptance rule or fatigue specification. | Project bridge-width screen; actual panelization, beam handling, maximum unsupported spans and CAM acceptance remain pending. Do not apply polyimide FPC tab rules to rigid FR-4 beams. |
| M14 | Board edges and slot outlines must be closed, non-self-intersecting fabrication contours. Plated support slots belong in PTH drill output; NPTH posts in NPTH output. Rectangular/oval copper artwork alone does not create a hole. | Automatic source/emitted loops and drill types; native Gerber/PTH/NPTH export review pending. |
| M15 | Relevant future routing limits for 1 oz, two layers: 0.10 mm track/spacing capability; track width tolerance ±20%. Green mask dam/pad spacing 0.10 mm; black/white 0.13 mm; mask opening to neighbouring trace ≥0.09 mm. These are manufacturing limits, not our beam-trace targets. | Pending: no keyboard traces/pours have been routed. Check final CAD rules; do not mark an unrouted board as passing these rules. |
| M16 | JLCPCB's NPTH **copper** annular-ring recommendation (0.45 mm) concerns copper placed around NPTHs. It is different from our minimum **FR-4 land** around a copper-free locating hole. | Automatic NPTH size equals drill size; project FR-4 land rule below. Do not confuse either quantity with a plated annular ring. |

## Physical behaviour and fragility

These are engineering limitations and project design targets. They are **not
JLCPCB guarantees**. A minimum machinable opening says nothing about the lifetime
of the material remaining beside it.

| ID | Finding and consequence | Verification |
| --- | --- | --- |
| P01 | At identical geometry, bending stiffness scales approximately with thickness cubed. A 1.2 mm board has about **42%** of the stiffness of 1.6 mm; 1.6 mm is about **2.37× stiffer**. | Analytical relationship; final laminate properties and boundary conditions need testing. |
| P02 | ±10% thickness means roughly **0.729–1.331×** bending stiffness from thickness alone. Width, fibre direction, resin, copper, beam length and clamp conditions also affect feel. Geometry equality does not guarantee identical key feel. | Manual laminate/order review and force/displacement measurements. |
| P03 | Intentional flex beams and stationary rails have different purposes. A thin rail between keys becomes a second spring, couples neighbours, and may break during handling. | Automatic 3×3 rail distance: project nominal guard **≥2.60 mm**, adverse two-edge screen **≥2.20 mm**. These are project guards; stiffness and neighbour motion remain hardware tests. |
| P04 | Beam centreline width targets **1.35 mm**; the construction uses **2.0 mm wide × 1.0 mm long root/anchor flares**. Rounded roots/folds change effective free length and local width. Excessively wide reinforcement can stiffen/shorten the spring; excessively small connections can fracture. | Screen: all 18 routed regions stay separate and the 3×3 board stays connected after eroding retained edges by 0.65 mm. This guards both paths at **1.30 mm**, without claiming an exact local width/stiffness measurement. |
| P05 | Pad and locator lobes must belong to one rigid island through deliberately sized necks, not tiny overlaps between shapes. Target **2.0 mm necks**. | Screen: erode un-drilled retained PCB by 0.98 mm and confirm every pad/post centre still shares the same island component. **1.96 mm** guard allows reconstruction error; it is not a stress analysis. |
| P06 | Retain about **0.50 mm or more FR-4** around NPTH locating holes. This is a handling target, not the fab's NPTH copper-ring rule. Choc V1 posts retain approximately 0.55 mm. | Automatic nominal guard **≥0.49 mm** after reconstruction, plus actual drilled-board and adverse-tolerance connectivity. |
| P07 | FR-4 and ordinary PCB copper are not unlimited-cycle flex materials. Stress concentrates at roots, abrupt widths, sharp corners and copper transitions. | Geometric arc/joint checks only. Fatigue, copper cracking, delamination and residual set remain physical tests. No cycle-life rating is established. |
| P08 | Keycap installation/removal, switch handling, impacts and twisting can load the board much more than a normal keypress. Solder joints are also load paths in a plateless build. | Manual: hard stop **0.35–0.50 mm** below the rigid island; support island during assembly. Never put the stop under a free beam. |
| P09 | A PCB can be topologically connected yet mechanically fragile. Conversely, a solid shortcut from island to grid defeats the intended spring. | Automatic single/3×3 connectivity, preservation of two cut regions/key, bridge erosion guard, and island separation from grid in the wider-neck erosion test. Load capacity remains unverified. |
| P10 | Increasing flexibility and strength simultaneously has limits; widening a beam increases stiffness as well as strength. Lengthening it can increase compliance but changes stress and travel. | Manual design tradeoff. Coupon comparison suggested earlier: 1.15/1.35/1.55 mm beams. **1.15 mm is experimental and intentionally fails the current 1.30 mm production-review guard**; any coupon needs its own documented policy. |
| P11 | Copper on a bending beam contributes stiffness and can fatigue. Vias, joints, diodes and sharp trace turns on a beam concentrate stress. | Pending routed board: one 0.25–0.30 mm trace near each beam centreline where practical; curved/45° transitions and wider traces only on rigid regions. No beam pours/vias/components. |

## Assembly, geometry and compatibility findings

| ID | Finding and consequence | Verification |
| --- | --- | --- |
| D01 | Switch pitch is **19.05 mm**. The early **14 mm square is a switch/plate guide**, not a guaranteed pad-free zone or the full housing envelope. Cutouts may enter it only where the exact footprint permits; they also extend into the surrounding cell area. | Automatic pad/hole-to-cut checks. Exact housing/solder-tool clearance remains manual. F.Fab guides use approximately 15 mm for Choc/KS-33 and 15.6 mm for MX. |
| D02 | A fully closed square moat without retained beams disconnects the key island. The early black preview also obscured this. Removed PCB must be black, bottom-layer (B.Cu) copper blue, and retained board visibly distinct. The user-selected blue display convention identifies the bottom-only switch solder pads; top-layer copper, if present in a preview, is red. | Automatic connectivity and existing web-preview colour assertion; offline visual review of actual emitted geometry after changes. Colour is a display convention, not fabrication data. |
| D03 | Overlapping circles, rectangles and rounded strokes can create sharp cusp boundaries at pad lobes and beam reinforcement. Rounded primitives do not imply a smooth combined boundary. | Resolve the entire retained island/beam/root/grid shape before cut contours. Automatic cutter/joint checks; native true arcs and visual review remain required. |
| D04 | An SVG ellipse is **not** a KiCad oval. KiCad ovals are capsules; their diagonal extent can cut into clearances overlooked in an ellipse preview. The prior 2.5 × 3.0 mm ellipse-to-capsule conversion lost margin. | Automatic exact circle/capsule pad and drill geometry, including support ends. Current support: **2.4 × 3.9 mm copper**, **1.5 × 3.0 mm slot**, 0.45 mm ring, no net/number. |
| D05 | Each switch, both electrical pads, every plastic post and solderable support must move together on one island. Reinforcing these intra-island links should not add a new connection to the stationary grid. | Automatic lobe/core and two-path connectivity checks; inspect deformation and effective free-beam length on the coupon. |
| D06 | A complete keyboard repeats keys, so an isolated key drawing cannot establish neighbour independence. Edge and centre keys must use comparable supports. | Automatic **3×3** examples for all three footprints, with 4.0 mm outer cell margin; inspect edge and centre key force/displacement physically. |
| D07 | The nominal shared stationary lattice is **4.0 mm** (2.0 mm from each cell). Footprint scallops reduce local width. Current minima are about **3.69 mm MX**, **3.03 mm KS-33**, **2.65 mm Choc**. | Automatic minimum distance between actual horizontal/vertical neighbour cutouts, not just one hand-picked section. |
| D08 | The two TPU gaskets are **whole-keyboard connected sheets** with windows over moving islands/beams, not individual per-key rings and not solid unperforated sheets over moving PCB. A solid sheet couples/damps islands. Earlier starting suggestions were **0.6–1.0 mm TPU**, approximately **95A**, with **10–15% compression**; these are unvalidated tuning values, not material specifications or verified limits. | Manual gasket CAD and assembled clearance test; no production gasket model exists yet. |
| D09 | Sandwich: upper case → TPU → PCB stationary grid → TPU → lower case. Matching rigid ribs and four internal clamp/compression nodes in the 3×3 example prevent the middle lattice floating. | Pending case CAD. Gasket alone cannot be credited with rail rigidity; case ribs, outer mounts and clamp nodes need explicit geometry. |
| D10 | Standard gasket web is **3.4 mm** over a 4.0 mm PCB rail, leaving 0.30 mm per edge. At Choc's 2.65 mm local rail, relieve the same continuous sheet to about **2.05 mm**. Windows must follow scallops. | Automatic rail-derived available web; manual actual gasket/rib overlap and moving-part clearance (about 0.5 mm target). |
| D11 | The key field is **57.15 × 57.15 mm** for 3×3; adding 4 mm outside each edge gives **65.15 × 65.15 mm**. Nominal opening-to-outer-edge distance is 6 mm, but local scallops reduce it. | Automatic repeated geometry and perimeter checks. Do not quote 6 mm as the minimum everywhere. Single-key review coupon is a different 27.05 mm square. Mounts belong on stationary perimeter/grid intersections, not moving islands. The proposed four corner Ø2.0 mm holes leave about 2.0 mm edge material in the illustrated 65.15 mm board; those mount holes are not emitted by the switch footprints. |
| D12 | Keep switches consistently rotated. Alternating rotations can face pad scallops and weaken a shared rail. Choc V1 locator scallops already face each other even at the same orientation. | Automatic current fixed-orientation 3×3 only. Rotations, mixed switch neighbours, staggered layouts and changed pitch require new arrangement checks. Do not scale the footprint to fit smaller pitch. |
| D13 | Combined Choc must include **V1's Ø1.90 mm NPTH posts at (±5.50, 0)** as well as V2's larger centre and separate metal support. The earlier V1/V2 label was wrong while the posts were missing. | Automatic explicit V1 post and V2 mechanical-pad regression tests plus all-feature island checks. |
| D14 | The **Ø5.10 mm** common centre hole accommodates V2 but is loose around V1's smaller boss. V1 relies on its side posts and soldered terminals for location. Solderable V2 metal support is unnumbered/no-net; V1 plastic posts are not solder pads. | Automatic types and dimensions; exact-SKU physical fit is pending. |
| D15 | Choc electrical pad 2 belongs at **(0, −5.90)**, corrected from −6.00. Common electrical positions otherwise remain (5, −3.80). Manufacturer pattern-side drawings must be converted consistently to the component-side coordinate convention. | Automatic pin coordinates, net mapping and rotations 0°/37°/90°/180°; compare actual purchased switch orientation manually. |
| D16 | KS-33 centre bore is **Ø5.25 mm**, corrected from the early 5.10 mm study. Generated footprint claims KS-33, not unverified KS-27 compatibility. LED apertures are omitted. | Automatic generated-spec checks; exact other SKUs and LED implementations need separate review. |
| D17 | Five-pin Cherry MX needs its centre bore, both Ø1.70 mm locators at ±5.08 mm, and both electrical pads on retained material. Its pin-number convention intentionally follows this project. | Automatic holes, retained lands and pin/net mapping. Native schematic pairing still needs review. |
| D18 | Current solder copper and mask openings are **B.Cu/B.Mask only**; the switch remains top-mounted. Plated holes still have through barrels. No top annular copper, solder-paste layer or hotswap hardware is intended. | Automatic emitted layer/type checks. Native KiCad load/save and Gerber preservation of these layer sets remain pending. Do not flip the whole footprint merely to move solder pads. |
| D19 | Native KiCad ovals, drill output, outline connectivity and copper/paste layers must survive load/save/export. The offline drawings are generated from footprint expressions, not a native CAD render. | Pending native KiCad DRC, save/reopen, F/B copper/mask and separate PTH/NPTH drill review. Source tests cannot replace these. |
| D20 | Larger keys, stabilizers, LEDs, full matrix routing, case tolerances and the final layout are outside the current three switch footprints. | Pending separate design checks; a footprint pass cannot certify absent features. |

## Keyboard matrix findings (single identical 5×4 half)

| ID | Source/category and affected geometry or circuit | Verification |
| --- | --- | --- |
| K01 | User layout / Ergogen placement: the relative staggers `0, +3, +5, −5, −3` accumulate to **0, 3, 8, 3, 0 mm**. With five columns at 19.05 mm pitch the key centres are bilaterally symmetric. Manufacture one half-PCB design and use two copies component-side up; do not mirror or flip Choc's asymmetric physical pin/cut pattern. Right-hand anatomical column names reverse. | Automatic actual point/pad placements, fixed orientation and symmetric key-centre checks on the complete emitted board. The entire asymmetric footprint artwork is deliberately not a mirrored/reversible design. |
| K02 | Charlieplex topology / project circuit: five bidirectional scan lines provide **5×4 = 20 directed pairs per half**. `COL0..4` and `ROW0..3` remain placement metadata; they are not nine physical GPIO nets. Each switch is wired `sense Pn → SW1 → SW2 → diode A(2) → diode K(1) → sink Pm`, with `n ≠ m`. | Automatic all-pair uniqueness/coverage, diode polarity, five-net count and comparison of parsed schematic wire/pin connectivity to emitted PCB pads. Does not establish analog noise/logic margins. |
| K03 | Electrical / [original charlieplex input experiment](https://github.com/thanks4opensource/markoplexing): series diodes can leave forward multi-key paths that produce ghost readings. For example, closures P0→P1 and P1→P2 can resemble P0→P2. Ordinary digital scanning is **not established as NKRO**. MCU thresholds, pull-ups, diode characteristics at actual current/temperature, and firmware must be chosen and tested together. | Manual / pending electrical prototype and multi-key validation. Geometry checks cannot certify rollover. Candidate 1N4148W is not a frozen part or a claim that its voltage drop solves ghosting. ADC/comparator alternatives would constrain the eventual MCU/pin choice. |
| K04 | User row declaration / [Ergogen points](https://docs.ergogen.xyz/points/): rows are emitted bottom to top, so the supplied order places **r3 lowest and r0 highest**. The four rows retain 19.05 mm pitch. | Automatic full-board coordinates and explicit row labels in the review. Change row names/order deliberately if another legend convention is wanted. |
| K05 | Mechanical arrangement / full-board geometry: stagger changes neighbouring scallop positions. The old regular 3×3 results cannot certify this arrangement. Check all 20 keys, 40 routed loops, actual drills, both flex paths/key, rigid island necks and every inter-key cut distance. | Automatic complete-board connectivity, rail guards, 1.30/1.96 mm erosion screens and conservative route/drill/perimeter tolerance screen. The generated report records measured results. Native DRC/CAM/fatigue remain open. |
| K06 | Component assembly / [KiCad SOD-123 land dimensions](https://github.com/KiCad/kicad-footprints/blob/master/Diode_SMD.pretty/D_SOD-123.kicad_mod): diode pads are 0.9×1.2 mm at ±1.65 mm, courtyard 4.7×2.3 mm. Diodes occupy stationary horizontal rails, **not flex beams or moving islands**. They are bottom-side SMD parts with B.Cu/B.Mask/B.Paste; switch/support pads remain bottom-only plated solder pads without paste. | Automatic emitted pad layers, polarity, entire courtyard on stationary material, and courtyard/copper clearance to actual cutouts. Exact diode SKU/body, soldering access and native courtyard DRC remain manual. |
| K07 | Case support / new layout: support windows are derived from emitted cut pairs, closing the two suspension gaps with a 1 mm geometric closing radius, filling the moving interior and relieving by 0.30 mm for gasket / 0.50 mm for ribs. Preserve the scallops. Upper and lower gasket/rib plans differ because lower parts need diode-body relief. Thin slivers are removed with the existing 1.30 mm opening screen. This detaches small tongues; the support design deliberately omits those tongues, records their areas and rejects any omitted piece >3 mm² or on the perimeter. | Automatic moving pads/cuts contained in exclusions, complete-sheet/rib-plan connectivity and ≥2.0 mm unrelieved upper-gasket web before trimming. These are **2D review concepts**, not final case CAD. Reduced clamp coverage after tongue removal, lower relief load paths, clamp nodes, mounting, compression, material stiffness and 0.35–0.50 mm hard-stop Z geometry are manual / pending. No minimum width everywhere in the relieved sheets is claimed. |
| K08 | Adapter scope / user instruction: finish the basic passive matrix first; defer adapter, connector and controller. Two copies have independent five-line banks. Directly paralleling both banks would make matching directed pairs indistinguishable. | Automatic five scan nets and no controller/inter-half wiring in current artifacts; manual future adapter architecture. Five scan GPIO per half does not allocate transport, USB, reset, power or other functions. |
| K09 | Outline / quote: retaining 4 mm outside-cell margin produces a **103.25×92.20 mm** nominal half. It exceeds 100 mm width; do not infer a 100×100 mm promotional quote. One identical PCB design supports the user's intended five-copy batch, but quantity/price acceptance is not checked here. | Automatic actual outline measurement; manual live quote/CAM before ordering. No order or manufacturer contact is authorized. |
| K10 | Preview software / installed Ergogen 4.2.1: the local web editor shares the CAD build's custom footprint registration and 1.2 mm KiCad 8 template. Draft YAML runs in isolated workers and produces in-memory points, outlines and PCB previews/downloads. The PCB image follows emitted arcs, pad capsules and holes, but is not a native KiCad render. Web drafts can violate physical/design constraints. | Automatic API checks for real custom footprints, template thickness, generated geometry, error recovery and unchanged source files; preview results always labelled **unverified**. Editor DOM interactions are tested without a browser; visual browser layout review remains manual. Saving a design revision requires the complete `npm run review` gate; no web preview claims CAM, DRC, fatigue or electrical approval. |
| K11 | CAD serialization / [KiCanvas tokenizer, pinned source](https://github.com/theacodes/kicanvas/blob/b031159eb74aaa7eef2b026fd85d35bc05ff2095/src/kicad/tokenizer.ts): a decimal token starting with `.` is rejected. The diode generator emitted `.6` fonts and `.9` pads, and the embedded schematic library emitted `.508` radii and `.254` strokes. Use canonical `0.6`, `0.9`, `0.508`, `0.254` and negative `-0.9` notation throughout CAD. Numeric dimensions and pad/hole geometry are unchanged. | Automatic shared CAD-reader rejection of unquoted leading-dot numeric atoms, with regression tests and regenerated PCB/schematic/library files. Original PCB error reproduced at index 259998 using KiCanvas's own tokenizer offline. All regenerated CAD passes that tokenizer, and upstream PCB/schematic model loaders accept 40 footprints / 40 symbols offline. KiCanvas still warns about unsupported plotfptext and pad_prop_mechanical metadata; required mechanical-pad metadata is retained. Browser rendering and native KiCad ERC/DRC remain open. |

## Pricing and acceptance findings

| ID | Finding and consequence | Verification |
| --- | --- | --- |
| C01 | **Regular is the normal/default precision option**; it is not a separate paid precision grade. Precision is the optional tighter service. No fixed universal price difference has been established. | Manual [live JLCPCB quote](https://cart.jlcpcb.com/quote) using actual Gerbers. |
| C02 | **USD 2 is a promotional starting PCB price**, not a delivered-total guarantee. Shipping, tax, promotion eligibility, finish, quantity, dimensions, precision and other options affect it. Many internal cutouts/long routing may receive extra review or milling charges. The proposed budget starting setup is standard two-layer FR-4, 1.2 mm, 1 oz, Regular routing, green mask, standard HASL and no controlled-impedance/advanced options; confirm quantity and promotion in the live quote. | Manual quote/CAM acceptance; do not silently claim USD 2 just because the board is under 100 × 100 mm. |
| C03 | A nominal capability pass does not guarantee acceptance of a heavily slotted, thin-bridge rigid board. CAM may require handling changes, supports or wider bridges. This can change flex behaviour and price. | Pending manufacturer review of final Gerbers. Do not accept geometry-changing CAM edits without inspecting the resulting suspension. |

## Open validation and evidence

Current geometry can pass automated checks while fatigue, fit, tolerance margin,
case support and price remain open. The generated report explicitly says **PASS
WITH OPEN REVIEWS**, not “manufacturing certified.” In particular M04 warns about
the small Regular-precision copper margin; P07/P08 require a real coupon test.

The 1.30/1.96/2.60 mm guards are geometric project choices, not measured safe
working widths. Erosion tests ignore drill holes only while measuring island
neck and suspension geometry; a separate test subtracts all actual drills and
checks nominal/adverse 3×3 connectivity. Neither calculation includes anisotropic
laminate elasticity, solder-joint stresses, assembly torque or cycle damage.

For each future revision:

1. Identify affected IDs; add new findings and their evidence.
2. Update the design and corresponding checks without hiding failures.
3. Run `npm run check`, inspect its warnings, and review the new exact-input report.
4. Regenerate/view drawings offline with `npm run review` when geometry changes.
5. Update case/gasket CAD whenever rails or cutout windows change; record pending
   hardware/native checks explicitly.

Additional footprint sources: [Kailh V1 manufacturer drawing](https://cdn-shop.adafruit.com/product-files/5114/5114_CPG135001D03.pdf),
[Kailh V2 datasheet index](https://www.kailh.net/pages/product-datasheet), and
[Gateron KS-33 manufacturer drawing](https://gateron.com/u_file/2311/10/file/GATERONKS-33LowProfile20RedSwitchBlackBottomHousing-KS-33H10B050NN-Y24.pdf).
