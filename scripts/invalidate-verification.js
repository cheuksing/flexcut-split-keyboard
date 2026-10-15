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
  const keyboardReview = path.join(root, 'build/keyboard/index.html');
  if (fs.existsSync(keyboardReview)) fs.writeFileSync(keyboardReview,
    '<!doctype html><html lang="en"><meta charset="utf-8"><title>Keyboard review stale</title><h1>Review needs regeneration</h1><p>A build/check has started. Run npm run review to regenerate the checked drawings. See docs/manufacturing-verification.md for the latest completed check or failure.</p></html>\n');
}

if (require.main === module) invalidate();
module.exports = invalidate;
