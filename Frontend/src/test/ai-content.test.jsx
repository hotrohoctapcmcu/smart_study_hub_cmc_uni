import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AIContent, { EditableAIContent } from '../components/common/AIContent';
import { ChatInput } from '../pages/AITutor/AITutor';
import { formatAIResult } from '../utils/aiAdapter';
import { markdownPages, markdownRuns } from '../utils/markdownCanvas';
import { pageToSvg, textContentHeight } from '../utils/textbookCanvas';
import apiClient from '../api/apiClient';
import { aiApi } from '../api';
import { prepareAIMarkdown } from '../utils/aiMarkdown';

describe('AI display and editing edge cases', () => {
  it('renders bold, nested emphasis, lists, tables and literal code escapes', () => {
    const { container } = render(<AIContent text={'# Tiêu đề\n\n**Đậm *nghiêng*** 🧠 a\u0301\n\n- Mục một\n- Mục hai\n\n| A | B |\n|---|---|\n| Dữ liệu | 2 |\n\n```js\nconst path = "C:\\new\\test";\nconst text = "\\n";\n```'} />);
    expect(container.querySelector('strong em').textContent).toBe('nghiêng');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('table').textContent).toContain('Dữ liệu');
    expect(container.querySelector('pre code').textContent).toContain('C:\\new\\test');
    expect(container.textContent).toContain('🧠 a\u0301');
    expect(screen.getByRole('region', { name: 'Bảng trong câu trả lời' })).toBeTruthy();
  });
  it('unwraps only an explicit whole-response Markdown fence', () => {
    const { container, rerender } = render(<AIContent text={'```markdown\n**Đậm**\n```'} />);
    expect(container.querySelector('strong').textContent).toBe('Đậm');
    rerender(<AIContent text={'```js\n**code literal**\n```'} />);
    expect(container.querySelector('pre').textContent).toContain('**code literal**');
  });
  it('keeps raw HTML inert, blocks unsafe URLs and does not fetch generated images', () => {
    const { container } = render(<AIContent text={'<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[nguy hiểm](javascript:alert%281%29)\n\n![mô tả](https://example.com/pixel)\n\n[nguồn](https://example.com)'} />);
    expect(container.querySelector('script,img,[onerror]')).toBeNull();
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
    expect(container.querySelector('a').getAttribute('rel')).toBe('noopener noreferrer');
    expect(container.textContent).toContain('mô tả');
  });
  it('renders valid math and preserves invalid/incomplete notation without crashing', () => {
    const { container, rerender } = render(<AIContent text={'Công thức $x^2 + y^2$\n\n$$\\frac{a}{b}$$'} />);
    expect(container.querySelectorAll('.katex').length).toBeGreaterThan(0);
    rerender(<AIContent text={'**chưa đóng\n```js\nconst x = "🧠";\n\n$$\\unknownCommand{'} />);
    expect(container.textContent).toContain('chưa đóng');
    expect(container.textContent).toContain('🧠');
  });
  it('supports provider LaTeX delimiters while preserving code and escaped paths', () => {
    const source = 'Giải \\(x^2\\).\n\\[\\frac{a}{b}\\]\n\n`\\(literal\\)`\n\n```js\nconst p = "\\[file\\]";\n```';
    const prepared = prepareAIMarkdown(source);
    expect(prepared).toContain('$x^2$');
    expect(prepared).toContain('`\\(literal\\)`');
    expect(prepared).toContain('const p = "\\[file\\]";');
    const { container } = render(<AIContent text={source} />);
    expect(container.querySelectorAll('.katex')).toHaveLength(2);
  });
  it('handles null, structured responses and very long output without dropping the tail', () => {
    const { container, rerender } = render(<AIContent text={null} />);
    expect(container.textContent).toBe('');
    rerender(<AIContent text={{ summary: '**nội dung**', value: 0 }} />);
    expect(container.textContent).toContain('nội dung');
    const text = 'x'.repeat(100001) + ' KẾT THÚC';
    rerender(<AIContent text={text} />);
    expect(container.querySelector('.ai-plain').textContent).toBe(text);
  });
  it('supports Markdown editing, preview, applying and cancelling without corrupting the source', () => {
    const change = vi.fn();
    const { container } = render(<EditableAIContent text="**Đậm**" onChange={change} />);
    fireEvent.click(screen.getByText('Chỉnh sửa định dạng'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '**Bản sửa**\n\n`C:\\new`' } });
    fireEvent.click(screen.getByText('Xem trước'));
    expect(container.querySelector('strong').textContent).toBe('Bản sửa');
    fireEvent.click(screen.getByText('Áp dụng bản sửa'));
    expect(change).toHaveBeenCalledWith('**Bản sửa**\n\n`C:\\new`');
    fireEvent.click(screen.getByText('Chỉnh sửa định dạng'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'bỏ' } });
    fireEvent.click(screen.getByText('Hủy sửa'));
    expect(container.querySelector('strong').textContent).toBe('Bản sửa');
  });
  it('counts Unicode codepoints consistently with the API and blocks oversized submits', () => {
    const send = vi.fn(), props = { onChange: vi.fn(), onSend: send, busy: false };
    const { rerender } = render(<ChatInput {...props} value={'🧠'.repeat(32000)} />);
    expect(screen.getByRole('button', { name: 'Gửi tin nhắn' }).disabled).toBe(false);
    rerender(<ChatInput {...props} value={'🧠'.repeat(32001)} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Gửi tin nhắn' }).disabled).toBe(true);
    rerender(<ChatInput {...props} mode="summarize" value={'x'.repeat(500000)} />);
    expect(screen.getByRole('button', { name: 'Gửi tin nhắn' }).disabled).toBe(false);
    rerender(<ChatInput {...props} value={'\u200b\u200d'} />);
    expect(screen.getByRole('button', { name: 'Gửi tin nhắn' }).disabled).toBe(true);
  });
  it('formats primitives, null array entries and nested feedback without object coercion', () => {
    for (const value of ['**text**', 0, { feedback: 'Đúng', corrections: [{ reason: 'Sửa' }] }, { phases: [null, {}], sessions: [null, {}], topics: [null, { topic: 'A' }] }]) {
      expect(formatAIResult(value)).not.toMatch(/\[object Object\]|undefined/);
    }
    expect(formatAIResult({ summary: { content: '**đậm**' } })).toContain('đậm');
  });
  it('paginates long AI text and preserves bold/Unicode in native SVG exports', () => {
    const text = '**Đậm a\u0301 🧠** và `C:\\new`\n'.repeat(150) + 'KẾT THÚC';
    const pages = markdownPages(text, { width: 600, height: 700, fontSize: 16 });
    expect(pages.length).toBeGreaterThan(1);
    const rendered = pages.map(p => markdownRuns(p).map(run => run.text).join('')).join('\n');
    expect(rendered.replace(/\s/g, '')).toBe(markdownRuns(text).map(run => run.text).join('').replace(/\s/g, ''));
    for (const chunk of pages) expect(textContentHeight(chunk, { markdown: true, fontSize: 16 }, 600)).toBeLessThan(730);
    const svg = pageToSvg({ paper: {}, objects: [{ id: 'ai', type: 'text', width: 600, height: 700, data: { text: pages[0], fontSize: 16, markdown: true } }] });
    expect(svg).toContain('font-weight="bold"');
    expect(svg).toContain('xml:space="preserve"');
    expect(svg).toContain('🧠');
    expect(svg).not.toContain('<foreignObject');
  });
});

describe('summary job client', () => {
  it('polls to completion and exposes progress without returning the descriptor as text', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ config: {}, data: { success: true, data: { jobId: 'job', status: 'queued' } } });
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ config: {}, data: { success: true, data: { jobId: 'job', status: 'completed', result: { summary: '**Hoàn tất**' } } } });
    try {
      const progress = vi.fn(), result = await aiApi.summarize({ text: 'long source' }, { onProgress: progress });
      expect(result.data.data.summary).toBe('**Hoàn tất**');
      expect(progress).toHaveBeenCalled();
      expect(get).toHaveBeenCalledTimes(1);
    } finally { post.mockRestore(); get.mockRestore(); }
  });
  it('cancels a background job when the caller aborts', async () => {
    const controller = new AbortController();
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ config: {}, data: { data: { jobId: 'cancel', status: 'running' } } });
    const remove = vi.spyOn(apiClient, 'delete').mockResolvedValue({});
    try {
      const work = aiApi.summarize({ text: 'long source' }, { signal: controller.signal });
      const rejected = expect(work).rejects.toThrow(/dừng/);
      await waitFor(() => expect(post).toHaveBeenCalled());
      controller.abort();
      await rejected;
      expect(remove).toHaveBeenCalledWith('/ai/summary-jobs/cancel');
    } finally { post.mockRestore(); remove.mockRestore(); }
  });
});
