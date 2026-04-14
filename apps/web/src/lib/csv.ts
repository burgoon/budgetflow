/**
 * Minimal CSV utilities. No dependency — CSV with a UTF-8 BOM + CRLF line
 * endings opens cleanly in Excel, Numbers, and Google Sheets.
 */

function escapeCell(value: string | number): string {
  const text = typeof value === "number" ? String(value) : value;
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number>>): string {
  // Byte-order mark keeps Excel happy with non-ASCII characters.
  return "\ufeff" + rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
