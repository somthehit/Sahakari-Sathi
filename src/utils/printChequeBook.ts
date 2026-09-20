/**
 * Print a full cheque book handover package in a single job: an A4
 * acknowledgement slip followed by every blank leaf at true physical size.
 *
 * The two stationery sizes coexist through CSS *named pages* — `@page slip`
 * (A4 portrait) and `@page leaf` (the design's exact mm size) — assigned to the
 * slip and leaf blocks via the `page` property. As with `printChequeLeaf`, a
 * scoped @media print stylesheet is injected so the app's compiled styles and
 * all inline mm/pt sizing print exactly as previewed; everything outside the
 * print root is hidden. The style and listeners are cleaned up on afterprint.
 *
 * The caller renders the print root (slip + leaves) into the DOM — typically a
 * hidden portal on document.body carrying `.cheque-print-slip` and
 * `.cheque-print-leaf` blocks — and passes its element id here.
 */
export function printChequeBook(rootId: string, leafWidthMm: number, leafHeightMm: number): void {
  const root = document.getElementById(rootId);
  if (!root) {
    // Nothing to print — fail quietly rather than opening a blank dialog.
    // eslint-disable-next-line no-console
    console.warn(`printChequeBook: element #${rootId} not found`);
    return;
  }

  const STYLE_ID = 'cheque-book-print-style';
  document.getElementById(STYLE_ID)?.remove();

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.media = 'print';
  style.textContent = `
    @page cheque-slip { size: A4 portrait; margin: 16mm 14mm; }
    @page cheque-leaf { size: ${leafWidthMm}mm ${leafHeightMm}mm; margin: 0; }
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
      body > * { visibility: hidden !important; }
      #${rootId}, #${rootId} * { visibility: visible !important; }
      #${rootId} {
        display: block !important;
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: auto !important;
        margin: 0 !important;
      }
      #${rootId} .cheque-print-slip { page: cheque-slip; break-after: page; }
      #${rootId} .cheque-print-leaf { page: cheque-leaf; break-after: page; }
      #${rootId} .cheque-print-leaf:last-child { break-after: auto; }
      /* Leaves carry a screen shadow / rounded corners — strip for print. */
      #${rootId} .cheque-print-leaf > div {
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
