# Keyboard design

Three solder-only Ergogen switch footprints with the per-key flex cuts from
[keyboard-flex-study](keyboard-flex-study/design-notes.md): Gateron KS-33,
Kailh Choc **V1 / V2**, and Cherry MX. The switch mounts on top of the PCB; solder-pad
copper and mask apertures are on **B.Cu / B.Mask only**. Signal holes and the Choc
support slot remain plated. There are no hotswap sockets or paste apertures.

This phase stops at footprint review. The keyboard layout, schematic, routing,
case and production fabrication files await review and approval.

## Review

Requires Node.js 22 or newer. Build/API tests use Node's standard library. The
manufacturing geometry gate also needs Python with Shapely. One-time setup:

```sh
python3 -m venv .venv-manufacturing
.venv-manufacturing/bin/python -m pip install -r scripts/requirements-manufacturing.txt
```

For an existing Python environment, set `MANUFACTURING_PYTHON` to its interpreter.

```sh
npm run check
npm run review
open build/review/index.html
```

The review page renders the emitted footprint geometry and offers top, front-copper
and mirrored bottom views. The generated `build/review/SwitchFlex.pretty/` directory
contains three standalone `.kicad_mod` files to open in KiCad's Footprint Editor.
`build/review/footprints.svg` is a static overview.

Read the [manufacturing, physical and design constraint register](docs/manufacturing-limitations.md)
after every design revision. `npm run check` verifies all three emitted footprints
and their repeating 3×3 boards, then updates the [exact-input verification report](docs/manufacturing-verification.md).
`npm run review` runs this gate before generating drawings. Failures stop the
workflow; manual/CAM/hardware items remain explicitly open.

See [footprint details](docs/footprints.md) for coordinates, deviations from the
study and Ergogen usage.

## Structure

```text
keyboard-flex-study/       Research and drawings; Choc updated for V1 / V2
ergogen/
  config.yaml             Single-key review fixtures, not the keyboard layout
  footprints/
    ks33.js               Self-contained generated Ergogen footprint
    choc.js               Self-contained generated Ergogen footprint (V1 / V2)
    mx.js                 Self-contained generated Ergogen footprint
scripts/
  build-footprints.js     Reconstruct study contours and emit footprint modules
  build-review.js         Emit review HTML/SVG and standalone KiCad library
  lib/                    Switch dimensions, footprint template and geometry tools
tests/                    Footprint API and geometric regression checks
docs/                     Design decisions and usage
build/                    Regenerable outputs; ignored by Git
```

Edit `scripts/lib/switches.js` and `scripts/lib/footprint-template.js`, then run
`npm run check` to regenerate and validate `ergogen/footprints/`. Commit those
generated modules alongside their sources so they can be used directly in Ergogen.
Keep new reusable footprints in `ergogen/footprints/`; future layout definitions
belong in `ergogen/`, design rationale in `docs/`, and generated CAD in `build/`.

## Git initialization

Repository initialization was attempted with `git init -b main`, but this session's
workspace policy denied creation of `.git`. The project files and `.gitignore` are
ready. To finish initialization from an unrestricted terminal in this directory:

```sh
git init -b main
```

No commit or remote has been created.
