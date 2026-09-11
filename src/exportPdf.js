/**
 * Export Purchase Register to PDF / Printable Document
 * Formats according to Nepali VAT Purchase Register (खरिद खाता) guidelines.
 * Includes direct PDF generation via html2pdf for iOS standalone PWAs,
 * clean vector SVG icons (no emojis), and responsive navigation back to Vyapaar.
 */
import { adToBs, bsToAd } from './adToBs.js'

function formatFilterDate(dStr) {
  if (!dStr) return ''
  if (dStr.startsWith('207') || dStr.startsWith('208') || dStr.startsWith('209')) {
    const ad = bsToAd(dStr)
    return ad ? `${dStr} BS (${ad} AD)` : `${dStr} BS`
  }
  const bs = adToBs(dStr)
  return bs ? `${dStr} (${bs} BS)` : dStr
}

function fmtRs(n) {
  const num = parseFloat(n)
  if (isNaN(num)) return '0.00'
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function loadHtml2Pdf() {
  return new Promise((resolve, reject) => {
    if (window.html2pdf) {
      return resolve(window.html2pdf)
    }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
    script.onload = () => resolve(window.html2pdf)
    script.onerror = err => reject(err)
    document.body.appendChild(script)
  })
}

function buildReportContentHtml({ entries, totals, taxpayerName, pan, address, filterPeriod }) {
  return `
  <div class="header">
    <div class="company-name">${taxpayerName}</div>
    ${address ? `<div class="company-sub">${address}</div>` : ''}
    <div class="company-sub">PAN: <strong>${pan}</strong></div>
    <div class="report-title">खरिद खाता (PURCHASE REGISTER)</div>
  </div>

  <div class="meta-bar">
    <div><strong>Period:</strong> ${filterPeriod}</div>
    <div><strong>Total Invoices:</strong> ${entries.length}</div>
    <div><strong>Generated On:</strong> ${new Date().toLocaleDateString()}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 30px;">S.N.</th>
        <th style="width: 70px;">Date (BS)</th>
        <th style="width: 70px;">Date (AD)</th>
        <th style="width: 85px;">Invoice No.</th>
        <th>Supplier</th>
        <th style="width: 80px;">PAN</th>
        <th class="num" style="width: 85px;">Tax Exempt</th>
        <th class="num" style="width: 90px;">Taxable</th>
        <th class="num" style="width: 75px;">VAT (13%)</th>
        <th class="num" style="width: 95px;">Grand Total</th>
      </tr>
    </thead>
    <tbody>
      ${entries.map((e, idx) => `
        <tr class="${e.is_missed_bill ? 'missed-row' : ''}">
          <td style="text-align: center;">${idx + 1}</td>
          <td>${e.date_bs || '—'}</td>
          <td>${e.date_ad ? String(e.date_ad).slice(0,10) : '—'}</td>
          <td>
            <strong>${e.invoice_no}</strong>
            ${e.is_missed_bill ? '<span class="tag-missed">छूट</span>' : ''}
          </td>
          <td>${e.supplier_name || '—'}</td>
          <td>${e.supplier_pan || '—'}</td>
          <td class="num">${fmtRs(e.tax_exempt_purchases)}</td>
          <td class="num">${fmtRs(e.taxable_purchases)}</td>
          <td class="num">${fmtRs(e.tax_amount)}</td>
          <td class="num"><strong>${fmtRs(e.grand_total)}</strong></td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="6" style="text-align: right; font-weight: 800; font-size: 11px;">TOTALS:</td>
        <td class="num"><strong>${fmtRs(totals?.tax_exempt_purchases)}</strong></td>
        <td class="num"><strong>${fmtRs(totals?.taxable_purchases)}</strong></td>
        <td class="num"><strong>${fmtRs(totals?.tax_amount)}</strong></td>
        <td class="num"><strong style="color: #ab2f00;">${fmtRs(totals?.grand_total)}</strong></td>
      </tr>
    </tfoot>
  </table>

  <div class="summary-card">
    <div class="summary-item">
      <div class="summary-label">Total Bills</div>
      <div class="summary-val">${totals?.count || entries.length}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Tax-Free (Exempt)</div>
      <div class="summary-val">Rs. ${fmtRs(totals?.tax_exempt_purchases)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Taxable Purchases</div>
      <div class="summary-val">Rs. ${fmtRs(totals?.taxable_purchases)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">13% Input VAT</div>
      <div class="summary-val highlight">Rs. ${fmtRs(totals?.tax_amount)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Net Grand Total</div>
      <div class="summary-val">Rs. ${fmtRs(totals?.grand_total)}</div>
    </div>
  </div>
  `
}

export function exportPurchaseRegisterPDF({ entries, totals, filters = {}, profile = {} }) {
  if (!entries || entries.length === 0) return

  const taxpayerName = profile?.taxpayer_name || 'Business Accounting'
  const pan = profile?.pan || '—'
  const address = profile?.address || ''

  const filterPeriod = [
    filters.dateFrom ? `From: ${formatFilterDate(filters.dateFrom)}` : '',
    filters.dateTo ? `To: ${formatFilterDate(filters.dateTo)}` : ''
  ].filter(Boolean).join('  |  ') || 'All Time'

  const printWindow = window.open('', '_blank', 'width=1000,height=800')
  if (!printWindow) {
    // Popup was blocked by browser (common on iOS standalone PWAs)
    // Seamless in-page PDF generation fallback
    directDownloadPDF({ entries, totals, taxpayerName, pan, address, filterPeriod })
    return
  }

  const reportBody = buildReportContentHtml({ entries, totals, taxpayerName, pan, address, filterPeriod })

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover">
  <title>Purchase Register - ${taxpayerName}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      color: #1a1917;
      background: #ffffff;
      padding: 16px;
    }

    /* ── PWA Top Sticky Bar (Non-Printable) ── */
    .pwa-top-bar {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      background: #1c1917;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: calc(10px + env(safe-area-inset-top, 0px)) 16px 12px;
      margin: -16px -16px 18px -16px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
    }
    .btn-pwa-back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      -webkit-tap-highlight-color: transparent;
      transition: background 0.15s;
    }
    .btn-pwa-back:active {
      background: rgba(255, 255, 255, 0.3);
    }
    .pwa-actions-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-pwa-download {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #ab2f00;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      -webkit-tap-highlight-color: transparent;
      box-shadow: 0 2px 6px rgba(171, 47, 0, 0.4);
      transition: background 0.15s;
    }
    .btn-pwa-download:active {
      background: #862300;
    }
    .btn-pwa-print {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      -webkit-tap-highlight-color: transparent;
      transition: background 0.15s;
    }
    .btn-pwa-print:active {
      background: rgba(255, 255, 255, 0.25);
    }

    /* ── Mobile Floating Bottom Bar (Thumb-Friendly) ── */
    .pwa-bottom-bar {
      display: none;
    }
    @media (max-width: 768px) {
      .pwa-bottom-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 9999;
        background: rgba(28, 25, 23, 0.96);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
        display: flex;
        gap: 8px;
        box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.2);
      }
      .btn-pwa-back-bottom {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        background: #2b2826;
        color: #ffffff;
        border: 1px solid #44403c;
        border-radius: 10px;
        padding: 12px;
        font-size: 12.5px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
      }
      .btn-pwa-download-bottom {
        flex: 1.5;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        background: #ab2f00;
        color: #ffffff;
        border: none;
        border-radius: 10px;
        padding: 12px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
        box-shadow: 0 2px 8px rgba(171, 47, 0, 0.35);
      }
      .btn-pwa-print-bottom {
        flex: 0.8;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        background: #2b2826;
        color: #ffffff;
        border: 1px solid #44403c;
        border-radius: 10px;
        padding: 12px 8px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
      }
      body {
        padding-bottom: 84px !important;
      }
    }

    @media print {
      .no-print {
        display: none !important;
      }
      body {
        padding: 0 !important;
      }
    }

    /* ── Document Content ── */
    #printableContent {
      width: 100%;
      background: #ffffff;
    }
    .header {
      text-align: center;
      margin-bottom: 16px;
      border-bottom: 2px solid #252422;
      padding-bottom: 10px;
    }
    .company-name {
      font-size: 18px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .company-sub {
      font-size: 11px;
      color: #555;
      margin-top: 3px;
    }
    .report-title {
      font-size: 14px;
      font-weight: 700;
      margin-top: 6px;
      color: #ab2f00;
    }
    .meta-bar {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      margin-bottom: 12px;
      color: #444;
      flex-wrap: wrap;
      gap: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 14px;
    }
    th, td {
      border: 1px solid #ccc;
      padding: 6px 8px;
      text-align: left;
    }
    th {
      background: #f4f0ea;
      font-weight: 700;
      color: #222;
      font-size: 9.5px;
      text-transform: uppercase;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .missed-row {
      background: #fffcf7;
    }
    .tag-missed {
      display: inline-block;
      font-size: 8.5px;
      font-weight: 700;
      background: #eb5e28;
      color: #fff;
      padding: 1px 4px;
      border-radius: 3px;
      margin-left: 4px;
    }
    .summary-card {
      border: 2px solid #252422;
      background: #fdfbf7;
      border-radius: 6px;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .summary-item {
      text-align: center;
      flex: 1;
      min-width: 100px;
    }
    .summary-label {
      font-size: 9px;
      text-transform: uppercase;
      color: #666;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .summary-val {
      font-size: 13px;
      font-weight: 800;
      color: #1a1917;
    }
    .summary-val.highlight {
      color: #ab2f00;
    }
  </style>
</head>
<body>
  <!-- Top Navigation Bar for standalone PWA & desktop -->
  <div class="pwa-top-bar no-print">
    <button class="btn-pwa-back" onclick="goBackToApp()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      <span>Back to Vyapaar (एपमा फर्कनुहोस्)</span>
    </button>
    <div class="pwa-actions-group">
      <button class="btn-pwa-download" onclick="downloadPDF()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span class="btn-dl-text">Download PDF</span>
      </button>
      <button class="btn-pwa-print" onclick="window.print()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        <span>Print</span>
      </button>
    </div>
  </div>

  <!-- Bottom Floating Bar for Mobile Touch Ergonomics -->
  <div class="pwa-bottom-bar no-print">
    <button class="btn-pwa-back-bottom" onclick="goBackToApp()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      <span>Back to App</span>
    </button>
    <button class="btn-pwa-download-bottom" onclick="downloadPDF()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      <span class="btn-dl-text">Download PDF</span>
    </button>
    <button class="btn-pwa-print-bottom" onclick="window.print()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      <span>Print</span>
    </button>
  </div>

  <div id="printableContent">
    ${reportBody}
  </div>

  <script>
    function goBackToApp() {
      try {
        if (window.opener && !window.opener.closed) {
          window.close();
          return;
        }
      } catch (e) {}

      if (window.history && window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/';
      }
    }

    async function downloadPDF() {
      var spans = document.querySelectorAll('.btn-dl-text');
      spans.forEach(function(s) { s.textContent = 'Generating PDF...'; });
      var el = document.getElementById('printableContent');
      var opt = {
        margin: [8, 6, 8, 6],
        filename: 'Purchase_Register_${new Date().toISOString().slice(0, 10)}.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      try {
        if (window.html2pdf) {
          await window.html2pdf().set(opt).from(el).save();
        } else {
          window.print();
        }
      } catch (err) {
        console.error('PDF generation error:', err);
        window.print();
      } finally {
        spans.forEach(function(s) { s.textContent = 'Download PDF'; });
      }
    }
  </script>
</body>
</html>
`

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}

/**
 * Direct in-page download fallback when window.open popup is blocked by iOS WebKit / PWA.
 */
async function directDownloadPDF({ entries, totals, taxpayerName, pan, address, filterPeriod }) {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = '1100px'
  container.style.background = '#ffffff'
  container.style.padding = '16px'
  container.style.zIndex = '-1'

  container.innerHTML = `
    <style>
      .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #252422; padding-bottom: 10px; font-family: sans-serif; }
      .company-name { font-size: 18px; font-weight: 800; text-transform: uppercase; }
      .company-sub { font-size: 11px; color: #555; margin-top: 3px; }
      .report-title { font-size: 14px; font-weight: 700; margin-top: 6px; color: #ab2f00; }
      .meta-bar { display: flex; justify-content: space-between; font-size: 10.5px; margin-bottom: 12px; color: #444; font-family: sans-serif; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 14px; font-family: sans-serif; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      th { background: #f4f0ea; font-weight: 700; color: #222; text-transform: uppercase; font-size: 9.5px; }
      .num { text-align: right; font-variant-numeric: tabular-nums; }
      .summary-card { border: 2px solid #252422; background: #fdfbf7; border-radius: 6px; padding: 12px 16px; display: flex; justify-content: space-between; margin-top: 10px; font-family: sans-serif; }
      .summary-item { text-align: center; flex: 1; }
      .summary-label { font-size: 9px; text-transform: uppercase; color: #666; font-weight: 600; margin-bottom: 2px; }
      .summary-val { font-size: 13px; font-weight: 800; color: #1a1917; }
      .summary-val.highlight { color: #ab2f00; }
      .tag-missed { display: inline-block; font-size: 8.5px; font-weight: 700; background: #eb5e28; color: #fff; padding: 1px 4px; border-radius: 3px; margin-left: 4px; }
    </style>
    ${buildReportContentHtml({ entries, totals, taxpayerName, pan, address, filterPeriod })}
  `
  document.body.appendChild(container)

  try {
    const html2pdfLib = await loadHtml2Pdf()
    const opt = {
      margin: [8, 6, 8, 6],
      filename: `Purchase_Register_${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    }
    await html2pdfLib().set(opt).from(container).save()
  } catch (err) {
    console.error('Direct fallback PDF download error:', err)
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container)
    }
  }
}
