import { fromMarkdown } from 'mdast-util-from-markdown';

// Providers also emit LaTeX with \(...\) and \[...\]. Convert only matched
// delimiters outside code; never unescape code or literal transport sequences.
export function prepareAIMarkdown(source) {
  const fencedMarkdown = source.trim().match(/^(`{3,})[ \t]*(?:markdown|md)[ \t]*\n([\s\S]*?)\n\1[ \t]*$/i);
  if (fencedMarkdown) source = fencedMarkdown[2];
  if (!source.includes('\\(') && !source.includes('\\[')) return source;
  const excluded = [];
  function visit(node) {
    if (['code', 'inlineCode', 'html'].includes(node.type)) excluded.push([node.position.start.offset, node.position.end.offset]);
    else node.children?.forEach(visit);
  }
  try { visit(fromMarkdown(source)); } catch { return source; }
  const convert = part => part.replace(/(?<!\\)\\\(([\s\S]*?)(?<!\\)\\\)|(?<!\\)\\\[([\s\S]*?)(?<!\\)\\\]/g,
    (whole, inline, block) => inline !== undefined ? '$' + inline + '$' : '\n\n$$\n' + block + '\n$$\n\n');
  let position = 0, result = '';
  for (const [start, end] of excluded.sort((a, b) => a[0] - b[0])) {
    result += convert(source.slice(position, start)) + source.slice(start, end);
    position = end;
  }
  return result + convert(source.slice(position));
}
