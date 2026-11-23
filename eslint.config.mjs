// Lint rules: the typescript-eslint recommended set, plus three rules of this project's own.
//
//   1. `any` is forbidden outright.
//   2. Lasting code (src/core, src/platform) must not import from the throwaway TV proof.
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

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', '.superpowers/'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['src/core/**', 'src/platform/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/proof/**'],
              message: 'src/proof is throwaway. Lasting code must not depend on it.',
            },
          ],
        },
      ],
    },
  },
  {
    // Tests run on this computer's Node, not on the TV, so they are left out.
    files: ['src/**'],
    ignores: ['src/**/*.test.ts'],
    rules: {
      'no-restricted-globals': ['error', ...missingFeatureRules],
    },
  },
);
