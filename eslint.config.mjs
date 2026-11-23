// Lint rules: the typescript-eslint recommended set, plus three rules of this project's own.
//
//   1. `any` is forbidden outright.
//   2. The layers: src/core imports from no other src folder, and so on (see layerRule below).
//   3. App code must not use the browser features listed below, which Chromium 53 lacks.
//
// Rules 2 and 3 are tested in scripts/lint-rules.test.mjs.
import tseslint from 'typescript-eslint';

// Browser features that TypeScript accepts but Chromium 53 (webOS TV 4.x) does not have,
// with the Chrome version that added each. TypeScript's browser type list cannot be pinned
// to an old browser, so this list catches the common traps. It is not complete: before
// using any browser feature not already used in this project, check it against Chrome 53
// (caniuse.com) and try it on a TV.
const MISSING_IN_CHROMIUM_53 = {
  AbortController: 66,
  AbortSignal: 66,
  BigInt: 67,
  BroadcastChannel: 54,
  FinalizationRegistry: 84,
  OffscreenCanvas: 69,
  PointerEvent: 55,
  ResizeObserver: 64,
  WeakRef: 84,
  WebAssembly: 57,
  customElements: 54,
  globalThis: 71,
  queueMicrotask: 71,
  structuredClone: 98,
  visualViewport: 61,
};

const missingFeatureRules = Object.entries(MISSING_IN_CHROMIUM_53).map(([name, chrome]) => ({
  name,
  message: `Chromium 53 (webOS TV 4.x) does not have ${name}. It arrived in Chrome ${chrome}.`,
}));

/** Builds the rule that stops the files in `files` importing from the named src folders. */
function layerRule(files, forbiddenFolders) {
  return {
    files,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: forbiddenFolders.map((folder) => ({
            group: [`**/${folder}/**`],
            message:
              folder === 'proof'
                ? 'src/proof is throwaway. Lasting code must not depend on it.'
                : `This folder must not import from src/${folder}. See "Layers" in the README.`,
          })),
        },
      ],
    },
  };
}

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', '.superpowers/'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  // The layers. Each folder may import only from the folders below it in this list:
  //   app > screens > devices > core, with platform beside them importing only core.
  layerRule(['src/core/**'], ['platform', 'devices', 'screens', 'app', 'proof']),
  layerRule(['src/platform/**'], ['devices', 'screens', 'app', 'proof']),
  layerRule(['src/devices/**'], ['platform', 'screens', 'app', 'proof']),
  {
    // Tests run on this computer's Node, not on the TV, so they are left out.
    files: ['src/**'],
    ignores: ['src/**/*.test.ts'],
    rules: {
      'no-restricted-globals': ['error', ...missingFeatureRules],
    },
  },
);
