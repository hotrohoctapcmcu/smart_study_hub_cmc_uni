import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recognizeImage } from '../utils/notebookRecognition';

const mocks = vi.hoisted(() => ({ recognize: vi.fn(), terminate: vi.fn(), createWorker: vi.fn() }));
vi.mock('tesseract.js', () => ({ createWorker: mocks.createWorker }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.terminate.mockResolvedValue(undefined);
  mocks.recognize.mockResolvedValue({ data: { text: '  Định lý Pythagoras\n' } });
  mocks.createWorker.mockResolvedValue({ recognize: mocks.recognize, terminate: mocks.terminate });
});
describe('Notebook local OCR', () => {
  it('recognizes Vietnamese and English, returns an editable plain-text result and releases the worker', async () => {
    const progress = vi.fn();
    expect(await recognizeImage('data:image/png;base64,AAA', progress)).toBe('Định lý Pythagoras');
    expect(mocks.createWorker).toHaveBeenCalledWith('vie+eng', 1, expect.any(Object));
    expect(mocks.recognize).toHaveBeenCalledWith('data:image/png;base64,AAA');
    expect(mocks.terminate).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenLastCalledWith(1);
  });
  it('reports actionable empty-region and language-download errors and releases the worker', async () => {
    mocks.recognize.mockResolvedValueOnce({ data: { text: '  ' } });
    await expect(recognizeImage('image')).rejects.toThrow('Chưa nhận ra chữ');
    expect(mocks.terminate).toHaveBeenCalledTimes(1);
    mocks.createWorker.mockRejectedValueOnce(new Error('Network failed'));
    await expect(recognizeImage('image')).rejects.toThrow('Lần đầu cần mạng');
  });
  it('honors cancellation before loading and after worker initialization', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(recognizeImage('image', undefined, { signal: controller.signal })).rejects.toHaveProperty('name', 'AbortError');
    expect(mocks.createWorker).not.toHaveBeenCalled();
    const second = new AbortController();
    mocks.createWorker.mockImplementationOnce(async () => {
      second.abort();
      return { recognize: mocks.recognize, terminate: mocks.terminate };
    });
    await expect(recognizeImage('image', undefined, { signal: second.signal })).rejects.toHaveProperty('name', 'AbortError');
    expect(mocks.recognize).not.toHaveBeenCalled();
    expect(mocks.terminate).toHaveBeenCalledTimes(1);
  });
});
