/* TEMPORARY diagnostics for the live-frame delay on the C9: shown on screen, bottom right. */
/* eslint-disable */
const started = Date.now();
export function diag(text: string): void {
  try {
    let box = document.getElementById('halg-diag');
    if (!box) {
      box = document.createElement('div');
      box.id = 'halg-diag';
      box.setAttribute('style', 'position:fixed;right:20px;bottom:120px;z-index:99999;width:900px;background:rgba(0,0,0,0.85);color:#ff0;font:22px/30px monospace;padding:10px;white-space:pre-wrap');
      document.body.appendChild(box);
    }
    const line = document.createElement('div');
    line.textContent = ((Date.now() - started) / 1000).toFixed(1) + 's ' + text;
    box.appendChild(line);
    while (box.childNodes.length > 12) box.removeChild(box.firstChild as Node);
  } catch (e) {}
}
