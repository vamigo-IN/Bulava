/**
 * Pre-bundle the Remotion project at image build time:
 *
 *   node dist/bundle.js [outDir]
 *
 * The production worker then serves this folder instead of running webpack on
 * every start (faster boot, and no TypeScript sources needed at runtime).
 */
import path from 'node:path';

export const DEFAULT_BUNDLE_DIR = path.resolve(__dirname, '../remotion-bundle');

async function main(): Promise<void> {
  // Loaded here, not at the top: the worker imports DEFAULT_BUNDLE_DIR from this module, and the
  // bundler (webpack, rspack) is a dev dependency that production images leave out.
  const { bundle } = await import('@remotion/bundler');
  const outDir = path.resolve(process.argv[2] ?? DEFAULT_BUNDLE_DIR);
  const serveUrl = await bundle({ entryPoint: path.resolve(__dirname, '../remotion/index.ts'), outDir, enableCaching: false });
  console.log(`Remotion bundle written to ${serveUrl}`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
