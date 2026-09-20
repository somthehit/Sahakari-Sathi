/**
 * Prints the contents of a DOM element (identified by id) in a clean A4
 * window using the Tailwind CDN. Falls back to window.print() if the node
 * is missing or a popup is blocked.
 */
export function printDocumentById(elementId: string, title: string, className = ''): void {
  const content = document.getElementById(elementId);
  if (!content) {
    window.print();
    return;
  }

  const printWindow = window.open('', '_blank', 'width=850,height=950');
  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #ffffff; color: #0f172a; }
          .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
          .font-serif { font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif; }
          ${className}
        </style>
      </head>
      <body class="bg-white">
        <div class="max-w-4xl mx-auto bg-white p-2">
          ${content.innerHTML}
        </div>
        <script>
          window.onload = () => {
            setTimeout(() => { window.print(); window.close(); }, 350);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
