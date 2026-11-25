# Keyboard design workflow

- Do not operate the user's browser, desktop, or GUI. Use command-line downloads
  (`curl`) and offline geometry/rendering tools.
- After **every design revision** affecting switch dimensions, holes, pads,
  cutouts, bridges, routing, pitch, board thickness, gasket, or case support,
  read `docs/manufacturing-limitations.md` and run `npm run check` before presenting
  the revision as verified. Run `npm run review` when updating review drawings;
  it also runs the complete check. Do not leave generated footprints stale.
- Add new findings to that register with a stable ID, source/category, affected
  geometry, and automatic/manual verification status. Keep numeric guards in
  `scripts/lib/manufacturing-rules.json`. Update checks when a finding can be
  verified automatically; never lower a limit just to make a failing design pass.
- The generated `docs/manufacturing-verification.md` records exact-input results.
  Report failures and open reviews honestly. A geometry pass is not CAM approval,
  a native KiCad DRC pass, proven fatigue life, or confirmation of the USD 2 quote.
- Recheck matching case ribs and the continuous gasket when stationary PCB rails
  change. Keep intentional flex beams distinct from rigid island necks and grid.
- Preserve bottom-only solder copper, plated electrical/support holes, unplated
  plastic-post holes, and the V2 mechanical support's empty pad number/no net.
- Treat accidental USB plug-in without damage as a release requirement for both
  adapter split sockets and either keyboard half. The [split-port safety
  requirements](docs/keyboard.md#split-port-safety) define the goal and the
  evidence required. Run `npm run check:interface` after interface changes.
  Keep the hold open until bench qualification is documented. Use a
  current-limited fixture for initial fault testing.
- Scope remains footprint/design review; do not publish, order, or send messages
  to a manufacturer without the user's instruction.
