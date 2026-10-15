'use strict';

// Physical coordinates are top/component view, +X right, +Y down, in mm.
// Pin numbering intentionally follows design-notes.md (including MX).
module.exports = [
  {
    id: 'ks33', study: 'gat', name: 'Gateron KS-33',
    center: 5.25, envelope: [15, 15],
    pins: [{ number: '1', x: -4.4, y: 4.7 }, { number: '2', x: 2.6, y: 5.75 }],
    drill: 1.45, holes: [],
    note: 'KS-33 solder pattern; center bore corrected to the supplied manufacturer drawing (5.25 mm). No LED aperture.',
  },
  {
    id: 'choc', study: 'choc', name: 'Kailh Choc V2',
    center: 5.1, envelope: [15, 15],
    pins: [{ number: '1', x: 5, y: -3.8 }, { number: '2', x: 0, y: -6 }],
    drill: 1.45, holes: [],
    // A KiCad oval is a capsule, wider diagonally than the study's ellipse.
    // Reduce each pad dimension by 0.10 mm to preserve its routed clearance.
    support: { x: -5, y: 5.15, size: [2.4, 2.9], drill: [1.5, 2] },
    note: 'Choc V2 only: the study does not provide Choc V1 locating-hole lobes. Support slot is plated, unnumbered and unconnected.',
  },
  {
    id: 'mx', study: 'mx', name: 'Cherry MX',
    center: 3.99, envelope: [15.6, 15.6],
    pins: [{ number: '1', x: -3.81, y: -2.54 }, { number: '2', x: 2.54, y: -5.08 }],
    drill: 1.524,
    holes: [{ x: -5.08, y: 0, diameter: 1.7 }, { x: 5.08, y: 0, diameter: 1.7 }],
    note: 'Five-pin MX solder pattern. Pin numbering follows the study, not the Ergogen built-in MX footprint.',
  },
];
