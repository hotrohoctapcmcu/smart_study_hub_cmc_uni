import { fromMarkdown } from 'mdast-util-from-markdown';
import { prepareAIMarkdown } from '../../../utils/aiMarkdown';
import { aiText } from '../../../utils/aiText';

const textNode = (text, marks = []) => text ? { type: 'text', text, ...(marks.length ? { marks } : {}) } : null;
const paragraph = content => ({ type: 'paragraph', ...(content.length ? { content } : {}) });
const withMark = (marks, mark) => [...marks.filter(item => item.type !== mark.type), mark];
function safeLink(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
function flashcardsFromJSON(source) {
  const candidates = [source.trim(), ...[...source.matchAll(/(`{3,})[ \t]*(?:json)?[ \t]*\n([\s\S]*?)\n\1/g)].map(match => match[2].trim())];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate), cards = parsed?.cards;
      if (Array.isArray(cards) && cards.length && cards.every(card => typeof card?.question === 'string' && card.question.trim() && typeof card.answer === 'string' && card.answer.trim())) {
        return cards.map(card => ({ type: 'flashcard', attrs: { question: card.question.trim(), answer: card.answer.trim() } }));
      }
    } catch { /* A non-JSON answer can still contain clear labelled cards. */ }
  }
  return null;
}
function flashcardsFromPairs(source) {
  const cards = [];
  let card = null, field = null;
  for (const line of source.split('\n')) {
    const match = line.match(/^\s*(?:[-*]\s+|\d+[.)]\s+)?(?:\*\*|__)?(Câu hỏi|Đáp án)(?:\*\*|__)?\s*:(?:\*\*|__)?\s*(.*)$/iu);
    if (match) {
      if (match[1].toLocaleLowerCase('vi') === 'câu hỏi') {
        if (card) {
          if (!card.question.trim() || !card.answer.trim()) return null;
          cards.push(card);
        }
        card = { question: match[2], answer: '' }; field = 'question';
      } else {
        if (!card || field === 'answer') return null;
        card.answer = match[2]; field = 'answer';
      }
    } else if (card && field) card[field] += `\n${line}`;
  }
  if (card) {
    if (!card.question.trim() || !card.answer.trim()) return null;
    cards.push(card);
  }
  return cards.length ? cards.map(item => ({ type: 'flashcard', attrs: { question: item.question.trim(), answer: item.answer.trim() } })) : null;
}

// Only schema nodes and plain text enter the editor. Raw HTML is preserved as
// literal text, images never trigger remote loads, and link protocols are checked.
export function aiResultBlocks(text, action = '') {
  const source = prepareAIMarkdown(aiText(text));
  if (!source.trim()) return [];
  if (String(action).normalize('NFC').trim().toLocaleLowerCase('vi') === 'tạo flashcard') {
    const cards = flashcardsFromJSON(source) || flashcardsFromPairs(source);
    if (cards) return cards;
  }
  try {
    const tree = fromMarkdown(source), definitions = new Map();
    const collect = node => { if (node.type === 'definition') definitions.set(node.identifier.toLowerCase(), node); node.children?.forEach(collect); };
    collect(tree);
    const literal = node => source.slice(node.position?.start.offset ?? 0, node.position?.end.offset ?? 0);
    function inline(node, marks = []) {
      if (node.type === 'text' || node.type === 'html') return [textNode(node.value || '', marks)].filter(Boolean);
      if (node.type === 'inlineCode') return [textNode(node.value || '', [{ type: 'code' }])].filter(Boolean);
      if (node.type === 'break') return [{ type: 'hardBreak' }];
      if (node.type === 'image' || node.type === 'imageReference') return [textNode(literal(node) || `[Ảnh: ${node.alt || ''}]`, marks)].filter(Boolean);
      if (node.type === 'strong' || node.type === 'emphasis') {
        const next = withMark(marks, { type: node.type === 'strong' ? 'bold' : 'italic' });
        return (node.children || []).flatMap(child => inline(child, next));
      }
      if (node.type === 'link' || node.type === 'linkReference') {
        const href = safeLink(node.url || definitions.get(node.identifier?.toLowerCase())?.url || '');
        const next = href ? withMark(marks, { type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer' } }) : marks;
        return (node.children || []).flatMap(child => inline(child, next));
      }
      return node.children ? node.children.flatMap(child => inline(child, marks)) : [textNode(node.value || literal(node), marks)].filter(Boolean);
    }
    function block(node) {
      if (node.type === 'root') return (node.children || []).flatMap(block);
      if (node.type === 'definition') return [];
      if (node.type === 'paragraph') return [paragraph((node.children || []).flatMap(child => inline(child)))];
      if (node.type === 'heading') return [{ type: 'heading', attrs: { level: Math.min(3, Math.max(1, node.depth || 1)) }, content: (node.children || []).flatMap(child => inline(child)) }];
      if (node.type === 'thematicBreak') return [{ type: 'horizontalRule' }];
      if (node.type === 'code') {
        const aliases = { js: 'javascript', py: 'python', 'c++': 'cpp', 'c#': 'csharp' };
        const language = aliases[node.lang?.toLowerCase()] || node.lang || 'plaintext';
        return [{ type: 'codeBlock', attrs: { language }, ...(node.value ? { content: [textNode(node.value)] } : {}) }];
      }
      if (node.type === 'blockquote') {
        const content = (node.children || []).flatMap(block);
        return [{ type: 'blockquote', content: content.length ? content : [paragraph([])] }];
      }
      if (node.type === 'list') return [{ type: node.ordered ? 'orderedList' : 'bulletList', ...(node.ordered ? { attrs: { start: node.start || 1 } } : {}), content: (node.children || []).map(item => {
        const children = (item.children || []).flatMap(block);
        if (children[0]?.type !== 'paragraph') children.unshift(paragraph([]));
        return { type: 'listItem', content: children };
      }) }];
      if (node.type === 'html') return [paragraph([textNode(node.value || '')].filter(Boolean))];
      return node.children ? node.children.flatMap(block) : [paragraph([textNode(node.value || literal(node))].filter(Boolean))];
    }
    return block(tree);
  } catch {
    return [paragraph([textNode(source)])];
  }
}

export default aiResultBlocks;
