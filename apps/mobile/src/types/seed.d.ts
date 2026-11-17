/** A content seed bundled as an asset (see `scripts/sync-seed-asset.js`): its asset module id. */
declare module '*.seed' {
  const asset: number;
  export default asset;
}
