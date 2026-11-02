// OCR runs locally in a worker. Only its engine and Vietnamese/English language
// models are downloaded on first use; notebook images stay in the browser.
export async function recognizeImage(src, onProgress = () => {}, { signal } = {}) {
  if (!src || (typeof src === 'string' && !src.trim())) throw new Error('Hãy chọn ảnh hoặc vùng chữ viết trước khi nhận dạng.');
  if (signal?.aborted) throw new DOMException('Đã hủy nhận dạng.', 'AbortError');
  let worker;
  let cancelled = false;
  let reportedProgress = 0;
  const cancel = () => { cancelled = true; worker?.terminate(); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    onProgress(0);
    const { createWorker } = await import('tesseract.js');
    worker = await createWorker('vie+eng', 1, {
      logger: ({ status, progress }) => {
        if (!cancelled) {
          reportedProgress = Math.max(reportedProgress, status === 'recognizing text' ? .25 + Math.max(0, Math.min(1, progress || 0)) * .75 : Math.min(.24, Math.max(0, progress || 0) * .24));
          onProgress(reportedProgress);
        }
      },
    });
    if (cancelled || signal?.aborted) throw new DOMException('Đã hủy nhận dạng.', 'AbortError');
    const result = await worker.recognize(src);
    if (cancelled) throw new DOMException('Đã hủy nhận dạng.', 'AbortError');
    const text = String(result.data?.text || '').trim();
    if (!text) throw new Error('Chưa nhận ra chữ trong vùng chọn. Hãy chọn vùng rõ hơn, tăng độ tương phản hoặc nhập lại trong bản xem trước.');
    onProgress(1);
    return text;
  } catch (error) {
    if (cancelled || error?.name === 'AbortError') throw new DOMException('Đã hủy nhận dạng.', 'AbortError');
    if (error?.message?.startsWith('Chưa nhận ra chữ')) throw error;
    throw new Error('Không thể nhận dạng. Lần đầu cần mạng để tải bộ nhận dạng tiếng Việt; hãy kiểm tra kết nối và thử lại. ' + (error?.message || ''));
  } finally {
    signal?.removeEventListener('abort', cancel);
    if (worker) await worker.terminate().catch(() => {});
  }
}
