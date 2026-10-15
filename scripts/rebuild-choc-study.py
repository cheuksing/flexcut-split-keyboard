#!/usr/bin/env python3
"""Regenerate only the Choc study cutout. Optional dependency: Shapely >=2.

Normal Node footprint builds use the checked-in study and do not need Python.
Coordinates are component-side: +X right, +Y down; dimensions are millimetres.
"""
import json
import re
from pathlib import Path

from shapely.affinity import translate
from shapely.geometry import LineString, Point, box
from shapely.ops import substring, unary_union

ROOT = Path(__file__).resolve().parents[1]
Q = 32
FILLET = 0.55


def disk(x, y, r):
    return Point(x, y).buffer(r, quad_segs=Q)


def link(points, width):
    return LineString(points).buffer(width / 2, quad_segs=Q,
                                    cap_style="round", join_style="round")


def rounded_box(x1, y1, x2, y2, r):
    return box(x1+r, y1+r, x2-r, y2-r).buffer(r, quad_segs=Q)


def path(geometry):
    result = []
    polys = [geometry] if geometry.geom_type == "Polygon" else list(geometry.geoms)
    for poly in polys:
        for ring in (poly.exterior, *poly.interiors):
            result.append("M" + " L".join(f"{x:.3f},{y:.3f}"
                          for x, y in list(ring.coords)[:-1]) + "Z")
    return "".join(result)


def beam(points):
    line = LineString(points)
    return unary_union([
        line.buffer(1.35/2, quad_segs=Q, cap_style="round", join_style="round"),
        substring(line, 0, 1).buffer(1, quad_segs=Q),
        substring(line, line.length-1, line.length).buffer(1, quad_segs=Q),
    ])


# The plated slot and its copper are capsules, exactly as KiCad renders them.
# Slot: 1.5 x 3.0; pad: 2.4 x 3.9; outer lobe: 3.22 x 4.72.
support_axis = [(-5, 4.4), (-5, 5.9)]
island = unary_union([
    rounded_box(-4.15, -4.2, 4.15, 4.2, 1.35),
    disk(0, -5.9, 1.55), disk(5, -3.8, 1.55),
    link([(0, -5.9), (0, -3.45)], 2),
    link([(5, -3.8), (3.55, -3.8)], 2),
    link(support_axis, 3.22), link([(-5, 5.15), (-3.6, 3.85)], 2),
    disk(-5.5, 0, 1.50), disk(5.5, 0, 1.50),
    link([(-5.5, 0), (-3.6, 0)], 2), link([(5.5, 0), (3.6, 0)], 2),
]).buffer(.75, quad_segs=Q).buffer(-.75, quad_segs=Q)

beam_points = [
    [(-3.8, -3.75), (-5.65, -3.75), (-5.65, -5.65), (-4.4, -5.65), (-4.4, -7.8)],
    [(3.8, 3.75), (5.65, 3.75), (5.65, 5.65), (4.4, 5.65), (4.4, 7.8)],
]
cell = box(-9.525, -9.525, 9.525, 9.525)
opening = rounded_box(-7.525, -7.525, 7.525, 7.525, 1.5)
fixed = cell.difference(opening).difference(island.buffer(1.2, quad_segs=Q))
raw = cell.difference(unary_union([fixed, island, *map(beam, beam_points)]))
cut = raw.buffer(-FILLET, quad_segs=Q).buffer(FILLET, quad_segs=Q)
cut = cut.buffer(FILLET, quad_segs=Q).buffer(-FILLET, quad_segs=Q)
retained = cell.difference(cut)
assert cut.is_valid and retained.is_valid
assert cut.geom_type == "MultiPolygon" and len(cut.geoms) == 2
assert retained.geom_type == "Polygon", "Island disconnected from grid"

features = {
    "signal_1": disk(5, -3.8, 1.15),
    "signal_2": disk(0, -5.9, 1.15),
    "support_copper": link(support_axis, 2.4),
    "left_locator": disk(-5.5, 0, .95),
    "right_locator": disk(5.5, 0, .95),
    "center_hole": disk(0, 0, 2.55),
}
clearances = {}
for name, feature in features.items():
    assert retained.covers(feature), f"{name} crosses cut"
    clearance = cut.distance(feature)
    assert clearance >= (.549 if "locator" in name else .399), (name, clearance)
    clearances[name] = round(clearance, 5)

# A 1.0 mm cutter must sweep every routed region. Sub-micron buffering
# discretization is allowed; macroscopic inaccessible cusps must fail.
tool_sweep = cut.buffer(-.5, quad_segs=Q).buffer(.5, quad_segs=Q)
unreachable = cut.difference(tool_sweep)
assert unreachable.area < .003, f"Unmachinable cutout area: {unreachable.area}"

# Verify repeated cells, including both facing locator scallops. A 4 mm
# outside cell margin gives the 65.15 mm square study board.
drills = unary_union([
    disk(0, 0, 2.55), disk(-5.5, 0, .95), disk(5.5, 0, .95),
    disk(5, -3.8, .725), disk(0, -5.9, .725), link(support_axis, 1.5),
])
board = box(-32.575, -32.575, 32.575, 32.575).difference(unary_union([
    translate(unary_union([cut, drills]), xoff=x, yoff=y)
    for x in (-19.05, 0, 19.05) for y in (-19.05, 0, 19.05)
]))
assert board.is_valid and board.geom_type == "Polygon", "3x3 board disconnected"
assert len(board.interiors) == 9 * (2 + 6), "Missing or merged 3x3 cut/hole"
left_cut = cut.intersection(LineString([(0, 0), (9.525, 0)]))
shared_rail = 19.05 - 2 * left_cut.bounds[2]
assert shared_rail >= 2.649, shared_rail

html_path = ROOT / "keyboard-flex-study/key-flex-cuts.html"
html = html_path.read_text()
start = html.index('<title id="choc-title">')
end = html.index('</svg>', start)
section = html[start:end]
section, count = re.subn(r'(<path class="cell-cut"[^>]* d=")[^"]+("/>)',
                         lambda m: m[1]+path(cut)+m[2], section)
assert count == 1
html_path.write_text(html[:start]+section+html[end:])
output = ROOT / "build/review"
output.mkdir(parents=True, exist_ok=True)
(output / "choc-geometry-check.json").write_text(json.dumps({
    "clearances_mm": clearances,
    "cut_regions": len(cut.geoms),
    "connected_retained_pcb": True,
    "unreachable_by_1mm_cutter_area_mm2": unreachable.area,
    "connected_3x3_pcb": True,
    "cut_and_drill_loops_3x3": len(board.interiors),
    "minimum_facing_locator_rail_mm": shared_rail,
    "beam_points": beam_points,
}, indent=2)+"\n")
print(json.dumps(clearances, indent=2))
