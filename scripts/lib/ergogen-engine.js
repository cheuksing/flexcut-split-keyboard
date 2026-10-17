'use strict';

// Shared by the checked CAD build and the in-memory web preview. Loading a
// preview never calls the build, changes source files, or invalidates a report.
const ergogen = require('ergogen');
const standard = require('ergogen/src/templates/kicad8');

function configure() {
  for (const name of ['choc', 'diode_sod523', 'ks33', 'mx', 'interface_half', 'interface_adapter', 'mouse_bites']) {
    ergogen.inject('footprint', name, require(`../../ergogen/footprints/${name}`));
  }
  ergogen.inject('template', 'kicad8', {
    ...standard,
    body: p => standard.body(p).replace('(thickness 1.6)', '(thickness 1.2)'),
  });
  return ergogen;
}

module.exports = { configure };
