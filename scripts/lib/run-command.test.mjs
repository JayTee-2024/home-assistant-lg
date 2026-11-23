// Tests for run-command.mjs. They run real, short-lived Node programs, so they test the
// real behaviour of pipes and exit codes and not a stand-in.

import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { runCommand } from './run-command.mjs';

const NODE = process.execPath;

describe('runCommand', () => {
  it('resolves with the exit code and the output', async () => {
    const result = await runCommand(NODE, ['-e', 'console.log("hello"); process.exit(3)']);

    expect(result.code).toBe(3);
    expect(result.output).toContain('hello');
    expect(result.timedOut).toBe(false);
    expect(result.notFound).toBe(false);
  });

  it('sends the input to the program', async () => {
    const result = await runCommand(NODE, ['-e', 'process.stdin.pipe(process.stdout)'], {
      input: Readable.from(['from the test']),
    });

    expect(result.output).toBe('from the test');
  });

  // This is what happens when the TV is off: ssh exits at once and never reads the package.
  it('reports the exit code when the program exits without reading a large input', async () => {
    const largeInput = Readable.from([Buffer.alloc(1024 * 1024, 'x')]);

    const result = await runCommand(NODE, ['-e', 'process.exit(255)'], { input: largeInput });

    expect(result.code).toBe(255);
  });

  it('says so when the program is not installed', async () => {
    const result = await runCommand('no-such-program-home-assist-lg', []);

    expect(result.notFound).toBe(true);
    expect(result.code).toBe(-1);
  });

  it('stops the program early when onOutput returns true', async () => {
    const result = await runCommand(
      NODE,
      ['-e', 'console.log("ready"); setTimeout(() => {}, 30000)'],
      { onOutput: (output) => output.includes('ready') },
    );

    expect(result.output).toContain('ready');
    expect(result.timedOut).toBe(false);
  });

  it('stops a program that runs too long and marks it as timed out', async () => {
    const result = await runCommand(NODE, ['-e', 'setTimeout(() => {}, 30000)'], {
      timeoutMs: 200,
    });

    expect(result.timedOut).toBe(true);
  });
});
