"""Inspect emitted adapter/panel CAD. Physical screens, not release approval."""
from shapely.geometry import Polygon, Point, box,LineString
from shapely.ops import unary_union

def material(model):
    rings=sorted([Polygon(r) for r in model['perimeter']],key=lambda p:-p.area)
    assert rings and all(r.is_valid for r in rings),'invalid fabrication contour'
    boundary=rings[0].difference(unary_union(rings[1:]))
    cuts=unary_union([Polygon(c) for f in model['footprints'] for c in f['cuts']])
    return boundary.difference(cuts),rings

def copper_shape(p):
    x,y=p['at'];w,h=p['size']
    if p['shape']=='rect':return box(x-w/2,y-h/2,x+w/2,y+h/2)
    return capsule([x,y],[w,h])

def capsule(at,size):
    x,y=at;w,h=size if len(size)==2 else size*2
    dx,dy=max(0,(w-h)/2),max(0,(h-w)/2)
    return (Point(x,y) if dx==dy==0 else LineString([(x-dx,y-dy),(x+dx,y+dy)])).buffer(min(w,h)/2,quad_segs=32)

def inspect(model,rules,label):
    k=rules['keyboard'];board,rings=material(model)
    assert board.is_valid and board.geom_type=='Polygon',label+': board disconnected'
    assert model['min_outline_radius_mm']>=rules['project']['arc_radius_min_mm'],label+': outline corner too sharp'
    pads=[];npths=[];drills=[];courtyards=[];tab_drills=[]
    for f in model['footprints']:
        for p in f['pads']:
            cu=copper_shape(p)
            assert board.covers(cu),f"{label}: pad/hole outside retained material {f['ref']}.{p['number']}"
            if p.get('drill'):
                d=capsule(p['at'],p['drill'])
                if f['name']=='keyboard-design:mouse_bites':
                    assert p['type']=='np_thru_hole' and not p['number'] and p['net'] is None
                    assert abs(p['drill'][0]-k['mouse_bite_hole_diameter_mm'])<1e-6
                    tab_drills.append(d)
                else:drills.append(d)
                if p['type']=='np_thru_hole':npths.append((f,p,d))
                elif not f['ref'].startswith('SW'):
                    assert (min(p['size'])-max(p['drill']))/2>=rules['jlcpcb']['pth_annular_ring_recommended_mm']-1e-5,f['ref']+': PTH ring'
            if p['type']!='np_thru_hole':
                assert cu.distance(board.boundary)>=rules['project']['copper_to_route_regression_min_mm'],f['ref']+': copper to route'
                pads.append((f,p,cu))
        if f['name'] in ['keyboard-design:choc','keyboard-design:mouse_bites']:continue
        for a,b in f['courtyard']:
            co=box(*a,*b)
            if f['name']!='keyboard-design:xiao12':
                assert board.covers(co),f['ref']+': assembly courtyard outside material'
                assert co.distance(board.boundary)>=rules['project']['component_courtyard_to_route_min_mm']-1e-5,f['ref']+': courtyard to route'
            courtyards.append((f,co))
    mingap=999
    for i,(f,p,a) in enumerate(pads):
        for g,q,b in pads[i+1:]:
            same_face=bool(set(p['layers'])&set(q['layers'])) or '*.Cu' in p['layers'] or '*.Cu' in q['layers']
            if not same_face or (p['net'] is not None and p['net']==q['net']):continue
            gap=a.distance(b);mingap=min(mingap,gap)
            assert gap>=k['interface_copper_clearance_min_mm']-1e-5,f"{label}: copper spacing {f['ref']}.{p['number']} / {g['ref']}.{q['number']} = {gap:.4f}"
        for g,q,d in npths:
            assert a.distance(d)>=k['interface_copper_to_npth_min_mm']-1e-5,f"{label}: copper to NPTH {f['ref']}/{g['ref']}"
    for i,(f,a) in enumerate(courtyards):
        for g,b in courtyards[i+1:]:
            if f['side']!=g['side']:continue
            assert a.intersection(b).area<1e-7,f"{label}: courtyard collision {f['ref']}/{g['ref']}"
    hole_gap=min((a.distance(b) for i,a in enumerate(drills) for b in drills[i+1:]),default=999)
    assert hole_gap>=rules['jlcpcb']['pad_hole_spacing_min_mm']-1e-5,label+': functional drill spacing'
    drilled=board.difference(unary_union(drills+tab_drills))
    assert drilled.geom_type=='Polygon' and drilled.is_valid,label+': drilled board disconnected'
    return {'components':len(model['footprints']),'min_copper_spacing_mm':mingap,
            'min_functional_drill_spacing_mm':hole_gap,'functional_drills':len(drills),
            'perforation_drills':len(tab_drills),'drilled_connected':True},board,rings,drilled

def verify_panel(half,adapter,panel,rules):
    k=rules['keyboard'];a,ab,ar,_=inspect(adapter,rules,'adapter')
    p,pb,pr,drilled=inspect(panel,rules,'panel')
    hb,_=material(half)
    eps=k['geometry_measurement_tolerance_mm']
    gap=hb.distance(ab)
    assert gap>=k['panel_fit_route_gap_mm']-eps,'adapter separation too narrow'
    assert hb.intersection(ab).area<1e-8,'separated boards overlap'
    assert pb.buffer(eps).covers(hb.union(ab)),'panel omits half/adapter material'
    x,y,x2,y2=pb.bounds;w,h=x2-x,y2-y
    assert max(w,h)+2*rules['process']['routing_tolerance_mm']<k['panel_max_exclusive_mm'],'panel plus outline tolerance exceeds size target'
    bites=[f for f in panel['footprints'] if f['name']=='keyboard-design:mouse_bites']
    assert len(bites)==k['mouse_bite_tab_count']==2,'wrong tab count'
    strips=[]
    for f,expected_x in zip(sorted(bites,key=lambda f:f['at'][0]),[80,116.2]):
        assert abs(f['at'][0]-expected_x)<1e-5 and abs(f['at'][1]-132.2)<1e-5,'mouse-bite placement'
        assert len(f['pads'])==k['mouse_bite_holes_per_tab'],'wrong hole count'
        ordered=sorted(f['pads'],key=lambda p:p['at'][0])
        for l,r in zip(ordered,ordered[1:]):
            assert abs(r['at'][0]-l['at'][0]-k['mouse_bite_hole_pitch_mm'])<1e-5
        assert k['mouse_bite_hole_pitch_mm']-k['mouse_bite_hole_diameter_mm']>=k['mouse_bite_hole_edge_gap_min_mm']
        strips.append(box(expected_x-4,131.9,expected_x+4,132.5))
    separated=drilled.difference(unary_union(strips))
    assert separated.geom_type=='MultiPolygon' and len(separated.geoms)==2,'depanel screen does not leave two intact boards'
    # The internal routed gap between tabs must admit a 1 mm cutter.
    for route in pr[1:]:
        swept=route.buffer(-.5,quad_segs=64).buffer(.5,quad_segs=64)
        assert not swept.is_empty and route.hausdorff_distance(swept)<.02,'internal panel gap inaccessible to cutter'
    return {'status':'PHYSICAL SCREENS PASS - UNROUTED ENGINEERING REVIEW',
      'width_mm':w,'height_mm':h,'outline_tolerance_upper_bound_mm':[w+.4,h+.4],
      'min_board_separation_mm':gap,'adapter':a,'panel':p,
      'tabs':len(bites),'holes_per_tab':k['mouse_bite_holes_per_tab'],
      'separated_boards_connected':True,'actual_adapter_and_panel_in_cad':True,
      'xiao_mount':'two six-pin headers; D0/5V omitted; depanel before mounting',
      'header_standoff_min_mm':k['adapter_header_standoff_min_mm']}
