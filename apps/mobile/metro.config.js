// Metro config for the pnpm monorepo.
// Learn more: https://docs.expo.dev/guides/monorepos/
const path = require('node:path');

const { getDefaultConfig } = require('expo/metro-config');

const { syncSeedAsset } = require('./scripts/sync-seed-asset');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so edits in packages/* hot-reload in the app.
config.watchFolders = [...new Set([...(config.watchFolders ?? []), workspaceRoot])];

// Resolve dependencies from the app first, then the hoisted workspace root.
config.resolver.nodeModulesPaths = [
  ...new Set([
    ...(config.resolver.nodeModulesPaths ?? []),
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ]),
];

// Drizzle migrations import .sql files (inlined by babel-plugin-inline-import).
config.resolver.sourceExts.push('sql');

// The content seed ships as an asset (`assets/seed/seed.v1.seed`, copied from
// @italia/content) and is read at runtime, so it stays out of the JS bundle.
config.resolver.assetExts.push('seed');
syncSeedAsset();

module.exports = config;
