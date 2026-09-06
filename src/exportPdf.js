/**
 * Export Purchase Register to PDF / Printable Document
 * Formats according to Nepali VAT Purchase Register (खरिद खाता) guidelines.
 * Includes PWA top & bottom navigation bars with "Back to App" buttons for standalone iOS/Android PWAs.
 */
import { adToBs } from './adToBs.js'

function fmtRs(n) {
  const num = parseFloat(n)
  if (isNaN(num)) return '0.00'
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function exportPurchaseRegisterPDF({ entries, totals, filters = {}, profile = {} }) {
  if (!entries || entries.length === 0) return

  const taxpayerName = profile?.taxpayer_name || 'Business Accounting'
  const pan = profile?.pan || '—'
  const address = profile?.address || ''

  const filterPeriod = [
    filters.dateFrom ? `From: ${filters.dateFrom} (${adToBs(filters.dateFrom)} BS)` : '',
    filters.dateTo ? `To: ${filters.dateTo} (${adToBs(filters.dateTo)} BS)` : ''
  ].filter(Boolean).join('  |  ') || 'All Time'

  const printWindow = window.open('', '_blank', 'width=1000,height=800')
  if (!printWindow) {
    alert('Please allow popups to export the PDF.')
    return
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover">
  <title>Purchase Register - ${taxpayerName}</title>
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
    .btn-pwa-print {
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
    }
    .btn-pwa-print:active {
      background: #862300;
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
        padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
        display: flex;
        gap: 10px;
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
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
      }
      .btn-pwa-print-bottom {
        flex: 1.3;
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
      <span>← Back to Vyapaar (एपमा फर्कनुहोस्)</span>
    </button>
    <button class="btn-pwa-print" onclick="window.print()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      <span>Print / Save as PDF</span>
    </button>
  </div>

  <!-- Bottom Floating Bar for Mobile Touch Ergonomics -->
  <div class="pwa-bottom-bar no-print">
    <button class="btn-pwa-back-bottom" onclick="goBackToApp()">
      ← Back to App
    </button>
    <button class="btn-pwa-print-bottom" onclick="window.print()">
      🖨️ Print / Save PDF
    </button>
  </div>

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

    window.onload = function() {
      // Auto-trigger print dialog after render
      setTimeout(function() {
        window.print();
      }, 500);
    }
  </script>
</body>
</html>
`

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}
