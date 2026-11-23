/**
 * Adds the JavaScript functions that Chromium 53 (webOS TV 4.x) lacks.
 * Import this file first, before any other code runs.
 *
 * This list and the "lib" list in tsconfig.json are a pair: tsconfig lets the code use
 * exactly what Chromium 53 has plus what is added here. To use a newer function, add its
 * polyfill here and its lib entry there, together.
 *
 * Newer syntax (async functions, object spread and so on) is not handled here. The build
 * rewrites syntax; see scripts/lib/build-options.mjs.
 */

// Chrome 54
import 'core-js/modules/es.object.entries.js';
import 'core-js/modules/es.object.values.js';
import 'core-js/modules/es.object.get-own-property-descriptors.js';
// Chrome 57
import 'core-js/modules/es.string.pad-start.js';
import 'core-js/modules/es.string.pad-end.js';
// Chrome 63
import 'core-js/modules/es.promise.finally.js';
// Chrome 69
import 'core-js/modules/es.array.flat.js';
import 'core-js/modules/es.array.flat-map.js';
// Chrome 73
import 'core-js/modules/es.object.from-entries.js';
// Chrome 76
import 'core-js/modules/es.promise.all-settled.js';
