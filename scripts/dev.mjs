// Development server: rebuilds whenever a source file changes and serves the app at
// http://localhost:5173. Refresh the browser to see a change.
// Run with: npm run dev
// Only this computer can connect, unless DEV_OPEN=1 is set (to try it from another device).

import { context } from 'esbuild';
import { devBuildOptions, OUTPUT_FOLDER } from './lib/build-options.mjs';
import { copyStaticFiles } from './lib/copy-static.mjs';

const PORT = 5173;

copyStaticFiles();

const builder = await context(devBuildOptions);
await builder.watch();
const host = process.env.DEV_OPEN === '1' ? '0.0.0.0' : '127.0.0.1';
await builder.serve({ servedir: OUTPUT_FOLDER, port: PORT, host });

console.log('Serving on http://localhost:' + PORT + ' (Ctrl+C to stop)');
