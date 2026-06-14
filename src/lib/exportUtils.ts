// Export utilities for CSV and Excel downloads

export interface ExportColumn<T> {
  header: string;
  accessor: keyof T | ((item: T) => string | number);
}

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
): void {
  // Build header row
  const headerRow = columns.map((col) => escapeCSV(col.header)).join(',');

  // Build data rows
  const dataRows = data.map((item) => {
    return columns
      .map((col) => {
        const value =
          typeof col.accessor === 'function'
            ? col.accessor(item)
            : item[col.accessor];
        return escapeCSV(value as string | number);
      })
      .join(',');
  });

  // Combine and create blob
  const csvContent = [headerRow, ...dataRows].join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Download
  downloadBlob(blob, `${filename}.csv`);
}

export function exportToExcel<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
): void {
  // For Excel, we'll use a simple XML spreadsheet format (works in Excel, Google Sheets, etc.)
  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Sheet1">
<Table>`;

  const xmlFooter = `</Table>
</Worksheet>
</Workbook>`;

  // Build header row
  const headerRow = `<Row>${columns.map((col) => `<Cell><Data ss:Type="String">${escapeXML(col.header)}</Data></Cell>`).join('')}</Row>`;

  // Build data rows
  const dataRows = data.map((item) => {
    const cells = columns.map((col) => {
      const value =
        typeof col.accessor === 'function'
          ? col.accessor(item)
          : item[col.accessor];
      const type = typeof value === 'number' ? 'Number' : 'String';
      return `<Cell><Data ss:Type="${type}">${escapeXML(String(value ?? ''))}</Data></Cell>`;
    });
    return `<Row>${cells.join('')}</Row>`;
  });

  const xmlContent = xmlHeader + headerRow + dataRows.join('') + xmlFooter;
  const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });

  downloadBlob(blob, `${filename}.xls`);
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
