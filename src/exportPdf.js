/**
 * Export Purchase Register to PDF / Printable Document
 * Formats according to Nepali VAT Purchase Register (खरिद खाता) guidelines.
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
      color: #eb5e28;
    }
    .meta-bar {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      margin-bottom: 12px;
      color: #444;
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
      font-family: 'Courier New', Courier, monospace;
      font-size: 10.5px;
    }
    tr.missed-row {
      background: #fff8f5;
    }
    .tag-missed {
      display: inline-block;
      font-size: 8.5px;
      padding: 1px 4px;
      border-radius: 3px;
      background: #eb5e28;
      color: #fff;
      font-weight: bold;
      margin-left: 4px;
    }
    tfoot tr {
      background: #eae5dc;
      font-weight: 800;
    }
    tfoot td {
      border-top: 2px solid #252422;
    }
    .summary-card {
      margin-top: 14px;
      border: 1.5px solid #252422;
      border-radius: 6px;
      padding: 10px 14px;
      background: #fdfbf7;
      display: flex;
      justify-content: space-around;
      font-size: 11px;
    }
    .summary-item {
      text-align: center;
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
      color: #eb5e28;
    }
    .print-controls {
      position: fixed;
      top: 10px;
      right: 10px;
      background: #eb5e28;
      color: #fff;
      border: none;
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    @media print {
      .print-controls {
        display: none;
      }
    }
  </style>
</head>
<body>
  <button class="print-controls" onclick="window.print()">Print / Save as PDF</button>

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
        <th style="width: 75px;">Date (BS)</th>
        <th style="width: 75px;">Date (AD)</th>
        <th style="width: 90px;">Invoice No.</th>
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
        <td class="num"><strong style="color: #eb5e28;">${fmtRs(totals?.grand_total)}</strong></td>
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
