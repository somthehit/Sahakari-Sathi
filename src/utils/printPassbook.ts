/**
 * Print passbook transactions onto one of three selectable stationeries in a
 * single browser print job, aligned exactly as previewed on screen.
 *
 *   • 'booklet'  — overprint a pre-ruled physical passbook at true mm size,
 *                  resuming on the ruled line where the last print stopped.
 *   • 'a4'       — a full ruled A4 statement fallback (portrait).
 *   • 'thermal'  — an 80 mm continuous receipt-roll slip.
 *
 * Like `printChequeBook`, the physical sizes coexist through CSS *named pages*
 * (`@page passbook-leaf` / `passbook-a4` / `passbook-thermal`) assigned to the
 * print blocks via the `page` property, and a scoped `@media print` stylesheet
 * is injected so the app's compiled styles and all inline mm/pt sizing print
 * exactly as previewed while everything outside the print root is hidden. The
 * style and listeners are cleaned up on `afterprint` (with a timeout safety net).
 *
 * The caller renders the print root (one or more `.passbook-print-page` blocks)
 * into the DOM — typically a hidden portal on document.body — and passes its id.
 */

export type PassbookPrintMode = 'booklet' | 'a4' | 'thermal';

export interface PrintPassbookOptions {
  /** Booklet page size in mm (required for 'booklet'; ignored otherwise). */
  pageWidthMm?: number;
  pageHeightMm?: number;
  /** Thermal roll width in mm (default 80). */
  thermalWidthMm?: number;
}

const STYLE_ID = 'passbook-print-style';

/** Build the `@page` rule + block page-assignment for the chosen stationery. */
function pageCss(mode: PassbookPrintMode, rootId: string, opts: PrintPassbookOptions): string {
  if (mode === 'booklet') {
    const w = opts.pageWidthMm && opts.pageWidthMm > 0 ? opts.pageWidthMm : 105;
    const h = opts.pageHeightMm && opts.pageHeightMm > 0 ? opts.pageHeightMm : 165;
    return `
      @page passbook-leaf { size: ${w}mm ${h}mm; margin: 0; }
      #${rootId} .passbook-print-page { page: passbook-leaf; break-after: page; }
      #${rootId} .passbook-print-page:last-child { break-after: auto; }
    `;
  }
  if (mode === 'thermal') {
    const w = opts.thermalWidthMm && opts.thermalWidthMm > 0 ? opts.thermalWidthMm : 80;
    // `auto` height lets the roll advance to the slip's natural length.
    return `
      @page passbook-thermal { size: ${w}mm auto; margin: 0; }
      #${rootId} .passbook-print-page { page: passbook-thermal; break-after: page; }
      #${rootId} .passbook-print-page:last-child { break-after: auto; }
    `;
  }
  // 'a4'
  return `
    @page passbook-a4 { size: A4 portrait; margin: 0; }
    #${rootId} .passbook-print-page { page: passbook-a4; break-after: page; }
    #${rootId} .passbook-print-page:last-child { break-after: auto; }
  `;
}

export function printPassbook(
  rootId: string,
  mode: PassbookPrintMode,
  opts: PrintPassbookOptions = {},
): void {
  const root = document.getElementById(rootId);
  if (!root) {
    // Nothing to print — fail quietly rather than opening a blank dialog.
    // eslint-disable-next-line no-console
    console.warn(`printPassbook: element #${rootId} not found`);
    return;
  }

  document.getElementById(STYLE_ID)?.remove();

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.media = 'print';
  style.textContent = `
    ${pageCss(mode, rootId, opts)}
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
      /* Pages carry a screen shadow / rounded corners — strip for print. */
      #${rootId} .passbook-print-page {
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
