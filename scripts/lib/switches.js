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
    id: 'choc', study: 'choc', name: 'Kailh Choc V1 / V2',
    center: 5.1, envelope: [15, 15],
    pins: [{ number: '1', x: 5, y: -3.8 }, { number: '2', x: 0, y: -5.9 }],
    drill: 1.45,
    holes: [{ x: -5.5, y: 0, diameter: 1.9 }, { x: 5.5, y: 0, diameter: 1.9 }],
    // V1 uses the two NPTH locating posts; V2 uses the solderable metal support.
    // JLCPCB specifies plated slot length >= 2x width. Both pad and drill are capsules.
    support: { x: -5, y: 5.15, size: [2.4, 3.9], drill: [1.5, 3] },
    note: 'Combined PG1350 V1 / PG1353 V2 pattern: two V1 locating holes on the moving island; V2 support slot plated, unnumbered and unconnected. No LED aperture.',
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
