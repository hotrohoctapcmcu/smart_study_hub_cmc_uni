import { fromMarkdown } from 'mdast-util-from-markdown';
const segmenter = new Intl.Segmenter('vi', { granularity: 'grapheme' });
export const graphemes = text => [...segmenter.segment(text)].map(part => part.segment);

// Native SVG tspans keep bold/italic/code editable and exportable without
// embedding HTML. Complex notation is retained as text in the notebook canvas.
export function markdownRuns(text) {
  const runs = [];
  function visit(node, style = {}) {
    const type = node.type;
    if (type === 'text' || type === 'inlineCode' || type === 'code' || type === 'html') {
      runs.push({ text: node.value || '', ...style, ...(type.includes('Code') || type === 'code' ? { code: true } : {}) });
    } else if (type === 'image') runs.push({ text: node.alt || '[Ảnh]', ...style });
    else if (type === 'break') runs.push({ text: '\n', ...style });
    else if (type === 'thematicBreak') runs.push({ text: '────────', ...style });
    else {
      const next = { ...style, ...(type === 'strong' || type === 'heading' ? { bold: true } : {}), ...(type === 'emphasis' ? { italic: true } : {}), ...(type === 'link' ? { underline: true } : {}) };
      (node.children || []).forEach((child, index) => {
        if (type === 'list') runs.push({ text: node.ordered ? `${(node.start || 1) + index}. ` : '• ', ...style });
        visit(child, next);
        if (['root', 'list', 'blockquote', 'listItem'].includes(type) && index < node.children.length - 1) runs.push({ text: '\n', ...style });
      });
    }
  }
  try { visit(fromMarkdown(String(text))); } catch { return [{ text: String(text) }]; }
  return runs;
}
export function markdownTextLines(text, data, width) {
  const size = data.fontSize || 22, limit = Math.max(1, width - (data.indent || 0));
  const output = [], runs = markdownRuns(text);
  let line = [], used = 0;
  const flush = paragraphEnd => { output.push({ text: line.map(run => run.text).join('') || ' ', runs: line, paragraphEnd }); line = []; used = 0; };
  for (const run of runs) for (const char of graphemes(run.text)) {
    if (char === '\n') { flush(true); continue; }
    const w = (/[ilI.,! :;]/.test(char) ? .3 : /[MW@]/.test(char) ? .9 : .57) * size + (data.letterSpacing || 0);
    if (data.wrap !== false && used && used + w > limit) flush(false);
    const last = line.at(-1);
    if (last && last.bold === run.bold && last.italic === run.italic && last.code === run.code && last.underline === run.underline) last.text += char;
    else line.push({ ...run, text: char });
    used += w;
  }
  flush(true);
  return output;
}
export function markdownPages(text, { width, height, fontSize = 16 }) {
  const lines = markdownTextLines(text, { fontSize }, width);
  const perPage = Math.max(1, Math.floor((height - fontSize * .4) / (fontSize * 1.4)));
  const encode = run => {
    const match = run.text.match(/^(\s*)([\s\S]*?)(\s*)$/), [, before, core, after] = match;
    if (!core) return run.text;
    let value = core.replace(/([\\`*_{}\[\]()#+.!>|~-])/g, '\\$1');
    if (run.code) { const fence = '`'.repeat(Math.max(0, ...[...core.matchAll(/`+/g)].map(m => m[0].length)) + 1); value = fence + ' ' + core + ' ' + fence; }
    if (run.italic) value = '*' + value + '*';
    if (run.bold) value = '**' + value + '**';
    return before + value + after;
  };
  const pages = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage).map(line => line.runs.map(encode).join('')).join('\n'));
  return pages;
}
