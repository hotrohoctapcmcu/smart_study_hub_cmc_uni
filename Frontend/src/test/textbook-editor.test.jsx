import React from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AppProvider } from '../components/common/ui';
import TextbookEditor from '../pages/Textbook/TextbookEditor';
import { createBook, getBook, saveBook, createPage, textbookStorageKey, setTextbookOwner } from '../utils/textbookStore';
import { objectBounds, selectionBounds, scaleObject, smoothPath, pageToSvg, formulaToImage, mergeTableCells, splitTableCells, tableCellSpans } from '../utils/textbookCanvas';

class TestPointerEvent extends MouseEvent {
  constructor(type, options={}) { super(type, options); this.pointerId=options.pointerId||1; this.pressure=options.pressure??.5; this.pointerType=options.pointerType||'pen'; }
}
beforeEach(()=>{localStorage.clear();setTextbookOwner('device');vi.useFakeTimers();vi.stubGlobal('PointerEvent',TestPointerEvent);window.PointerEvent=TestPointerEvent;});
afterEach(()=>{vi.useRealTimers();});
function mount(book,query=''){
  render(<MemoryRouter initialEntries={[`/textbook/${book.id}${query}`]}><AppProvider><Routes><Route path="/textbook/:id" element={<TextbookEditor/>}/></Routes></AppProvider></MemoryRouter>);
  const svg=screen.queryByRole('img',{name:/Canvas/});
  if(svg)svg.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:794,bottom:1123,width:794,height:1123});
  return svg;
}
function stroke(svg,start=[100,100],end=[160,140]){fireEvent.pointerDown(svg,{clientX:start[0],clientY:start[1],button:0,pressure:.4});fireEvent.pointerMove(svg,{clientX:(start[0]+end[0])/2,clientY:(start[1]+end[1])/2,pressure:.8});fireEvent.pointerMove(svg,{clientX:end[0],clientY:end[1],pressure:.7});fireEvent.pointerUp(svg,{clientX:end[0],clientY:end[1],button:0});}

describe('Textbook canvas editing',()=>{
  it('writes pointer strokes, debounces autosave, and restores through undo and redo',()=>{
    const book=createBook({title:'Vở viết tay'}),svg=mount(book),writes=vi.spyOn(Storage.prototype,'setItem');
    stroke(svg);
    expect(svg.querySelectorAll('[data-object-id]')).toHaveLength(1);
    expect(writes).not.toHaveBeenCalled();
    act(()=>vi.advanceTimersByTime(810));
    const stored=getBook(book.id).pages[0].objects[0];
    expect(stored.type).toBe('drawing');
    expect(stored.data.points).toHaveLength(3);
    expect(stored.data.points[1].pressure).toBe(.8);
    expect(stored.data.points.at(-1)).toMatchObject({x:60,y:40});
    fireEvent.keyDown(window,{key:'z',ctrlKey:true});
    expect(svg.querySelectorAll('[data-object-id]')).toHaveLength(0);
    fireEvent.keyDown(window,{key:'z',ctrlKey:true,shiftKey:true});
    expect(svg.querySelectorAll('[data-object-id]')).toHaveLength(1);
    act(()=>vi.advanceTimersByTime(810));
    expect(getBook(book.id).pages[0].objects).toHaveLength(1);
  });
  it('adds text as a canvas object and erases a stroke without deleting text',()=>{
    const book=createBook({title:'Bút và chữ'}),svg=mount(book);
    stroke(svg);
    fireEvent.click(screen.getByRole('button',{name:'Văn bản · T'}));
    fireEvent.pointerDown(svg,{clientX:300,clientY:400,button:0});
    const input=screen.getByLabelText('Nội dung văn bản');fireEvent.change(input,{target:{value:'Kiến thức đã hiểu'}});fireEvent.blur(input);
    expect(svg.textContent).toContain('Kiến thức đã hiểu');
    fireEvent.click(screen.getByRole('button',{name:'Tẩy · E'}));
    fireEvent.pointerDown(svg,{clientX:130,clientY:120,button:0});fireEvent.pointerUp(svg,{clientX:130,clientY:120,button:0});
    act(()=>vi.advanceTimersByTime(810));
    const objects=getBook(book.id).pages[0].objects;expect(objects).toHaveLength(1);expect(objects[0].type).toBe('text');
  });
  it('opens a recent-page deep link and manages independent pages',()=>{
    const book=createBook({title:'Nhiều trang'}),second=createPage(book.id,2);second.title='Trang cần ôn';book.pages.push(second);saveBook(book);
    mount(book,'?page='+second.id);
    expect(screen.getByRole('img',{name:/Canvas Trang cần ôn/})).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Trang mới'}));
    expect(screen.getByRole('img',{name:/Canvas Trang 3/})).toBeTruthy();
    act(()=>vi.advanceTimersByTime(810));
    expect(getBook(book.id).pages).toHaveLength(3);
    expect(new Set(getBook(book.id).pages.map(p=>p.id)).size).toBe(3);
  });
  it('keeps current editing content visible and exposes recovery when storage fails',()=>{
    const book=createBook({title:'Giữ nội dung'}),svg=mount(book);
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('full','QuotaExceededError');});
    stroke(svg);act(()=>vi.advanceTimersByTime(810));
    expect(screen.getByRole('alert').textContent).toContain('chưa lưu được');
    expect(screen.getByRole('button',{name:'Tải bản sao'})).toBeTruthy();
    expect(svg.querySelectorAll('[data-object-id]')).toHaveLength(1);
    expect(getBook(book.id).pages[0].objects).toHaveLength(0);
  });
  it('blocks SPA navigation when a storage failure would discard the active draft',async()=>{
    const book=createBook({title:'Bảo vệ bản nháp'}),router=createMemoryRouter([{path:'/textbook/:id',element:<AppProvider><TextbookEditor/></AppProvider>},{path:'/textbook',element:<h1>Thư viện đã mở</h1>}],{initialEntries:[`/textbook/${book.id}`]});
    render(<RouterProvider router={router}/>);
    const svg=screen.getByRole('img',{name:/Canvas/});svg.getBoundingClientRect=()=>({left:0,top:0,width:794,height:1123});
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('full','QuotaExceededError');});
    stroke(svg);act(()=>vi.advanceTimersByTime(810));
    fireEvent.click(screen.getByRole('link',{name:'Về thư viện vở ghi'}));
    const guard=screen.getByRole('dialog');expect(guard.textContent).toContain('Nội dung chưa được lưu');
    expect(router.state.location.pathname).toBe(`/textbook/${book.id}`);
    fireEvent.click(within(guard).getByRole('button',{name:'Ở lại'}));
    expect(svg.querySelectorAll('[data-object-id]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('link',{name:'Về thư viện vở ghi'}));
    await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Rời đi và bỏ thay đổi chưa lưu'})));
    expect(router.state.location.pathname).toBe('/textbook');
    expect(screen.getByText('Thư viện đã mở')).toBeTruthy();
  });
  it('reports corrupted storage without overwriting the original data',()=>{
    const book=createBook({title:'Có lỗi'});localStorage.setItem(textbookStorageKey(),'{broken');mount(book);
    expect(screen.getByRole('alert').textContent).toContain('không đọc được');
    expect(screen.queryByText('Không tìm thấy vở ghi')).toBeNull();
    expect(localStorage.getItem(textbookStorageKey())).toBe('{broken');
  });
});

describe('Canvas geometry and export content',()=>{
  it('merges arbitrary rectangular table cells, exports the span and recovers all cell values on split',()=>{
    const data={rows:3,cols:3,cells:[['A','B','C'],['D','E','F'],['G','H','I']],align:'center',fill:'#f0eaff',color:'#8877aa',thickness:2};
    const merged=mergeTableCells(data,{row1:1,col1:1,row2:2,col2:2});
    expect(tableCellSpans(merged,1,1)).toEqual({rowSpan:2,colSpan:2});expect(tableCellSpans(merged,2,2)).toBeNull();
    const book=createBook({title:'Bảng'});book.pages[0].objects=[{id:'table',type:'table',x:0,y:0,width:300,height:150,data:merged}];
    const svg=pageToSvg(book.pages[0]);expect(svg).toContain('width="200" height="100"');expect(svg).toContain('text-anchor="middle"');
    const split=splitTableCells(merged,{row1:2,col1:2,row2:2,col2:2});expect(split.merges).toEqual([]);expect(split.cells).toEqual(data.cells);
    const resized={...merged,rows:2,cols:2};expect(tableCellSpans(resized,1,1)).toEqual({rowSpan:1,colSpan:1});
  });
  it('renders real LaTeX as self-contained SVG paths suitable for raster/PDF export',async()=>{
    const formula=await formulaToImage('\\frac{a}{b} + \\sqrt{x^2+y^2}');
    const markup=decodeURIComponent(formula.src.split(',').slice(1).join(','));
    expect(markup).toContain('<svg');expect(markup).toContain('<path');expect(markup).not.toContain('foreignObject');expect(markup).not.toContain('currentColor');expect(formula.width).toBeGreaterThan(100);
  });
  it('preserves negative-direction handwriting bounds and rescales actual points',()=>{
    const drawing={id:'stroke',type:'drawing',x:100,y:100,width:80,height:60,data:{points:[{x:0,y:0},{x:-80,y:60}]}};
    const box=objectBounds(drawing);expect(box).toEqual({x:20,y:100,width:80,height:60});
    const resized=scaleObject(drawing,box,2,2);expect(objectBounds(resized)).toEqual({x:20,y:100,width:160,height:120});
    expect(selectionBounds([drawing,{type:'shape',x:200,y:20,width:50,height:50}])).toEqual({x:20,y:20,width:230,height:140});
    expect(smoothPath([{x:0,y:0},{x:10,y:20},{x:30,y:40}])).toContain('Q10 20 20 30');
  });
  it('exports user text, paper and shapes as self-contained SVG without UI controls',()=>{
    const book=createBook({title:'Xuất'});book.pages[0].objects=[{id:'t',type:'text',x:30,y:20,width:300,height:40,data:{text:'Định lý Pythagoras',fontSize:20}},{id:'s',type:'shape',x:100,y:200,width:100,height:60,data:{shape:'triangle',color:'#8060c9'}}];
    const svg=pageToSvg(book.pages[0]);expect(svg).toContain('Định lý Pythagoras');expect(svg).toContain('<polygon');expect(svg).toContain('width="794"');expect(svg).not.toContain('<button');
  });
});
