/**
 * Export Purchase Register to True Modern Excel Spreadsheet (.xlsx)
 * Using ExcelJS — 100% compatible with Microsoft Excel (iOS, Android, Mac, Windows),
 * Apple Numbers, and Google Sheets.
 *
 * Fully supports:
 * - Dynamic column widths calculated from maximum content length (fits longest supplier name)
 * - True .xlsx OpenXML format (never rejected by mobile Excel)
 * - Brand terracotta colors (#AB2F00), fonts, and alternating zebra rows
 * - Protected text PAN column (never converts to scientific notation 3E+08)
 * - Accounting number format (#,##0.00) with top solid and bottom double underline
 */
import ExcelJS from 'exceljs'

function fmtDate(d) {
  if (!d) return '—'
  return String(d).slice(0, 10)
}

export async function exportPurchaseRegisterExcel({ entries = [], totals = {}, filters = {}, profile = {} }) {
  if (!entries || entries.length === 0) return

  const taxpayerName = profile?.taxpayer_name || 'Business Accounting'
  const pan = profile?.pan || '—'

  // 1. Calculate maximum text lengths for dynamic auto-fit column widths
  let maxSupplierLen = 14
  let maxAccountHeadLen = 12
  let maxNotesLen = 10
  let maxInvoiceLen = 11

  entries.forEach(e => {
    if (e.supplier_name && e.supplier_name.length > maxSupplierLen) {
      maxSupplierLen = e.supplier_name.length
    }
    if (e.account_head && e.account_head.length > maxAccountHeadLen) {
      maxAccountHeadLen = e.account_head.length
    }
    if (e.notes && e.notes.length > maxNotesLen) {
      maxNotesLen = e.notes.length
    }
    if (e.invoice_no && e.invoice_no.length > maxInvoiceLen) {
      maxInvoiceLen = e.invoice_no.length
    }
  })

  // 2. Create Workbook and Worksheet
  const workbook = new ExcelJS.Workbook()
  workbook.creator = taxpayerName
  workbook.lastModifiedBy = 'Vyapaar'
  workbook.created = new Date()
  workbook.modified = new Date()

  const worksheet = workbook.addWorksheet('Purchase Register', {
    views: [{ state: 'frozen', ySplit: 4 }] // Freeze header row
  })

  // 3. Define Columns with Dynamic Widths
  worksheet.columns = [
    { key: 'invoice_no',     width: Math.max(15, maxInvoiceLen + 4) },                  // Col 1: Invoice No
    { key: 'date_bs',        width: 14 },                                               // Col 2: Date (BS) - consistent
    { key: 'date_ad',        width: 14 },                                               // Col 3: Date (AD) - consistent
    { key: 'supplier_name',  width: Math.min(45, Math.max(22, maxSupplierLen + 5)) },  // Col 4: Supplier Name - accounts for largest!
    { key: 'supplier_pan',   width: 16 },                                               // Col 5: Supplier PAN (text protected)
    { key: 'account_head',   width: Math.min(28, Math.max(16, maxAccountHeadLen + 4)) },// Col 6: Account Head
    { key: 'tax_exempt',     width: 17 },                                               // Col 7: Tax-Exempt (Rs.)
    { key: 'taxable',        width: 19 },                                               // Col 8: Taxable Purchases (Rs.)
    { key: 'taxable_imports',width: 17 },                                               // Col 9: Taxable Imports (Rs.)
    { key: 'capital_taxable',width: 17 },                                               // Col 10: Capital Taxable (Rs.)
    { key: 'tax_amount',     width: 17 },                                               // Col 11: 13% VAT (Rs.)
    { key: 'total_value',    width: 18 },                                               // Col 12: Total Value (Rs.)
    { key: 'grand_total',    width: 19 },                                               // Col 13: Grand Total (Rs.)
    { key: 'missed_bill',    width: 14 },                                               // Col 14: Missed Bill (छूट)
    { key: 'status',         width: 13 },                                               // Col 15: Status
    { key: 'notes',          width: Math.min(38, Math.max(16, maxNotesLen + 5)) },      // Col 16: Notes
  ]

  // 4. Title & Meta Information (Rows 1 & 2)
  const titleRow = worksheet.addRow([`${taxpayerName} — Purchase Register (खरिद खाता)`])
  titleRow.height = 24
  titleRow.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFAB2F00' } }
  titleRow.alignment = { vertical: 'middle', horizontal: 'left' }

  let periodText = 'All Entries'
  if (filters.dateFrom || filters.dateTo) {
    const fromText = filters.dateFrom ? `${filters.dateFrom} BS` : 'Start'
    const toText = filters.dateTo ? `${filters.dateTo} BS` : 'Present'
    periodText = `${fromText} to ${toText}`
  }
  const exportDate = new Date().toLocaleDateString('en-GB')
  const metaRow = worksheet.addRow([`Period: ${periodText} | PAN: ${pan} | Exported: ${exportDate} (${entries.length} Invoices)`])
  metaRow.height = 18
  metaRow.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF6B665E' } }
  metaRow.alignment = { vertical: 'middle', horizontal: 'left' }

  // Empty spacer row 3
  const spacerRow = worksheet.addRow([])
  spacerRow.height = 8

  // 5. Header Row (Row 4)
  const headerValues = [
    'Invoice No.', 'Date (BS)', 'Date (AD)', 'Supplier Name', 'Supplier PAN',
    'Account Head', 'Tax-Exempt (Rs.)', 'Taxable Purchases (Rs.)', 'Taxable Imports (Rs.)',
    'Capital Taxable (Rs.)', '13% VAT (Rs.)', 'Total Value (Rs.)', 'Grand Total (Rs.)',
    'Missed Bill', 'Status', 'Notes'
  ]
  const headerRow = worksheet.addRow(headerValues)
  headerRow.height = 28

  headerRow.eachCell((cell, colNum) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFAB2F00' } // Brand Terracotta Red-Orange
    }
    cell.font = {
      name: 'Segoe UI',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    }
    const isNum = colNum >= 7 && colNum <= 13
    const isLeft = colNum === 1 || colNum === 4 || colNum === 6 || colNum === 16
    cell.alignment = {
      vertical: 'middle',
      horizontal: isNum ? 'right' : (isLeft ? 'left' : 'center'),
      wrapText: false
    }
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF7A2200' } },
      top: { style: 'thin', color: { argb: 'FFAB2F00' } }
    }
  })

  // 6. Data Rows
  entries.forEach((e, idx) => {
    const isZebra = idx % 2 === 1
    const bgArgb = isZebra ? 'FFFAF8F5' : 'FFFFFFFF'
    const status = (e.paid_status || 'pending').toUpperCase()
    const missedText = e.is_missed_bill ? 'YES (छूट)' : 'NO'

    const row = worksheet.addRow([
      String(e.invoice_no || ''),
      String(e.date_bs || '—'),
      fmtDate(e.date_ad),
      String(e.supplier_name || '—'),
      String(e.supplier_pan || ''), // Stored explicitly as string to avoid 3E+08
      String(e.account_head || ''),
      Number(e.tax_exempt_purchases || 0),
      Number(e.taxable_purchases || 0),
      Number(e.taxable_imports || 0),
      Number(e.capital_taxable_purchases || 0),
      Number(e.tax_amount || 0),
      Number(e.total_value || 0),
      Number(e.grand_total || 0),
      missedText,
      status,
      String(e.notes || '')
    ])

    row.height = 21

    row.eachCell((cell, colNum) => {
      // Default font & fill
      cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1C1B19' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFEDE8DF' } } }

      // Alignments & Number formatting
      if (colNum >= 7 && colNum <= 13) {
        cell.numFmt = '#,##0.00'
        cell.alignment = { vertical: 'middle', horizontal: 'right' }
        if (colNum === 13) {
          cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFAB2F00' } }
        }
      } else if (colNum === 2 || colNum === 3 || colNum === 5) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      } else if (colNum === 14) {
        // Missed bill tag
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        if (e.is_missed_bill) {
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFC2410C' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } }
        } else {
          cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF8A8578' } }
        }
      } else if (colNum === 15) {
        // Status badge
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        if (status === 'PAID') {
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF2E6930' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF5EB' } }
        } else if (status === 'PARTIAL') {
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF8F5E00' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E6' } }
        } else {
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFA82800' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF0EB' } }
        }
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' }
      }
    })
  })

  // 7. Summary Totals Row
  const sumExempt  = Number(totals.tax_exempt_purchases || 0)
  const sumTaxable = Number(totals.taxable_purchases || 0)
  const sumImports = Number(totals.taxable_imports || 0)
  const sumCapital = Number(totals.capital_taxable_purchases || 0)
  const sumVat     = Number(totals.tax_amount || 0)
  const sumTotalVal= Number(totals.total_value || (sumExempt + sumTaxable + sumImports + sumCapital))
  const sumGrand   = Number(totals.grand_total || (sumTotalVal + sumVat))

  const totalsRow = worksheet.addRow([
    `TOTAL (${entries.length} Invoices)`, '', '', '', '', '',
    sumExempt, sumTaxable, sumImports, sumCapital, sumVat, sumTotalVal, sumGrand,
    '', '', ''
  ])
  totalsRow.height = 25

  totalsRow.eachCell((cell, colNum) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5ECE6' } // Warm ivory highlight
    }
    cell.font = {
      name: 'Segoe UI',
      size: 10,
      bold: true,
      color: { argb: 'FFAB2F00' }
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFAB2F00' } },
      bottom: { style: 'double', color: { argb: 'FFAB2F00' } } // Accounting double bottom line
    }

    if (colNum >= 7 && colNum <= 13) {
      cell.numFmt = '#,##0.00'
      cell.alignment = { vertical: 'middle', horizontal: 'right' }
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'left' }
    }
  })

  // 8. Generate True .xlsx Binary and Trigger Mobile/Desktop Download
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })

  const filename = `purchase-register-${new Date().toISOString().slice(0, 10)}.xlsx`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
