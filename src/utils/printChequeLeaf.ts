/**
 * Print a single cheque leaf at true physical size.
 *
 * The app-wide print helper (printDocumentById) is hard-wired to A4 portrait,
 * which is wrong for cheque stationery (a landscape strip measured in mm). This
 * routine temporarily injects a scoped @media print stylesheet that:
 *   - sets @page to the exact leaf size in mm with zero margin,
 *   - hides everything except the target leaf,
 *   - pins the leaf to the top-left at 1:1 scale.
 * It keeps the app's compiled stylesheet intact (same document), so all inline
 * mm/pt styling on the leaf prints exactly as previewed. The injected style and
 * listeners are removed on afterprint.
 */
export function printChequeLeaf(elementId: string, widthMm: number, heightMm: number): void {
  const el = document.getElementById(elementId);
  if (!el) {
    // Nothing to print — fail quietly rather than opening a blank dialog.
    // eslint-disable-next-line no-console
    console.warn(`printChequeLeaf: element #${elementId} not found`);
    return;
  }

  const STYLE_ID = 'cheque-print-style';
  document.getElementById(STYLE_ID)?.remove();

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.media = 'print';
  style.textContent = `
    @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
      body * { visibility: hidden !important; }
      #${elementId}, #${elementId} * { visibility: visible !important; }
      #${elementId} {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
    }
  `;
  document.head.appendChild(style);

  const cleanup = () => {
    document.getElementById(STYLE_ID)?.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // Safety net if afterprint never fires (some browsers).
  setTimeout(cleanup, 60000);

  window.print();
}
