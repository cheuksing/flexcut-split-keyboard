'use strict';

// Small strict reader for validating and rendering our emitted KiCad subset.
// This is not a replacement for a KiCad load/DRC/export check.
function parse(text) {
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[()]|[^\s()]+/g) || [];
  let position = 0;
  function read() {
    const token = tokens[position++];
    if (token !== '(') throw new Error(`Expected opening parenthesis, got ${token}`);
    const result = [];
    while (tokens[position] !== ')') {
      if (position >= tokens.length) throw new Error('Unclosed expression');
      if (tokens[position] === '(') result.push(read());
      else {
        const value = tokens[position++];
        // KiCanvas cannot start a numeric token with a decimal point. Require
        // canonical leading zeros in every emitted CAD file, not just the one
        // pad/font field that first exposed the problem. Quoted text is exempt.
        if (/^[+-]?\.\d/.test(value)) throw new Error(`Decimal atom ${value} needs a leading zero (for example 0.6, not .6)`);
        result.push(value.startsWith('"') ? JSON.parse(value) : value);
      }
    }
    position++;
    return result;
  }
  const result = read();
  if (position !== tokens.length) throw new Error('Trailing expression');
  return result;
}

const children = (node, name) => node.filter(item => Array.isArray(item) && item[0] === name);
const child = (node, name) => children(node, name)[0];
const numbers = (node, name) => child(node, name)?.slice(1).map(Number);

function primitives(tree) {
  return tree.filter(node => Array.isArray(node) && ['fp_line', 'fp_arc'].includes(node[0]) && child(node, 'layer')[1] === 'Edge.Cuts')
    .map(node => ({ type: node[0].slice(3), start: numbers(node, 'start'),
      end: numbers(node, 'end'), ...(node[0] === 'fp_arc' ? { mid: numbers(node, 'mid') } : {}) }));
}

function parameters(fp, overrides = {}) {
  return {
    ...fp.params,
    from: '(net 1 "REVIEW_FROM")', to: '(net 2 "REVIEW_TO")',
    at: '(at 0 0 0)', r: 0, ref: 'SW1', ref_hide: 'hide', ...overrides,
  };
}

module.exports = { parse, child, children, numbers, primitives, parameters };
