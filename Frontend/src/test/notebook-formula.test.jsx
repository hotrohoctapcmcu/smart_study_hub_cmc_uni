import {describe,it,expect} from 'vitest';
import {formulaToImage} from '../utils/textbookCanvas';

describe('Notebook inline and block formula rendering',()=>{
  it('uses text style for inline fractions and exports self-contained SVG glyphs',async()=>{
    const source=String.raw`\frac{x^2+1}{y}`,inline=await formulaToImage(source,'#8060c9',{inline:true}),block=await formulaToImage(source,'#8060c9');
    expect(inline.height).toBeLessThan(block.height);expect(inline.width).toBeLessThan(block.width);
    const svg=decodeURIComponent(inline.src.split(',').slice(1).join(','));
    expect(svg).toContain('<path');expect(svg).toContain('#8060c9');expect(svg).not.toContain('foreignObject');expect(svg).not.toContain('currentColor');
  });
  it('honors the supplied font size and validates inline LaTeX',async()=>{
    const small=await formulaToImage('x+y','#343047',{inline:true,fontSize:14}),large=await formulaToImage('x+y','#343047',{inline:true,fontSize:28});
    expect(large.width).toBeGreaterThan(small.width);expect(large.height).toBeGreaterThan(small.height);
    await expect(formulaToImage(String.raw`\frac{`, '#343047',{inline:true})).rejects.toThrow();
  });
});
