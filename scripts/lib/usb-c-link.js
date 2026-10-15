'use strict';

const assert = require('node:assert/strict');
// USB Type-C R2.0, Table 3-10, printed p75. These are plug-to-plug
// conductors, NOT the pairs that remain equivalent on reversing a plug.
const cablePairs = [['A2','B11'], ['A3','B10'], ['B2','A11'],
  ['B3','A10'], ['A8','B8']];
const cable = Object.fromEntries(cablePairs.flatMap(([a,b])=>[[a,b],[b,a]]));
const flip = pin => (pin[0]==='A'?'B':'A')+pin.slice(1);

function orientationTable(groups, nc) {
  const pins=groups.flat(), all=Array.from({length:24},(_,i)=>(i<12?'A':'B')+(i%12+1));
  assert.equal(groups.length,5); assert(groups.every(g=>g.length===2));
  assert.equal(new Set(pins).size,10,'Signal pin repeated');
  assert.deepEqual([...pins,...nc].sort(),all.sort(),'Every contact must be a signal or explicit NC');
  return [false,true].flatMap(a=>[false,true].map(b=>{
    const destinations=groups.map(g=>[...new Set(g.map(pin=>{
      const out=cable[a?flip(pin):pin];
      assert(out,'Signal pin has no cable conductor');
      const socket=b?flip(out):out;
      const dest=groups.findIndex(other=>other.includes(socket));
      assert(dest>=0,'Cable lands on an NC contact');
      return dest+1;
    }))]);
    const independent=destinations.every(d=>d.length===1)&&new Set(destinations.flat()).size===5;
    return {adapter_reversed:a,half_reversed:b,destinations,independent};
  }));
}

function singleKeyInput({vdd, vf, vol, pullup, series}) {
  // Sense and sink each traverse the resistor at BOTH ends of the cable.
  const loop=2*(series.adapter+series.half+(series.contact_adapter||0)/2+(series.contact_half||0)/2);
  const current=(vdd-vf-vol)/(pullup+loop);
  return {loop_ohms:loop,current_amps:current,input_volts:vf+vol+current*loop};
}

// A topology screen only: a forward path exists, not a claim that every
// two-diode path crosses an actual MCU threshold. Return false extra keys.
function reachablePairs(pressed) {
  const reach=Array.from({length:5},()=>Array(5).fill(false));
  for(const [a,b] of pressed) { assert(a!==b); reach[a][b]=true; }
  for(let k=0;k<5;k++) for(let i=0;i<5;i++) for(let j=0;j<5;j++)
    reach[i][j] ||= reach[i][k]&&reach[k][j];
  return reach.flatMap((row,i)=>row.flatMap((yes,j)=>yes&&i!==j?[[i,j]]:[]));
}

function analyze(spec) {
  const requested=orientationTable(spec.requested_pairs,spec.nc);
  const selected=orientationTable(spec.selected_pairs,spec.nc);
  const m=spec.samd21_input_screen;
  const single_key=m.pullup_ohms.map(pullup=>({pullup_ohms:pullup,...singleKeyInput({
    vdd:m.vdd_volts,vf:m.illustrative_diode_vf_volts,vol:m.illustrative_sink_volts,
    pullup,series:{adapter:spec.adapter_series_ohms,half:spec.half_series_ohms,contact_adapter:spec.contact_series_ohms,contact_half:spec.contact_series_ohms}}),
    vil_max_volts:m.vdd_volts*m.vil_max_fraction}));
  const pressed=[[0,1],[1,2]], observed=reachablePairs(pressed);
  const ghosts=observed.filter(p=>!pressed.some(q=>q[0]===p[0]&&q[1]===p[1]));
  const orientationInvariant=selected.every(row=>row.independent&&JSON.stringify(row.destinations)===JSON.stringify(selected[0].destinations));
  const compensated=selected.map(row=>({...row,destinations:spec.adapter_logical_order_by_connector_group.map((_,logical)=>
    row.destinations[spec.adapter_logical_order_by_connector_group.indexOf(logical)])}));
  const lowMargin=single_key.every(row=>row.input_volts<=row.vil_max_volts);
  return {status:'DESIGN HOLD — passive interface implemented; electrical qualification pending',
    requested,selected,compensated,single_key,ghost_witness:{pressed,forward_paths:observed,extra_paths:ghosts},
    checks:{selected_orientation_invariant:orientationInvariant,
      compensated_identity:compensated.every(r=>r.destinations.every((d,i)=>d.length===1&&d[0]===i+1)),
      illustrative_single_key_all_corners_below_vil:lowMargin,
      ghost_forward_path_exists:ghosts.length>0},
    blockers:[
      ...(!orientationInvariant?['Selected pin groups change identity with plug orientation.']:[]),
      ...(!lowMargin?['The 6k closed-key loop lacks guaranteed digital-low margin with the minimum internal pull-up.']:[]),
      ...(ghosts.length?['Forward multi-key paths exist; scan method and measured rollover margins remain unresolved.']:[]),
      'Passive resistors and TVS do not guarantee GPIO overvoltage, powered-off backfeed or hot-plug safety.',
      'Actual cable continuity, powered/unpowered fault and board-level ESD qualification are pending.',
      'PCB is unrouted; native KiCad ERC/DRC and Gerber review have not run.'
    ]};
}

module.exports={cablePairs,flip,orientationTable,singleKeyInput,reachablePairs,analyze};
