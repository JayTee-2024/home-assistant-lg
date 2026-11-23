// Tests for the project's own lint rules in eslint.config.mjs. They lint small pieces
// of example code and check that the rule that should object does.

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint();

/** Lints `code` as if it were the file at `filePath` and returns the ids of the rules that objected. */
async function rulesBrokenBy(code, filePath) {
  const results = await eslint.lintText(code, { filePath });
  return results[0].messages.map((message) => message.ruleId);
}

describe('lasting code must not depend on the throwaway proof', () => {
  const importFromProof =
    "import type { ProbeResult } from '../proof/probe';\nexport type A = ProbeResult;\n";

  it('objects when a platform file imports from src/proof', async () => {
    expect(await rulesBrokenBy(importFromProof, 'src/platform/example.ts')).toContain(
      'no-restricted-imports',
    );
  });

  it('objects when a core file imports from src/proof', async () => {
    expect(await rulesBrokenBy(importFromProof, 'src/core/example.ts')).toContain(
      'no-restricted-imports',
    );
  });

  it('lets a proof file import from src/proof', async () => {
    expect(await rulesBrokenBy(importFromProof, 'src/proof/example.ts')).toEqual([]);
  });
});

describe('browser features that Chromium 53 lacks', () => {
  it.each([
    ['AbortController', 'export const a = new AbortController();\n'],
    ['queueMicrotask', 'queueMicrotask(() => {});\n'],
    ['ResizeObserver', 'export const a = new ResizeObserver(() => {});\n'],
    ['globalThis', 'export const a = globalThis;\n'],
    ['PointerEvent', 'export const a = (event: Event) => event instanceof PointerEvent;\n'],
    ['structuredClone', 'export const a = structuredClone({});\n'],
  ])('objects to %s in app code', async (_name, code) => {
    expect(await rulesBrokenBy(code, 'src/app/example.ts')).toContain('no-restricted-globals');
  });

  it('does not object to features Chromium 53 has', async () => {
    const code = "export const a = fetch('/x').then(() => new WebSocket('ws://x'));\n";

    expect(await rulesBrokenBy(code, 'src/app/example.ts')).toEqual([]);
  });

  it('leaves the build scripts alone, which run on this computer and not on the TV', async () => {
    const code = 'export const a = new AbortController();\n';

    expect(await rulesBrokenBy(code, 'scripts/example.mjs')).toEqual([]);
  });
});

describe('layers only depend downwards', () => {
  const importing = (path) => `import { x } from '${path}';\nexport const y = x;\n`;

  it.each(['../platform/http', '../devices/registry', '../screens/home/HomeScreen', '../app/App'])(
    'objects when a core file imports %s',
    async (path) => {
      expect(await rulesBrokenBy(importing(path), 'src/core/example.ts')).toContain(
        'no-restricted-imports',
      );
    },
  );

  it.each(['../../screens/home/HomeScreen', '../../platform/http', '../../app/App'])(
    'objects when a device type file imports %s',
    async (path) => {
      expect(await rulesBrokenBy(importing(path), 'src/devices/light/example.ts')).toContain(
        'no-restricted-imports',
      );
    },
  );

  it('lets a device type file import from core', async () => {
    expect(
      await rulesBrokenBy(importing('../../core/home-assistant'), 'src/devices/light/example.ts'),
    ).toEqual([]);
  });

  it('lets a core file import another core file', async () => {
    expect(await rulesBrokenBy(importing('./layout'), 'src/core/example.ts')).toEqual([]);
  });
});
