# Choc 5×4 split keyboard

One identical 20-key half-PCB design, used twice component-side up. The key field
is symmetric: cumulative column heights **0, 3, 8, 3, 0 mm**, with **19.05 mm**
pitch. Each half uses the generated solder-only **Choc V1/V2 flex footprint**,
20 bottom-side SOD-123 diodes and **five charlieplex scan nets**. The right-hand
anatomical columns reverse; the physical Choc pin patterns do not flip.

Current CAD includes the **unrouted half, simple XIAO SAMD21 adapter and actual
98.20×99.475 mm breakaway panel**. The adapter has headers, two upright USB-C
ports, series/contact isolation resistors and TVS only. No extra regulator or
active protector. Selected USB-C groups preserve identity in all four modeled
plug orientations. Scan margins, rollover and powered/unpowered fault safety
remain on [electrical hold](docs/usb-c-interface-verification.md).
Native KiCad ERC/DRC and complete case construction remain open.

## Build and review

To use the local Ergogen web interface after `npm ci`:

```sh
npm run dev
```

Open **http://127.0.0.1:8787**. The editor loads `ergogen/config.yaml` and the
project's custom switch/diode footprints. It generates key positions, outlines
and a PCB preview, with zoom/pan and YAML, SVG, DXF, JSON and KiCad downloads.
Drafts stay in memory; downloading YAML does not overwrite the project file.
Invalid edits show generation errors while clearly marking the last preview as
outdated. The checked matrix review is available from the header.

The server binds to this computer only, uses the pinned local Ergogen engine and
needs no external service. Change the port with `PORT=8788 npm run dev`. Stop it
with Ctrl+C. Web generation is a preview, not a manufacturing check: after saving
an edited configuration into the project, run `npm run review`.

Requires Node.js 22+ and Python/Shapely. Install pinned Node dependencies and the
geometry dependency once:

```sh
npm ci
python3 -m venv .venv-manufacturing
.venv-manufacturing/bin/python -m pip install -r scripts/requirements-manufacturing.txt
npm run review
```

For another Python environment, set `MANUFACTURING_PYTHON` to its interpreter.
The following are local review artifacts; the workflow uses no browser or GUI:

- [Keyboard review](build/keyboard/index.html), [layout PNG](build/keyboard/layout.png),
  [matrix PNG](build/keyboard/matrix.png), [support concepts](build/keyboard/supports.png).
- [KiCad PCB](build/keyboard/choc5x4_half.kicad_pcb) and
  [KiCad schematic](build/keyboard/choc5x4_half.kicad_sch).
- [Directed-pair CSV](build/keyboard/matrix.csv) and [key placements](build/keyboard/keys.json).
- [All three switch footprints](build/review/index.html) and their generated
  `build/review/SwitchFlex.pretty/` library.
- [Exact-input verification](docs/manufacturing-verification.md) and
  [constraint register](docs/manufacturing-limitations.md).
- [Actual panel](build/keyboard/panel-fit.svg), [adapter placement](build/keyboard/adapter.svg),
  [panel PCB](build/keyboard/choc5x4_panel.kicad_pcb), [adapter PCB](build/keyboard/adapter.kicad_pcb)
  and [adapter schematic](build/keyboard/adapter.kicad_sch).
  Mount the XIAO on two six-pin headers after detaching the adapter; the module overhangs the carrier.


`npm run check` rebuilds all footprints and the keyboard, tests actual schematic
connectivity against PCB pad nets, and checks all three 3×3 fixtures **plus the
complete staggered half, adapter and actual panel**. It also rechecks derived continuous gasket/rib concepts.
`npm run review` runs that full gate before emitting drawings. Ordinary drawing
checks do not establish native KiCad, CAM, fatigue or price approval.

`npm run check:interface` writes the USB-C electrical report and exits nonzero
while scan margins, rollover and protection remain unresolved.
This electrical release gate is separate from the geometry checks above.

`npm run build:keyboard` emits CAD without the manufacturing gate. Use the npm
runner: it sets PCB thickness to **1.2 mm**; the bare Ergogen KiCad 8 CLI template
defaults to 1.6 mm. Generated `*.kicad*` files under `build/` are committed so
they can be previewed in KiCanvas; other build outputs remain ignored and can be
recreated with `npm run review`.

## Design sources

```text
ergogen/config.yaml               Single identical 5×4 half; user stagger and row order
ergogen/footprints/choc.js         Generated Choc V1/V2 footprint, unchanged pin/cut geometry
ergogen/footprints/diode_sod123.js  Bottom-side diode land pattern; candidate SKU pending
ergogen/fixtures/                  Preserved original single-key coupon configuration
scripts/build-keyboard.js          Ergogen runner, thickness, CAD, net map and local library
scripts/lib/keyboard-schematic.js  Embedded-symbol KiCad matrix schematic generator
scripts/lib/keyboard.js            Readers and electrical connectivity checks
scripts/check-keyboard.py          Actual staggered-board and support geometry screens
scripts/lib/manufacturing-rules.json  Numeric fabrication/project guards
scripts/build-keyboard-review.js   Offline SVG/PNG/HTML keyboard review
scripts/serve-ergogen.js           Loopback-only web editor and in-memory generation API
web/                              Local YAML editor, interactive preview and downloads
keyboard-flex-study/               Original per-key suspension research and drawings
docs/keyboard.md                  Circuit, reuse, placement and remaining work
```

The library also retains KS-33 and MX footprints. Edit switch geometry in
`scripts/lib/switches.js` and `scripts/lib/footprint-template.js`, then regenerate
and check. Do not hand-edit generated switch modules or scale their flex cuts to
smaller Choc pitch. All switch solder copper/mask stays on B.Cu/B.Mask only;
electrical and V2 mechanical holes remain plated, plastic posts unplated, and the
V2 support unnumbered/unconnected.
