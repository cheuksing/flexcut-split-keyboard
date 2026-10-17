"""Full staggered half-board screens and 2D support concept, from emitted CAD.

No routing, CAM, fatigue, native KiCad or assembled-case certification is implied.
The support sheets are review geometry, without mounts, clamp nodes or Z stackup.
"""
import json
from pathlib import Path
from shapely.affinity import translate
from shapely.geometry import Point, Polygon, box, LineString
from shapely.ops import unary_union


def verify_keyboard(model, rules):
    project, spec = rules['project'], rules['keyboard']
    def require(condition, message):
        if not condition:
            raise ValueError('keyboard: ' + message)
    def parts(g):
        return [g] if g.geom_type == 'Polygon' else list(g.geoms)
    def component(g, xy):
        return next((p for p in parts(g) if p.covers(Point(xy))), None)
    def capsule(p, dims):
        w,h = dims if len(dims)==2 else dims*2
        x,y=p; r=min(w,h)/2
        dx,dy=max(0,(w-h)/2),max(0,(h-w)/2)
        return (Point(x,y) if dx==dy==0 else LineString([(x-dx,y-dy),(x+dx,y+dy)])).buffer(r,quad_segs=32)
    def padshape(p):
        if p['shape']=='rect':
            x,y=p['at']; w,h=p['size']
            return box(x-w/2,y-h/2,x+w/2,y+h/2)
        return capsule(p['at'],p['size'])

    require(len(model['perimeter'])==1,'one exterior outline required')
    boundary=Polygon(model['perimeter'][0])
    require(boundary.is_valid,'invalid exterior outline')
    require(model['thickness']==rules['process']['thickness_mm'],'wrong PCB thickness')
    switches=[f for f in model['footprints'] if f['name']=='keyboard-design:choc']
    diodes=[f for f in model['footprints'] if f['name']=='keyboard-design:diode_sod523']
    count=spec['columns']*spec['rows']
    require(len(switches)==len(diodes)==count,'wrong component count')
    require(model['electrical']['directed_pairs']==spec['scan_gpio_per_half']*(spec['scan_gpio_per_half']-1), 'incomplete directed-pair coverage')
    require(model['electrical']['schematic_matches_pcb'],'schematic/PCB mismatch')
    require(model['tracks']==model['vias']==model['zones']==0,'unreviewed routing appeared')
    pitch=project['pitch_mm']
    keys=model['keys']; axis=sum(k['at'][0] for k in keys)/count
    base=min(k['at'][0] for k in keys)
    bottom=max(k['at'][1] for k in keys)
    for k in keys:
        require(abs(k['at'][0]-(base+k['column']*pitch))<1e-5,'wrong horizontal pitch')
        expected=bottom-spec['cumulative_stagger_mm'][k['column']]-(3-int(k['row'][1:]))*pitch
        require(abs(k['at'][1]-expected)<1e-5,'wrong stagger/row ordering')
        require(any(abs(o['at'][0]-(2*axis-k['at'][0]))<1e-5 and abs(o['at'][1]-k['at'][1])<1e-5 for o in keys),'key centres not bilaterally symmetric')

    keycuts=[unary_union([Polygon(c) for c in f['cuts']]) for f in switches]
    require(all(c.is_valid and c.geom_type=='MultiPolygon' and len(c.geoms)==2 for c in keycuts),'key must retain two distinct cuts')
    cuts=unary_union(keycuts)
    require(cuts.geom_type=='MultiPolygon' and len(cuts.geoms)==2*count,'adjacent cuts overlap/merge')
    require(boundary.covers(cuts),'cut outside perimeter')
    outline_land=cuts.distance(boundary.boundary)
    require(outline_land>=spec['outline_cut_land_min_mm'],'cut to exterior stationary rail below nominal guard')
    require(outline_land-2*rules['process']['routing_tolerance_mm']>=spec['outline_cut_land_adverse_min_mm'],'cut to exterior rail below adverse guard')
    bx,by,bx2,by2=boundary.bounds
    require(max(bx2-bx,by2-by)<spec['panel_max_exclusive_mm'],'half exceeds requested exclusive size limit')
    board=boundary.difference(cuts)
    require(board.is_valid and board.geom_type=='Polygon' and len(board.interiors)==2*count,'staggered board disconnected')
    rail=min(a.distance(b) for i,a in enumerate(keycuts) for b in keycuts[i+1:])
    require(rail>=project['shared_rail_min_mm'],'stationary rail below nominal guard')
    tol=rules['process']['routing_tolerance_mm']
    require(rail-2*tol>=project['shared_rail_adverse_stack_min_mm'],'stationary rail below adverse guard')
    beams=board.buffer(-project['beam_connection_width_guard_mm']/2,quad_segs=32)
    require(beams.geom_type=='Polygon' and len(beams.interiors)==2*count,'both beam paths do not survive width screen')
    necks=board.buffer(-project['island_neck_width_guard_mm']/2,quad_segs=32)
    corner=(boundary.bounds[2]-2,boundary.bounds[1]+2)
    stationary=component(necks,corner)
    require(stationary is not None,'stationary grid core missing')
    for sw in switches:
        core=component(necks,sw['at'][:2])
        require(core is not None and not core.equals(stationary),'island collapsed or bypasses beams')
        require(all(core.covers(Point(p['at'])) for p in sw['pads']),'pad/post disconnected through narrow island neck')
    # Diodes move with their switches, inside the existing moving-system window.
    # Keep each complete body/courtyard clear of routed cuts and switch holes.
    rigid=stationary.buffer(project['island_neck_width_guard_mm']/2,quad_segs=32)
    courtyards=[]; diode_switch_copper_gaps=[]; diode_switch_drill_gaps=[]
    for diode,sw in zip(diodes,switches):
        require(len(diode['courtyard'])==1,'diode courtyard absent')
        a,b=diode['courtyard'][0]; courtyard=box(*a,*b)
        island=component(necks,sw['at'][:2])
        require(island is not None and island.buffer(project['island_neck_width_guard_mm']/2,quad_segs=32).covers(courtyard),
                'diode is outside its switch island')
        require(courtyard.distance(cuts)>=project['component_courtyard_to_route_min_mm'],'diode assembly courtyard too near cut')
        for pad in sw['pads']:
            if pad.get('drill'):
                diode_switch_drill_gaps.append(courtyard.distance(capsule(pad['at'],pad['drill'])))
                require(courtyard.distance(capsule(pad['at'],pad['drill']))>=project['component_courtyard_to_route_min_mm'],
                        'diode courtyard too near switch drill')
            if pad['type']!='np_thru_hole':
                diode_switch_copper_gaps.extend(padshape(p).distance(padshape(pad)) for p in diode['pads'])
                require(courtyard.distance(padshape(pad))>=project['component_courtyard_to_route_min_mm'],
                        'diode courtyard too near switch copper')
        courtyards.append(courtyard)
    interface=[f for f in model['footprints'] if f not in switches and f not in diodes]
    for f in interface:
        for a,b in f['courtyard']:
            require(rigid.covers(box(*a,*b)),'interface component touches a moving island / flex beam: '+f['ref'])

    drills=[]; copper=[]; diode_clearances=[]
    for f in model['footprints']:
        for pad in f['pads']:
            if pad.get('drill'):
                hole=capsule(pad['at'],pad['drill']); drills.append(hole)
                require(board.covers(hole),'drill crosses edge or cut')
            if pad['type']!='np_thru_hole':
                cu=padshape(pad); copper.append(cu)
                require(board.covers(cu),'copper pad crosses cut/outline')
                gap=min(cu.distance(cuts),cu.distance(boundary.boundary))
                require(gap>=project['copper_to_route_regression_min_mm'],'pad copper clearance regressed')
                if f in diodes: diode_clearances.append(gap)
    drilled=board.difference(unary_union(drills))
    require(drilled.is_valid and drilled.geom_type=='Polygon' and len(drilled.interiors)==2*count+len(drills),'actual drilled half-board disconnected / holes merged')
    adverse=boundary.buffer(-tol).difference(cuts.buffer(tol)).difference(unary_union(drills).buffer(.065))
    require(adverse.is_valid and adverse.geom_type=='Polygon' and len(adverse.interiors)==2*count+len(drills),'drilled half disconnects under route/drill/outer-edge tolerance screen')
    hole_gap=min(a.distance(b) for i,a in enumerate(drills) for b in drills[i+1:])
    require(hole_gap>=rules['jlcpcb']['pad_hole_spacing_min_mm'],'hole-to-hole spacing')

    # Close the two deliberate suspension gaps in each cut pair and fill the
    # interior. This excludes the entire moving system, including both beams;
    # it does not put a gasket ring on the switch island. Preserve scallops.
    envelopes=[]
    for cut,sw in zip(keycuts,switches):
        radius=project['gasket_window_closing_radius_mm']; expanded=cut.buffer(radius,quad_segs=32)
        require(expanded.geom_type=='Polygon','cannot form one moving-system envelope')
        envelope=Polygon(expanded.exterior).buffer(-radius,quad_segs=32)
        require(envelope.buffer(.005).covers(cut),'support window omits routed region')
        require(all(envelope.covers(padshape(p)) for p in sw['pads']),'support window omits moving pad/hole')
        envelopes.append(envelope)
    windows=[p.buffer(project['gasket_edge_clearance_mm'],quad_segs=32) for p in envelopes]
    require(all(window.covers(courtyard.buffer(project['component_relief_clearance_mm']))
                for window,courtyard in zip(windows,courtyards)),
            'diode needs relief outside its existing gasket window')
    top=boundary.difference(unary_union(windows))
    web=min(a.distance(b) for i,a in enumerate(windows) for b in windows[i+1:])
    require(web>=project['gasket_unrelieved_web_min_mm'],'unrelieved gasket web too narrow')
    require(top.geom_type=='Polygon' and len(top.interiors)==count,'upper gasket sheet disconnected')
    # The whole upper-left interface bay opens to the case edge. It clears the
    # upright receptacle, underside contact resistors/TVS and protruding stakes.
    # It is intentionally removed on both support faces, not supported on parts.
    interface_courtyards=[box(*a,*b) for f in interface for a,b in f['courtyard']]
    upper_bay=None
    if interface_courtyards:
        # Follow the component groups with a stepped, edge-open bay. A single
        # bounding rectangle consumes the support above SW4 and beside SW8.
        relieved=[c.buffer(project['component_relief_clearance_mm']) for c in interface_courtyards]
        upper_bay=unary_union([box(boundary.bounds[0]-1,boundary.bounds[1]-1,c.bounds[2],c.bounds[3])
                              for c in relieved])
        require(upper_bay.covers(unary_union(relieved)),'interface bay omits component relief')
        top=top.difference(upper_bay)
    bottom=top
    # Deliberately cut away unsupported tongues in these gasket/rib concepts.
    # Keep the perimeter-connected frame and report each omitted lobe. Reject
    # large pieces, so a disconnected frame cannot be hidden by trimming.
    radius=project['beam_connection_width_guard_mm']/2
    trimmed=[]
    def trim_tongues(g, name):
        opened=g.buffer(-radius,quad_segs=32).buffer(radius,quad_segs=32)
        frame=component(opened,corner)
        require(frame is not None,name+' has no perimeter-connected frame')
        scraps=[p for p in parts(opened) if not p.equals(frame)]
        require(all(p.area<=project['support_trim_lobe_area_max_mm2'] for p in scraps),name+' would discard a substantial support component')
        require(all(p.distance(boundary.boundary)>radius for p in scraps),name+' would discard perimeter support')
        trimmed.append({'sheet':name,'omitted_lobes':len(scraps),'omitted_area_mm2':sum(p.area for p in scraps)})
        # Boolean clipping prevents round-buffer approximation from adding a
        # tiny amount of material back inside the original exclusion mask.
        frame=frame.intersection(g)
        require(frame.geom_type=='Polygon',name+' clipping disconnected the frame')
        return frame
    top=trim_tongues(top,'upper_gasket')
    bottom=trim_tongues(bottom,'lower_gasket')
    require(bottom.is_valid and bottom.geom_type=='Polygon','relieved lower gasket sheet disconnected')
    ribwindows=unary_union([p.buffer(project['rib_edge_clearance_mm'],quad_segs=32) for p in envelopes])
    ribbase=boundary.difference(ribwindows)
    if upper_bay is not None:ribbase=ribbase.difference(upper_bay)
    upper_ribs=trim_tongues(ribbase,'upper_ribs')
    lower_ribs=trim_tongues(ribbase,'lower_ribs')
    require(upper_ribs.geom_type==lower_ribs.geom_type=='Polygon','rib plan disconnected')
    require(top.intersection(unary_union(envelopes)).area<1e-8,'upper gasket touches moving system')
    require(bottom.intersection(unary_union(envelopes)).area<1e-8,'lower gasket touches moving system')
    require(bottom.equals(top),'upper and lower gasket support differ around switches')
    geometry={'upper_gasket':top,'lower_gasket':bottom,'upper_ribs':upper_ribs,'lower_ribs':lower_ribs}
    for name,g in geometry.items():
        require(len(g.interiors)==count,name+' does not fully surround every switch')
        holes=[Polygon(r) for r in g.interiors]
        require(all(any(h.covers(Point(sw['at'][:2])) for h in holes) for sw in switches),
                name+' opens a switch window into the interface bay or perimeter')
    bounds=boundary.bounds
    result={
        'keys':count,'scan_gpio':spec['scan_gpio_per_half'],'directed_pairs':model['electrical']['directed_pairs'],
        'width_mm':bounds[2]-bounds[0],'height_mm':bounds[3]-bounds[1],
        'thickness_mm':model['thickness'],'cutouts':2*count,
        'min_shared_rail_mm':rail,'shared_rail_adverse_stack_mm':rail-2*tol,
        'min_cut_to_outline_land_mm':outline_land,
        'cut_to_outline_adverse_stack_mm':outline_land-2*tol,
        'min_diode_copper_to_route_mm':min(diode_clearances),
        'min_diode_to_switch_copper_mm':min(diode_switch_copper_gaps),
        'min_diode_courtyard_to_switch_drill_mm':min(diode_switch_drill_gaps),
        'min_gasket_web_before_component_reliefs_mm':web,
        'min_hole_to_hole_mm':hole_gap,
        'drilled_half_connected':True,'adverse_half_connected':True,
        'two_beams_per_key_screen':True,'island_necks_screen':True,
        'diodes_on_moving_islands':True,'support_sheets_connected':True,
        'interface_on_stationary_grid':True,
        'enclosed_switch_windows_per_support_sheet':count,
        'interface_case_bay_bounds':list(upper_bay.bounds) if upper_bay is not None else None,
        'support_tongues_deliberately_omitted':trimmed,
        'schematic_matches_pcb':True,'unrouted':True,
    }
    return result,geometry


def write_support_review(geometry, directory):
    """Standalone dimensioned SVGs, with no application/browser dependency."""
    def polygon_path(g):
        def ring(coords):
            return 'M '+' L '.join(f'{x:.5f},{y:.5f}' for x,y in coords)+' Z'
        return ' '.join(ring(p.exterior.coords)+' '+' '.join(ring(r.coords) for r in p.interiors)
                        for p in ([g] if g.geom_type=='Polygon' else g.geoms))
    for name,g in geometry.items():
        x,y,x2,y2=g.bounds; w,h=x2-x,y2-y
        text=(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}mm" height="{h}mm" viewBox="{x} {y} {w} {h}">'
              f'<title>{name}: 2D support concept, not a fabrication drawing</title>'
              f'<path d="{polygon_path(g)}" fill="#4eaaa0" fill-rule="evenodd" stroke="none"/></svg>\n')
        (directory/f'{name}.svg').write_text(text)
    (directory/'support-plan.json').write_text(json.dumps({
        'status':'REVIEW CONCEPT ONLY - mounts, clamp nodes, stackup and hard stops pending',
        'sheets':{name:{'exterior':list(g.exterior.coords),'holes':[list(r.coords) for r in g.interiors]}
                  for name,g in geometry.items()},
    })+'\n')
