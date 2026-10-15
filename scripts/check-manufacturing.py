#!/usr/bin/env python3
"""Read emitted footprint geometry on stdin; check all three repeating boards.

This validates geometry and conservative tolerance screens, not stress or fatigue.
The source models are supplied by check-manufacturing.js from emitted KiCad pads
and lines/arcs. Never regenerate study geometry here to hide a failed check.
"""
import hashlib
import copy
import json
import math
import sys
from datetime import date
from pathlib import Path

try:
    import shapely
    from shapely.affinity import translate
    from shapely.geometry import LineString, Point, Polygon, box
    from shapely.ops import unary_union
except ImportError:
    sys.exit("Shapely is required; install scripts/requirements-manufacturing.txt in .venv-manufacturing.")

ROOT = Path(__file__).resolve().parents[1]
RULES = json.loads((ROOT / "scripts/lib/manufacturing-rules.json").read_text())
JLC, PROJECT = RULES["jlcpcb"], RULES["project"]
PAYLOAD = json.load(sys.stdin)
MODELS = PAYLOAD['models']
KEYBOARD = PAYLOAD['keyboard']
Q = 32
results, failures, warnings = [], [], []


def require(condition, message):
    if not condition:
        raise ValueError(message)


def capsule(xy, dimensions):
    w, h = dimensions if len(dimensions) == 2 else dimensions * 2
    x, y = xy
    require(w > 0 and h > 0, "Nonpositive hole/pad dimension")
    r = min(w, h)/2
    dx, dy = max(0, (w-h)/2), max(0, (h-w)/2)
    if dx == dy == 0:
        return Point(x, y).buffer(r, quad_segs=Q)
    return LineString([(x-dx, y-dy), (x+dx, y+dy)]).buffer(r, quad_segs=Q)


def parts(geometry):
    return [geometry] if geometry.geom_type == "Polygon" else list(geometry.geoms)


def component_at(geometry, xy):
    return next((p for p in parts(geometry) if p.covers(Point(*xy))), None)


def verify(model):
    name = model["id"]
    polygons = [Polygon(coords) for coords in model["cuts"]]
    require(len(polygons) == 2, "Each key must have two closed routed regions")
    require(all(p.is_valid and not p.is_empty for p in polygons), "Invalid cut contour")
    cuts = unary_union(polygons)
    require(cuts.geom_type == "MultiPolygon" and len(cuts.geoms) == 2, "Overlapping/merged cut contours")
    require(min(model["radii"]) >= PROJECT["arc_radius_min_mm"], "Routing arc below tool-radius margin")
    require(max(model["turns"]) <= PROJECT["max_fitted_joint_turn_degrees"], "Sharp fitted contour joint")

    # A cutter must reach every part of every region without splitting its
    # centreline domain into disconnected areas. Allow only curve-fit noise.
    tool_r = JLC["routed_slot_min_mm"]/2
    centers = cuts.buffer(-tool_r, quad_segs=Q)
    require(centers.geom_type == "MultiPolygon" and len(centers.geoms) == 2,
            "A 1 mm cutter cannot traverse the routed regions")
    swept = centers.buffer(tool_r, quad_segs=Q)
    error_area = cuts.difference(swept).area
    error_distance = cuts.hausdorff_distance(swept)
    require(error_area <= PROJECT["tool_sweep_error_area_mm2"] and
            error_distance <= PROJECT["tool_sweep_error_distance_mm"],
            f"Unreachable cusp/slit: {error_area:.6f} mm², {error_distance:.6f} mm")

    pitch = PROJECT["pitch_mm"]
    outside = pitch*1.5 + PROJECT["outside_cell_margin_mm"]
    boundary = box(-outside, -outside, outside, outside)
    positions = [(x, y) for x in (-pitch, 0, pitch) for y in (-pitch, 0, pitch)]
    all_cuts = unary_union([translate(cuts, xoff=x, yoff=y) for x, y in positions])
    unperforated = boundary.difference(all_cuts)
    require(unperforated.is_valid and unperforated.geom_type == "Polygon", "3x3 PCB disconnected")
    require(len(unperforated.interiors) == 18, "Repeated routed regions merged/lost")

    # Width guards: eroding both sides is a geometric thin-bridge test.
    # Before drills: all 18 cut loops must remain distinct after erosion, so
    # both intentional connections survive at every key, not merely one path.
    beam_guard = unperforated.buffer(-PROJECT["beam_connection_width_guard_mm"]/2, quad_segs=Q)
    require(beam_guard.geom_type == "Polygon" and len(beam_guard.interiors) == 18,
            "A beam/anchor is too narrow to preserve both connections at 1.30 mm")
    neck_guard = unperforated.buffer(-PROJECT["island_neck_width_guard_mm"]/2, quad_segs=Q)
    core = component_at(neck_guard, (0, 0))
    require(core is not None, "Rigid island core collapsed in neck-width test")
    for pad in model["pads"]:
        require(core.covers(Point(*pad["at"])), "Pad/locator lobe connected through <1.96 mm neck")
    require(not core.covers(Point(outside-2, 0)), "Rigid shortcut bypasses intended flex suspension")

    drills, copper_clearances, lands, annular_rings = [], [], [], []
    for pad in model["pads"]:
        drill = capsule(pad["at"], pad["drill"])
        require(unperforated.covers(drill), "Drill touches routed opening/outside")
        drills.append(drill)
        plated = pad["type"] == "thru_hole"
        if plated:
            require(min(pad["drill"]) >= JLC["pth_drill_min_mm"], "PTH drill too small")
            copper = capsule(pad["at"], pad["size"])
            require(unperforated.covers(copper), "Copper pad crosses cut")
            clearance = copper.distance(cuts)
            require(clearance >= JLC["copper_to_route_min_mm"], "JLC copper-to-route minimum violated")
            require(clearance >= PROJECT["copper_to_route_regression_min_mm"], "Copper-to-route margin regressed")
            copper_clearances.append(clearance)
            # Verify the actual capsule ring, including slot ends, rather
            # than subtracting just one pair of pad dimensions.
            require(copper.covers(drill), "Plated drill outside copper pad")
            ring = drill.boundary.distance(copper.boundary)
            require(ring >= JLC["pth_annular_ring_recommended_mm"]-.002, "PTH annular ring below project recommendation")
            annular_rings.append(ring)
            if len(pad["drill"]) == 2 and pad["drill"][0] != pad["drill"][1]:
                width, length = sorted(pad["drill"])
                require(width >= JLC["plated_slot_width_min_mm"], "Oval slot too narrow")
                require(length >= JLC["plated_slot_length_width_ratio_min"]*width, "Oval slot length <2x width")
                require(not pad["hasNet"] and not pad["number"], "Mechanical support unexpectedly numbered/connected")
        else:
            require(min(pad["drill"]) >= JLC["npth_diameter_min_mm"], "NPTH too small")
            land = drill.distance(cuts)
            require(land >= PROJECT["npth_to_route_land_min_mm"], "NPTH retained material too thin")
            lands.append(land)
    hole_gap = min(a.distance(b) for i, a in enumerate(drills) for b in drills[i+1:])
    require(hole_gap >= JLC["pad_hole_spacing_min_mm"], "Drill-to-drill spacing too small")
    repeated_drills = unary_union([translate(unary_union(drills), xoff=x, yoff=y) for x, y in positions])
    physical = unperforated.difference(repeated_drills)
    require(physical.is_valid and physical.geom_type == "Polygon", "Drilled 3x3 board/island disconnected")
    require(len(physical.interiors) == 9*(2+len(drills)), "Drill/cut loops merge in 3x3")

    tolerance = RULES["process"]["routing_tolerance_mm"]
    adverse = boundary.difference(all_cuts.buffer(tolerance, quad_segs=Q)).difference(
        repeated_drills.buffer(.13/2, quad_segs=Q))
    require(adverse.is_valid and adverse.geom_type == "Polygon", "PCB disconnects under conservative route/drill growth")
    require(len(adverse.interiors) == 9*(2+len(drills)), "Holes merge with cutouts under conservative route/drill growth")
    rail = min(cuts.distance(translate(cuts, xoff=dx, yoff=dy)) for dx, dy in ((pitch, 0), (0, pitch)))
    require(rail >= PROJECT["shared_rail_min_mm"], "Shared rail below 2.60 mm project guard")
    require(rail-2*tolerance >= PROJECT["shared_rail_adverse_stack_min_mm"], "Shared rail too thin under adverse routing stack")

    worst_copper = min(copper_clearances)-tolerance
    if worst_copper < JLC["copper_to_route_min_mm"]:
        warnings.append(f"{name}: nominal copper gap passes; conservative minus-0.20 mm screen is {worst_copper:.3f} mm, marginal against 0.20 mm. Do not claim tolerance-guaranteed clearance.")
    return {
        "id": name,
        "min_copper_to_route_mm": min(copper_clearances),
        "min_npth_land_mm": min(lands),
        "min_annular_ring_mm": min(annular_rings),
        "min_hole_to_hole_mm": hole_gap,
        "min_shared_rail_mm": rail,
        "shared_rail_adverse_stack_mm": rail-2*tolerance,
        "min_gasket_web_if_relief_matches_rail_mm": rail-2*PROJECT["gasket_edge_clearance_mm"],
        "min_arc_radius_mm": min(model["radii"]),
        "max_curve_joint_turn_degrees": max(model["turns"]),
        "tool_sweep_error_area_mm2": error_area,
        "tool_sweep_error_distance_mm": error_distance,
        "beam_connections_pass_1p30mm_guard": True,
        "island_necks_pass_1p96mm_guard": True,
        "drilled_3x3_connected": True,
        "adverse_3x3_connected": True,
    }


def rejection_checks():
    """Prove the new guards reject real malformed slots/cut geometry."""
    def rejects(model, expected):
        try:
            verify(model)
        except ValueError as error:
            require(expected in str(error), f"Wrong rejection for negative fixture: {error}")
        else:
            raise ValueError(f"Negative fixture was accepted: {expected}")

    choc = next(m for m in MODELS if m["id"] == "choc")
    bad = copy.deepcopy(choc)
    next(p for p in bad["pads"] if p["type"] == "thru_hole" and not p["number"])["drill"] = [1.5, 2.0]
    rejects(bad, "length <2x width")
    bad = copy.deepcopy(choc)
    next(p for p in bad["pads"] if p["type"] == "thru_hole" and not p["number"])["drill"] = [.4, 3.0]
    rejects(bad, "slot too narrow")

    # KS-33 has a straight 1.35 mm free section: expanding its cuts 0.10 mm
    # on each side must trip the 1.30 mm bridge guard before pad checks.
    bad = copy.deepcopy(next(m for m in MODELS if m["id"] == "ks33"))
    grown = unary_union([Polygon(p) for p in bad["cuts"]]).buffer(.10, quad_segs=Q)
    bad["cuts"] = [list(p.exterior.coords) for p in parts(grown)]
    rejects(bad, "beam/anchor is too narrow")

    bad = copy.deepcopy(next(m for m in MODELS if m["id"] == "ks33"))
    spur = unary_union([*[Polygon(p) for p in bad["cuts"]], box(7.4, -3.2, 8.5, -2.8)])
    bad["cuts"] = [list(p.exterior.coords) for p in parts(spur)]
    rejects(bad, "Unreachable cusp/slit")
    print("Rejection checks PASS: short/narrow oval, thin bridge, inaccessible routing spur")


try:
    rejection_checks()
except ValueError as error:
    failures.append(f"Verification self-test: {error}")
    print(f"Verification self-test FAIL: {error}")

for model in MODELS:
    try:
        result = verify(model)
        results.append(result)
        print(f"{model['id']}: manufacturing/geometry PASS; rail {result['min_shared_rail_mm']:.3f} mm; copper {result['min_copper_to_route_mm']:.3f} mm")
    except (ValueError, AssertionError) as error:
        failures.append(f"{model['id']}: {error}")
        print(f"{model['id']}: FAIL: {error}")

# Screen the actual 20-key staggered board, not an extrapolation of 3x3.
import importlib.util
keyboard_spec = importlib.util.spec_from_file_location('check_keyboard', ROOT/'scripts/check-keyboard.py')
keyboard_module = importlib.util.module_from_spec(keyboard_spec)
keyboard_spec.loader.exec_module(keyboard_module)
keyboard_result = None
try:
    keyboard_result, support_geometry = keyboard_module.verify_keyboard(KEYBOARD, RULES)
    keyboard_module.write_support_review(support_geometry, ROOT/'build/keyboard')
    print(f"keyboard: full staggered half PASS; rail {keyboard_result['min_shared_rail_mm']:.3f} mm; 20 islands / 40 cuts; support sheets connected")
except (ValueError, AssertionError) as error:
    failures.append(str(error))
    print(f'keyboard: FAIL: {error}')

panel_spec = importlib.util.spec_from_file_location('check_panel', ROOT/'scripts/check-panel.py')
panel_module = importlib.util.module_from_spec(panel_spec)
panel_spec.loader.exec_module(panel_module)
panel_result = None
try:
    panel_result = panel_module.verify_panel(KEYBOARD, PAYLOAD['adapter'], PAYLOAD['panel'], RULES)
    print(f"panel: actual half + passive adapter PASS; {panel_result['width_mm']:.3f} x {panel_result['height_mm']:.3f} mm; two mouse-bite tabs")
except (ValueError, AssertionError) as error:
    failures.append('panel: '+str(error))
    print(f'panel: FAIL: {error}')

inputs = [ROOT/"keyboard-flex-study/key-flex-cuts.html", ROOT/"scripts/rebuild-choc-study.py"]
inputs += sorted((ROOT/"scripts/lib").glob("*.*"))
inputs += sorted((ROOT/"ergogen/footprints").glob("*.js"))
inputs += sorted((ROOT/"scripts").glob("*.js"))
inputs += [ROOT/"scripts/check-manufacturing.py", ROOT/"package.json"]
inputs += [ROOT/'scripts/check-keyboard.py', ROOT/'scripts/check-panel.py', ROOT/'ergogen/config.yaml', ROOT/'package-lock.json',
           ROOT/'scripts/requirements-manufacturing.txt',
           ROOT/'build/keyboard/choc5x4_half.kicad_pcb', ROOT/'build/keyboard/choc5x4_half.kicad_sch',
           ROOT/'build/keyboard/keys.json', ROOT/'build/keyboard/adapter.kicad_pcb', ROOT/'build/keyboard/adapter.kicad_sch', ROOT/'build/keyboard/choc5x4_panel.kicad_pcb']
digest = hashlib.sha256()
toolchain = {**PAYLOAD['toolchain'], 'python':sys.version.split()[0], 'shapely':shapely.__version__}
digest.update(json.dumps(toolchain,sort_keys=True).encode())
for filename in inputs:
    digest.update(str(filename.relative_to(ROOT)).encode())
    digest.update(filename.read_bytes())
fingerprint = digest.hexdigest()
status = "FAIL" if failures else "PASS WITH OPEN REVIEWS"
output = ROOT/"build/review"
output.mkdir(parents=True, exist_ok=True)
(output/"manufacturing-check.json").write_text(json.dumps({
    "status": status, "date": str(date.today()), "input_sha256": fingerprint, "toolchain":toolchain,
    "results": results, "keyboard": keyboard_result, "panel":panel_result, "failures": failures, "warnings": warnings,
    "manual_reviews": ["Native KiCad DRC and Gerber/drill export", "CAM acceptance of narrow rigid-FR4 bridges",
                       "Switch-SKU physical fit", "Case/gasket support and hard stops", "FR4/copper fatigue and neighbour displacement", "Live order price"],
}, indent=2)+"\n")
lines = ["# Manufacturing verification", "", f"Run: {date.today()}. Status: **{status}**.", "",
         "Generated by `npm run check`; numeric policy and finding IDs are in [manufacturing-limitations.md](manufacturing-limitations.md).",
         "Results apply only to these exact inputs; changed geometry must be checked again.", "",
         f"Input SHA-256: `{fingerprint}`", "",
         'Toolchain: '+', '.join(f'{name} {version}' for name,version in toolchain.items())+'.', '',
         "| Footprint | Copper to cut | NPTH land | PTH ring | Shared rail | Adverse rail | 3×3 connections |",
         "| --- | ---: | ---: | ---: | ---: | ---: | --- |"]
for r in results:
    lines.append(f"| {r['id']} | {r['min_copper_to_route_mm']:.3f} mm | {r['min_npth_land_mm']:.3f} mm | {r['min_annular_ring_mm']:.3f} mm | {r['min_shared_rail_mm']:.3f} mm | {r['shared_rail_adverse_stack_mm']:.3f} mm | Pass |")
lines += ["", "The width tests preserve both suspension connections at a 1.30 mm erosion guard and connect every pad/locator lobe to its island at a 1.96 mm guard. These are geometric screens, not measured strength or fatigue ratings.",
          "", "## Failures", ""] + ([f"- {f}" for f in failures] or ["None."])
if keyboard_result:
    k=keyboard_result
    lines += ['', '## Full 5×4 Choc half-board', '',
              f"- Actual outline: **{k['width_mm']:.2f} × {k['height_mm']:.2f} mm**, {k['thickness_mm']:.1f} mm nominal FR-4.",
              '- One identical PCB is used twice, component side up; 20 switches + 20 bottom-side SOD-123 diodes per PCB.',
              '- Five scan nets cover all 20 directed pairs. Parsed schematic wire/pin connectivity matches emitted PCB pads.',
              f"- All 40 internal cutouts remain separate; both beams/key, rigid island necks, actual drilled half and adverse route/drill screen pass.",
              f"- Minimum actual staggered stationary rail: **{k['min_shared_rail_mm']:.3f} mm**; adverse two-edge screen **{k['shared_rail_adverse_stack_mm']:.3f} mm**.",
              f"- Minimum cut-to-exterior stationary land: **{k['min_cut_to_outline_land_mm']:.3f} mm**; adverse two-edge screen **{k['cut_to_outline_adverse_stack_mm']:.3f} mm**.",
              f"- Diodes lie on stationary material; minimum diode copper/edge clearance **{k['min_diode_copper_to_route_mm']:.3f} mm**.",
              f"- Upper gasket web before component relief: **{k['min_gasket_web_before_component_reliefs_mm']:.3f} mm**. Separate lower diode reliefs; both sheets/rib plans remain connected and exclude moving systems.",
              '- Support outputs are 2D concepts only: lower-relief load paths, clamps/mounts, hard stops, compression and complete case Z geometry remain open.',
              '- Unsupported support tongues are deliberately omitted from the 2D plans, with per-piece area guard; this changes clamp coverage and needs mechanical review: '+('; '.join(f"{s['sheet']}: {s['omitted_lobes']} lobes / {s['omitted_area_mm2']:.2f} mm²" for s in k['support_tongues_deliberately_omitted']))+'.',
              '- Board is **unrouted**. No native KiCad ERC/DRC has run. MCU pin thresholds, diode voltage margins, multi-key ghosting, firmware and powered/unpowered protection qualification remain open.',
              '- Actual half, passive adapter and two-tab panel are implemented in native CAD; promotional price is not certified.',
              '- **USB-C interface DESIGN HOLD:** selected pin groups preserve identity with adapter compensation in all four modeled orientations; input margins, rollover and protection qualification remain unresolved. See [interface verification](usb-c-interface-verification.md); `npm run check:interface` is a separate failing electrical release gate.', '']
if panel_result:
    p=panel_result
    lines += ['', '## Actual breakaway panel and passive adapter', '',
      f"- Bare panel: **{p['width_mm']:.3f} × {p['height_mm']:.3f} mm**; conservative outline-tolerance envelope {p['outline_tolerance_upper_bound_mm'][0]:.3f} × {p['outline_tolerance_upper_bound_mm'][1]:.3f} mm.",
      f"- Actual separated-board gap {p['min_board_separation_mm']:.3f} mm; two five-hole mouse-bite tabs. Simulated removal leaves two connected boards.",
      f"- Adapter {p['adapter']['components']} components including XIAO header carrier; panel {p['panel']['components']} footprints including tabs. Pad clearances, functional drills and courtyards screened on emitted geometry.",
      '- USB4115-03-C is an upright 24-contact connector, 9.3 mm tall. Four shell stakes and two locating holes are included per connector.',
      '- XIAO mounts on two six-pin headers after depaneling, with D0/5V omitted. Its module body overhangs the carrier and needs at least 3 mm standoff; purchased header fit and case Z geometry remain manual.',
      '- Adapter contains series/contact-isolation resistors and TVS only; no LDO, charge pump, reference or active protection IC. TVS does not guarantee MCU fault protection.',
      '- Mouse-bite perforations intentionally have 0.40 mm hole-edge gaps; the separate ≥0.45 mm functional-hole rule remains unchanged.',
      '- The half upper-left connector bay is relieved in both continuous gasket and matching rib concepts. Final clamps, port access and depanel tooling remain open.', '']
lines += ["", "## Open reviews and tolerance warnings", ""] + [f"- {w}" for w in warnings]
lines += ["- Native KiCad loading/DRC and final Gerber/drill outputs have not been checked.",
          "- Thin rigid-FR4 beams require CAM acceptance; tool access does not certify breakage resistance.",
          "- Switch fit, case/gasket support, hard stops, fatigue life and neighbour motion need hardware validation.",
          "- The USD 2 promotional price and extra milling fees require a live Gerber quote.", ""]
(ROOT/"docs/manufacturing-verification.md").write_text("\n".join(lines))
for warning in warnings:
    print("REVIEW:", warning)
if failures:
    sys.exit(1)
