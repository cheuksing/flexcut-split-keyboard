'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse,parameters}=require('../scripts/lib/sexpr');
const diode=require('../ergogen/footprints/diode_sod523');
const {schematic}=require('../scripts/lib/keyboard-schematic');

test('CAD reader rejects the KiCanvas decimal regression outside quoted strings',()=>{
  for(const atom of ['.6','-.9','+.1']) {
    assert.throws(()=>parse(`(size ${atom} 1.2)`),/needs a leading zero/);
  }
  assert.deepEqual(parse('(size 0.6 -0.9 +0.1)'),['size','0.6','-0.9','+0.1']);
  assert.deepEqual(parse('(text "Keep .6 and -.9 as quoted text")'),['text','Keep .6 and -.9 as quoted text']);
});
test('diode footprint and schematic library emit canonical decimal atoms',()=>{
  const text=diode.body(parameters(diode,{anode:'(net 1 "A")',cathode:'(net 2 "K")'}));
  assert.match(text,/\(size 0\.5 0\.5\)/);
  assert.match(text,/\(size 0\.6 0\.7\)/);
  assert.doesNotThrow(()=>parse(text));
  assert.doesNotThrow(()=>parse(schematic([])));
});
