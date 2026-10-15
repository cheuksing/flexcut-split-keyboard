'use strict';

const fs = require('node:fs');
const path = require('node:path');

function invalidate() {
  const root = path.resolve(__dirname, '..');
  fs.writeFileSync(path.join(root, 'docs/manufacturing-verification.md'),
    '# Manufacturing verification\n\nStatus: **STALE / CHECK DID NOT COMPLETE**.\n\n' +
    'A new check has started. Only a completed run can replace this notice with exact-input results. See the command output for failures or missing dependencies.\n');
  const report = path.join(root, 'build/review/manufacturing-check.json');
  if (fs.existsSync(report)) fs.unlinkSync(report);
}

if (require.main === module) invalidate();
module.exports = invalidate;
