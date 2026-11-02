import { describe, expect, it } from 'vitest';
import { aiResultBlocks } from '../pages/Notebooks/editor/aiResultBlocks';

const allNodes = nodes => nodes.flatMap(node => [node, ...allNodes(node.content || [])]);
const plain = nodes => allNodes(nodes).filter(node => node.type === 'text').map(node => node.text).join('');
describe('AI result to structured notebook blocks', () => {
  it('converts headings and inline Markdown rather than inserting raw syntax', () => {
    const blocks = aiResultBlocks('## ERD\n\n**Entity** và *Attribute*, `id` là khóa.');
    expect(blocks[0]).toMatchObject({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'ERD' }] });
    expect(blocks[1].content.find(node => node.text === 'Entity').marks).toEqual([{ type: 'bold' }]);
    expect(blocks[1].content.find(node => node.text === 'Attribute').marks).toEqual([{ type: 'italic' }]);
    expect(blocks[1].content.find(node => node.text === 'id').marks).toEqual([{ type: 'code' }]);
    expect(aiResultBlocks('###### Small heading')[0].attrs.level).toBe(3);
  });
  it('converts nested lists, quotations, hard breaks, rules and code blocks', () => {
    const blocks = aiResultBlocks('3. One\n4. Two\n   - Nested\n\n> Quoted  \n> Next\n\n---\n\n```c++\nint main() {}\n```');
    expect(blocks[0]).toMatchObject({ type: 'orderedList', attrs: { start: 3 } });
    expect(allNodes(blocks[0].content).some(node => node.type === 'bulletList')).toBe(true);
    expect(blocks[1].type).toBe('blockquote');
    expect(allNodes(blocks).some(node => node.type === 'hardBreak')).toBe(true);
    expect(blocks[2].type).toBe('horizontalRule');
    expect(blocks[3]).toMatchObject({ type: 'codeBlock', attrs: { language: 'cpp' }, content: [{ type: 'text', text: 'int main() {}' }] });
  });
  it('retains safe web links and strips unsafe link marks', () => {
    const nodes = allNodes(aiResultBlocks('[Safe](https://example.org/docs) [Bad](javascript:alert%281%29) [Data](data:text/html,test) [Relative](/secret)'));
    expect(nodes.find(node => node.text === 'Safe').marks[0]).toMatchObject({ type: 'link', attrs: { href: 'https://example.org/docs' } });
    for (const name of ['Bad', 'Data', 'Relative']) expect(nodes.find(node => node.text === name).marks).toBeUndefined();
    expect(allNodes(aiResultBlocks('[Reference][id]\n\n[id]: https://example.org/course')).find(node => node.text === 'Reference').marks[0].attrs.href).toBe('https://example.org/course');
  });
  it('preserves raw HTML and Markdown images as inert literal text', () => {
    const source = '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n![Slide](https://example.org/slide.png)';
    const blocks = aiResultBlocks(source), nodes = allNodes(blocks);
    expect(plain(blocks)).toContain('<script>alert(1)</script>');
    expect(plain(blocks)).toContain('<img src=x onerror=alert(1)>');
    expect(plain(blocks)).toContain('![Slide](https://example.org/slide.png)');
    expect(nodes.some(node => ['image', 'html', 'script'].includes(node.type))).toBe(false);
  });
  it('unwraps a Markdown fence and preserves code content literally', () => {
    const blocks = aiResultBlocks('```markdown\n# Summary\n\n**Bold**\n```');
    expect(blocks[0].type).toBe('heading');
    const code = aiResultBlocks('```html\n<img src=x onerror=alert(1)>\n```')[0];
    expect(code.type).toBe('codeBlock');
    expect(code.content[0].text).toBe('<img src=x onerror=alert(1)>');
  });
  it('creates actual flashcards from raw and fenced JSON only for the flashcard action', () => {
    const json = JSON.stringify({ cards: [{ question: 'FK là gì?', answer: 'Khóa tham chiếu.' }, { question: 'PK?', answer: 'Khóa chính.' }] });
    const expected = [{ type: 'flashcard', attrs: { question: 'FK là gì?', answer: 'Khóa tham chiếu.' } }, { type: 'flashcard', attrs: { question: 'PK?', answer: 'Khóa chính.' } }];
    expect(aiResultBlocks(json, 'Tạo flashcard')).toEqual(expected);
    expect(aiResultBlocks('```json\n' + json + '\n```', 'Tạo flashcard')).toEqual(expected);
    expect(aiResultBlocks(json)[0].type).toBe('paragraph');
  });
  it('creates flashcard nodes from clear labelled question and answer pairs', () => {
    const blocks = aiResultBlocks('**Câu hỏi:** Foreign Key là gì?\n**Đáp án:** Khóa tham chiếu.\n\nCâu hỏi: Quan hệ N-N?\nĐáp án: Dùng bảng liên kết.\nCó hai khóa ngoại.', 'Tạo flashcard');
    expect(blocks).toEqual([{ type: 'flashcard', attrs: { question: 'Foreign Key là gì?', answer: 'Khóa tham chiếu.' } }, { type: 'flashcard', attrs: { question: 'Quan hệ N-N?', answer: 'Dùng bảng liên kết.\nCó hai khóa ngoại.' } }]);
  });
  it('falls back without dropping malformed flashcard answers', () => {
    const source = '## Cần bổ sung\n\nCâu hỏi: Chưa có đáp án';
    const blocks = aiResultBlocks(source, 'Tạo flashcard');
    expect(blocks[0].type).toBe('heading');
    expect(plain(blocks)).toContain('Câu hỏi: Chưa có đáp án');
    expect(aiResultBlocks('   ')).toEqual([]);
    expect(aiResultBlocks('>')).toEqual([{ type: 'blockquote', content: [{ type: 'paragraph' }] }]);
  });
});
