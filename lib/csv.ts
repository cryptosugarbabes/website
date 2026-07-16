export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  text = text.replace(/[\r\n]+/g, " ").trim();
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function csvRow(values: unknown[]) {
  return values.map(csvCell).join(",");
}
