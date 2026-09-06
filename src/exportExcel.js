/**
 * Export Purchase Register to Styled Excel Spreadsheet (.xls / XML Spreadsheet 2003)
 * Compatible with Microsoft Excel, Apple Numbers, Google Sheets, and LibreOffice Calc.
 *
 * Supports:
 * - Dynamic column widths calculated from maximum content length (accounting for largest supplier name)
 * - Custom brand colors (#ab2f00 terracotta header with bold white text)
 * - Text-formatted PAN column to prevent Excel scientific notation (e.g. 3E+08)
 * - Proper alignments (left for text, center for dates/codes, right for currency)
 * - Number formatting (#,##0.00)
 * - Styled summary totals row with double accounting underlines
 */

function escapeXml(val) {
  if (val == null) return ''
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function exportPurchaseRegisterExcel({ entries = [], totals = {}, filters = {}, profile = {} }) {
  if (!entries || entries.length === 0) return

  // Calculate maximum text lengths for dynamic column widths
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

  // Dynamic widths in points (1 char ~= 7-8 points + padding)
  const colWidths = [
    Math.max(105, maxInvoiceLen * 8 + 20),                // Col 1: Invoice No
    95,                                                   // Col 2: Date (BS) - consistent
    95,                                                   // Col 3: Date (AD) - consistent
    Math.min(360, Math.max(150, maxSupplierLen * 8 + 25)),// Col 4: Supplier Name - accounts for largest!
    110,                                                  // Col 5: Supplier PAN (text protected)
    Math.min(220, Math.max(115, maxAccountHeadLen * 8 + 15)), // Col 6: Account Head
    115,                                                  // Col 7: Tax Exempt (Rs.)
    125,                                                  // Col 8: Taxable Purchases (Rs.)
    115,                                                  // Col 9: Taxable Imports (Rs.)
    115,                                                  // Col 10: Capital Taxable (Rs.)
    115,                                                  // Col 11: 13% VAT (Rs.)
    120,                                                  // Col 12: Total Value (Rs.)
    130,                                                  // Col 13: Grand Total (Rs.)
    85,                                                   // Col 14: Missed Bill (छूट)
    85,                                                   // Col 15: Status
    Math.min(260, Math.max(100, maxNotesLen * 7.5 + 15))  // Col 16: Notes
  ]

  const headers = [
    'Invoice No.',
    'Date (BS)',
    'Date (AD)',
    'Supplier Name',
    'Supplier PAN',
    'Account Head',
    'Tax-Exempt (Rs.)',
    'Taxable Purchases (Rs.)',
    'Taxable Imports (Rs.)',
    'Capital Taxable (Rs.)',
    '13% VAT (Rs.)',
    'Total Value (Rs.)',
    'Grand Total (Rs.)',
    'Missed Bill',
    'Status',
    'Notes'
  ]

  // Summary figures
  const totalCount = entries.length
  const sumExempt  = Number(totals.tax_exempt_purchases || 0)
  const sumTaxable = Number(totals.taxable_purchases || 0)
  const sumImports = Number(totals.taxable_imports || 0)
  const sumCapital = Number(totals.capital_taxable_purchases || 0)
  const sumVat     = Number(totals.tax_amount || 0)
  const sumTotalVal= Number(totals.total_value || (sumExempt + sumTaxable + sumImports + sumCapital))
  const sumGrand   = Number(totals.grand_total || (sumTotalVal + sumVat))

  // Construct XML Spreadsheet 2003
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Purchase Register</Title>
  <Author>${escapeXml(profile.taxpayer_name || 'Vyapaar')}</Author>
  <Created>${new Date().toISOString()}</Created>
  <Company>${escapeXml(profile.taxpayer_name || 'Vyapaar')}</Company>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1C1B19"/>
  </Style>

  <!-- Title & Meta Styles -->
  <Style ss:ID="SheetTitle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="14" ss:Bold="1" ss:Color="#AB2F00"/>
  </Style>
  <Style ss:ID="SheetMeta">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#6B665E"/>
  </Style>

  <!-- Header Style: Terracotta Brand Background, Bold White Text -->
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="0"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#7A2200"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#AB2F00"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#AB2F00" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="HeaderLeft">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#7A2200"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#AB2F00"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#AB2F00" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="HeaderRight">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#7A2200"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#AB2F00"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#AB2F00" ss:Pattern="Solid"/>
  </Style>

  <!-- Data Row Styles: Normal & Zebra Alternating -->
  <Style ss:ID="CellLeft">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1C1B19"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EDE8DF"/></Borders>
  </Style>
  <Style ss:ID="CellLeftZebra">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1C1B19"/>
   <Interior ss:Color="#FAF8F5" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EDE8DF"/></Borders>
  </Style>

  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1C1B19"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EDE8DF"/></Borders>
  </Style>
  <Style ss:ID="CellCenterZebra">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1C1B19"/>
   <Interior ss:Color="#FAF8F5" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EDE8DF"/></Borders>
  </Style>

  <!-- Explicit String Format for PAN (Never converts to 3E+08) -->
  <Style ss:ID="CellPAN">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1C1B19"/>
   <NumberFormat ss:Format="@"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EDE8DF"/></Borders>
  </Style>
  <Style ss:ID="CellPANZebra">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1C1B19"/>
   <NumberFormat ss:Format="@"/>
   <Interior ss:Color="#FAF8F5" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EDE8DF"/></Borders>
  </Style>

  <!-- Currency Right-Aligned with 2 decimals -->
  <Style ss:ID="CellCurrency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1C1B19"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EDE8DF"/></Borders>
  </Style>
  <Style ss:ID="CellCurrencyZebra">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1C1B19"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Interior ss:Color="#FAF8F5" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EDE8DF"/></Borders>
  </Style>
  <Style ss:ID="CellGrandTotal">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Bold="1" ss:Color="#AB2F00"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EDE8DF"/></Borders>
  </Style>
  <Style ss:ID="CellGrandTotalZebra">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Bold="1" ss:Color="#AB2F00"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Interior ss:Color="#FAF8F5" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EDE8DF"/></Borders>
  </Style>

  <!-- Status badges -->
  <Style ss:ID="StatusPaid">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#2E6930"/>
   <Interior ss:Color="#EAF5EB" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EDE8DF"/></Borders>
  </Style>
  <Style ss:ID="StatusPartial">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#8F5E00"/>
   <Interior ss:Color="#FFF8E6" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EDE8DF"/></Borders>
  </Style>
  <Style ss:ID="StatusPending">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#A82800"/>
   <Interior ss:Color="#FDF0EB" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EDE8DF"/></Borders>
  </Style>

  <!-- Missed Bill Tag -->
  <Style ss:ID="MissedYes">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#C2410C"/>
   <Interior ss:Color="#FFEDD5" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EDE8DF"/></Borders>
  </Style>
  <Style ss:ID="MissedNo">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9" ss:Color="#8A8578"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EDE8DF"/></Borders>
  </Style>

  <!-- Summary Totals Row: Terracotta Bold with Top Solid and Bottom Double Border -->
  <Style ss:ID="TotalsLabel">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#AB2F00"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#AB2F00"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#AB2F00"/>
   <Interior ss:Color="#F5ECE6" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TotalsEmpty">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#AB2F00"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#AB2F00"/>
   </Borders>
   <Interior ss:Color="#F5ECE6" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TotalsCurrency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#AB2F00"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#AB2F00"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#AB2F00"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Interior ss:Color="#F5ECE6" ss:Pattern="Solid"/>
  </Style>
 </Styles>

 <Worksheet ss:Name="Purchase Register">
  <Table ss:DefaultRowHeight="20">
`

  // Append Column Widths
  colWidths.forEach(w => {
    xml += `   <Column ss:Width="${w}"/>\n`
  })

  // Title block
  const businessName = profile.taxpayer_name || 'Business Name'
  const panText = profile.pan ? ` | PAN: ${profile.pan}` : ''
  const exportDate = new Date().toLocaleDateString('en-GB')
  let periodText = 'All Entries'
  if (filters.dateFrom || filters.dateTo) {
    periodText = `${filters.dateFrom || 'Start'} to ${filters.dateTo || 'Present'}`
  }

  xml += `   <Row ss:Height="26">
    <Cell ss:StyleID="SheetTitle" ss:MergeAcross="5"><Data ss:Type="String">${escapeXml(businessName)} — Purchase Register (खरिद खाता)</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:StyleID="SheetMeta" ss:MergeAcross="5"><Data ss:Type="String">Period: ${escapeXml(periodText)}${escapeXml(panText)} | Exported: ${exportDate} (${totalCount} Invoices)</Data></Cell>
   </Row>
   <Row ss:Height="8"/>
`

  // Table Header Row
  xml += `   <Row ss:Height="26">\n`
  headers.forEach((h, idx) => {
    const isNum = idx >= 6 && idx <= 12
    const isLeft = idx === 0 || idx === 3 || idx === 5 || idx === 15
    const style = isNum ? 'HeaderRight' : (isLeft ? 'HeaderLeft' : 'Header')
    xml += `    <Cell ss:StyleID="${style}"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>\n`
  })
  xml += `   </Row>\n`

  // Data Rows
  entries.forEach((e, rIdx) => {
    const zebra = rIdx % 2 === 1 ? 'Zebra' : ''
    const status = (e.paid_status || 'pending').toLowerCase()
    let statusStyle = 'StatusPending'
    if (status === 'paid') statusStyle = 'StatusPaid'
    if (status === 'partial') statusStyle = 'StatusPartial'

    const missedStyle = e.is_missed_bill ? 'MissedYes' : 'MissedNo'
    const missedText = e.is_missed_bill ? 'YES (छूट)' : 'NO'

    xml += `   <Row ss:Height="20">\n`
    xml += `    <Cell ss:StyleID="CellLeft${zebra}"><Data ss:Type="String">${escapeXml(e.invoice_no)}</Data></Cell>\n`
    xml += `    <Cell ss:StyleID="CellCenter${zebra}"><Data ss:Type="String">${escapeXml(e.date_bs || '—')}</Data></Cell>\n`
    xml += `    <Cell ss:StyleID="CellCenter${zebra}"><Data ss:Type="String">${escapeXml((e.date_ad || '').slice(0, 10))}</Data></Cell>\n`
    xml += `    <Cell ss:StyleID="CellLeft${zebra}"><Data ss:Type="String">${escapeXml(e.supplier_name || '—')}</Data></Cell>\n`
    // PAN as explicit string format to avoid scientific notation
    xml += `    <Cell ss:StyleID="CellPAN${zebra}"><Data ss:Type="String">${escapeXml(e.supplier_pan || '')}</Data></Cell>\n`
    xml += `    <Cell ss:StyleID="CellLeft${zebra}"><Data ss:Type="String">${escapeXml(e.account_head || '')}</Data></Cell>\n`
    // Numbers
    xml += `    <Cell ss:StyleID="CellCurrency${zebra}"><Data ss:Type="Number">${Number(e.tax_exempt_purchases || 0).toFixed(2)}</Data></Cell>\n`
    xml += `    <Cell ss:StyleID="CellCurrency${zebra}"><Data ss:Type="Number">${Number(e.taxable_purchases || 0).toFixed(2)}</Data></Cell>\n`
    xml += `    <Cell ss:StyleID="CellCurrency${zebra}"><Data ss:Type="Number">${Number(e.taxable_imports || 0).toFixed(2)}</Data></Cell>\n`
    xml += `    <Cell ss:StyleID="CellCurrency${zebra}"><Data ss:Type="Number">${Number(e.capital_taxable_purchases || 0).toFixed(2)}</Data></Cell>\n`
    xml += `    <Cell ss:StyleID="CellCurrency${zebra}"><Data ss:Type="Number">${Number(e.tax_amount || 0).toFixed(2)}</Data></Cell>\n`
    xml += `    <Cell ss:StyleID="CellCurrency${zebra}"><Data ss:Type="Number">${Number(e.total_value || 0).toFixed(2)}</Data></Cell>\n`
    xml += `    <Cell ss:StyleID="CellGrandTotal${zebra}"><Data ss:Type="Number">${Number(e.grand_total || 0).toFixed(2)}</Data></Cell>\n`
    // Missed Bill & Status
    xml += `    <Cell ss:StyleID="${missedStyle}"><Data ss:Type="String">${missedText}</Data></Cell>\n`
    xml += `    <Cell ss:StyleID="${statusStyle}"><Data ss:Type="String">${status.toUpperCase()}</Data></Cell>\n`
    xml += `    <Cell ss:StyleID="CellLeft${zebra}"><Data ss:Type="String">${escapeXml(e.notes || '')}</Data></Cell>\n`
    xml += `   </Row>\n`
  })

  // Summary Totals Row
  xml += `   <Row ss:Height="24">\n`
  xml += `    <Cell ss:StyleID="TotalsLabel"><Data ss:Type="String">TOTAL (${totalCount} Invoices)</Data></Cell>\n`
  xml += `    <Cell ss:StyleID="TotalsEmpty"/>\n`
  xml += `    <Cell ss:StyleID="TotalsEmpty"/>\n`
  xml += `    <Cell ss:StyleID="TotalsEmpty"/>\n`
  xml += `    <Cell ss:StyleID="TotalsEmpty"/>\n`
  xml += `    <Cell ss:StyleID="TotalsEmpty"/>\n`
  xml += `    <Cell ss:StyleID="TotalsCurrency"><Data ss:Type="Number">${sumExempt.toFixed(2)}</Data></Cell>\n`
  xml += `    <Cell ss:StyleID="TotalsCurrency"><Data ss:Type="Number">${sumTaxable.toFixed(2)}</Data></Cell>\n`
  xml += `    <Cell ss:StyleID="TotalsCurrency"><Data ss:Type="Number">${sumImports.toFixed(2)}</Data></Cell>\n`
  xml += `    <Cell ss:StyleID="TotalsCurrency"><Data ss:Type="Number">${sumCapital.toFixed(2)}</Data></Cell>\n`
  xml += `    <Cell ss:StyleID="TotalsCurrency"><Data ss:Type="Number">${sumVat.toFixed(2)}</Data></Cell>\n`
  xml += `    <Cell ss:StyleID="TotalsCurrency"><Data ss:Type="Number">${sumTotalVal.toFixed(2)}</Data></Cell>\n`
  xml += `    <Cell ss:StyleID="TotalsCurrency"><Data ss:Type="Number">${sumGrand.toFixed(2)}</Data></Cell>\n`
  xml += `    <Cell ss:StyleID="TotalsEmpty"/>\n`
  xml += `    <Cell ss:StyleID="TotalsEmpty"/>\n`
  xml += `    <Cell ss:StyleID="TotalsEmpty"/>\n`
  xml += `   </Row>\n`

  xml += `  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>4</SplitHorizontal>
   <TopRowBottomPane>4</TopRowBottomPane>
   <ActivePane>2</ActivePane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `purchase-register-${new Date().toISOString().slice(0, 10)}.xls`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
