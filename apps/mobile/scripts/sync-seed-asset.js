// Copies the content seed (`@italia/content/seed.v1.json`) and the graded
// stories (`@italia/content/stories.v1.json`) to `assets/seed/*.seed`, so Metro
// bundles them as assets (by their `.seed` extension) instead of parsing
// megabytes of JSON into the JS bundle. The copies are generated (git-ignored);
// this runs on install and whenever Metro starts.
const fs = require('node:fs');
const path = require('node:path');

const ASSETS = [
  ['@italia/content/seed.v1.json', 'seed.v1.seed'],
  ['@italia/content/stories.v1.json', 'stories.v1.seed'],
].map(([module, name]) => ({
  source: require.resolve(module, { paths: [__dirname] }),
  target: path.resolve(__dirname, '../assets/seed', name),
}));

/** Write each asset copy if it is missing or differs from its source. Returns their paths. */
function syncSeedAsset() {
  for (const { source, target } of ASSETS) {
    const data = fs.readFileSync(source);
    let current = null;
    try {
      current = fs.readFileSync(target);
    } catch {
      // Missing: written below.
    }
    if (current === null || !current.equals(data)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data);
    }
  }
  return ASSETS.map((a) => a.target);
}

module.exports = {
  syncSeedAsset,
  SEED_ASSET_PATH: ASSETS[0].target,
  STORIES_ASSET_PATH: ASSETS[1].target,
};

if (require.main === module) syncSeedAsset();
