/* TEMPORARY diagnostics for the live-frame delay on the C9: written to the TV's system log. */
/* eslint-disable */
export function diag(text: string): void {
  try {
    const w = window as any;
    const system = w.webOSSystem || w.PalmSystem;
    const line = '[' + (Date.now() % 100000) + '] ' + text;
    if (system && system.PmLogString) system.PmLogString(6, 'HALG_DIAG', '{}', line);
    console.log('HALG_DIAG ' + line);
  } catch (e) {}
}
