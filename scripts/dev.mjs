// Development server: rebuilds whenever a source file changes and serves the app at
// http://localhost:5173. Refresh the browser to see a change.
// Run with: npm run dev

import { context } from 'esbuild';
import { buildOptions, OUTPUT_FOLDER } from './lib/build-options.mjs';
import { copyStaticFiles } from './lib/copy-static.mjs';

const PORT = 5173;

copyStaticFiles();

const builder = await context(buildOptions);
await builder.watch();
await builder.serve({ servedir: OUTPUT_FOLDER, port: PORT });

console.log('Serving on http://localhost:' + PORT + ' (Ctrl+C to stop)');
