// Runs one program and collects what it prints. deploy.mjs uses it for every ssh call.
//
// It only runs the program and reports what happened. Deciding what a result means,
// and what to tell the person, belongs to the caller.

import { spawn } from 'node:child_process';

/**
 * Runs `program` with `programArguments`. Never rejects. Resolves with:
 *   code      the exit code, or -1 when the program could not be started
 *   output    everything it printed, normal and error output together
 *   timedOut  true when it was stopped for running longer than `timeoutMs`
 *   notFound  true when the program is not installed on this computer
 *
 * `input` is an optional readable stream sent to the program as its input.
 * `onOutput` is called with the output so far each time more arrives; returning true
 * from it stops the program early.
 */
export function runCommand(
  program,
  programArguments,
  { input = null, onOutput = () => false, timeoutMs = 30000 } = {},
) {
  return new Promise((resolve) => {
    const child = spawn(program, programArguments, {
      stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    const collect = (chunk) => {
      output += chunk.toString();
      if (onOutput(output)) child.kill();
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    if (input) {
      // A program that exits without reading its input (ssh, when the TV is off) breaks
      // the pipe. That is not a separate failure: "close" below reports the exit code.
      child.stdin.on('error', () => {});
      input.pipe(child.stdin);
    }

    // "error" means the program itself could not be started.
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        code: -1,
        output: output + error.message,
        timedOut,
        notFound: error.code === 'ENOENT',
      });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, output, timedOut, notFound: false });
    });
  });
}
