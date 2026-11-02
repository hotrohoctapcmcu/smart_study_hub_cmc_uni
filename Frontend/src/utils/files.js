export function saveBlob(response, filename) {
  const blob =
    response.data instanceof Blob ? response.data : new Blob([response.data]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function fileSize(bytes) {
  return Number(bytes) > 1048576
    ? (Number(bytes) / 1048576).toFixed(1) + " MB"
    : Math.round(Number(bytes || 0) / 1024) + " KB";
}
export function textContent(value) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}
