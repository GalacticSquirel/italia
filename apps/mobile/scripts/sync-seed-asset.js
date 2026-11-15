// Copies the content seed (`@italia/content/seed.v1.json`) to
// `assets/seed/seed.v1.seed`, so Metro bundles it as an asset (by its `.seed`
// extension) instead of parsing 7 MB of JSON into the JS bundle. The copy is
// generated (git-ignored); it runs on install and whenever Metro starts.
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = require.resolve('@italia/content/seed.v1.json', { paths: [__dirname] });
const TARGET = path.resolve(__dirname, '../assets/seed/seed.v1.seed');

/** Write the asset copy if it is missing or differs from the seed. Returns its path. */
function syncSeedAsset() {
  const source = fs.readFileSync(SOURCE);
  let current = null;
  try {
    current = fs.readFileSync(TARGET);
  } catch {
    // Missing: written below.
  }
  if (current === null || !current.equals(source)) {
    fs.mkdirSync(path.dirname(TARGET), { recursive: true });
    fs.writeFileSync(TARGET, source);
  }
  return TARGET;
}

module.exports = { syncSeedAsset, SEED_ASSET_PATH: TARGET };

if (require.main === module) syncSeedAsset();
