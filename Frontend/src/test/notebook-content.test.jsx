import React from 'react';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,within,waitFor} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {AppProvider} from '../components/common/ui';
import TextbookEditor from '../pages/Textbook/TextbookEditor';
import {createBook,createPage,saveBook,getBook,setTextbookOwner} from '../utils/textbookStore';

class Pointer extends MouseEvent{constructor(type,options={}){super(type,options);this.pointerId=options.pointerId||1;this.pointerType='mouse';this.pressure=.5;}}
beforeEach(()=>{localStorage.clear();setTextbookOwner('device');vi.stubGlobal('PointerEvent',Pointer);window.PointerEvent=Pointer;});
afterEach(()=>vi.unstubAllGlobals());
function mount(book){saveBook(book);render(<MemoryRouter initialEntries={['/textbook/'+book.id]}><AppProvider><Routes><Route path="/textbook/:id" element={<TextbookEditor/>}/></Routes></AppProvider></MemoryRouter>);const svg=screen.getByRole('img',{name:/Canvas/});svg.getBoundingClientRect=()=>({left:0,top:0,width:794,height:1123,right:794,bottom:1123});return svg;}
function persist(id){fireEvent.keyDown(window,{key:'s',ctrlKey:true});return getBook(id);}
function select(svg,id){fireEvent.keyDown(window,{key:'v'});const object=svg.querySelector(`[data-object-id="${id}"]`);fireEvent.pointerDown(object,{button:0,clientX:120,clientY:120});fireEvent.pointerUp(svg,{button:0,clientX:120,clientY:120});}
function insert(label){fireEvent.click(screen.getByRole('button',{name:'Chèn',exact:true}));fireEvent.click(screen.getByRole('menuitem',{name:label,exact:true}));}

describe('Notebook learning content integration',()=>{
  it('creates a template as editable objects without replacing the existing page',()=>{
    const book=createBook({title:'Mẫu ghi bài'});const svg=mount(book);
    fireEvent.click(screen.getByRole('button',{name:'Mẫu trang học tập',exact:true}));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:/Lecture note/}));
    let stored=persist(book.id);expect(stored.pages).toHaveLength(2);const page=stored.pages[1];
    expect(page.objects.some(o=>o.type==='text'&&o.data.text==='Ghi chép bài giảng')).toBe(true);
    const heading=page.objects.find(o=>o.data.text==='Ghi chép bài giảng');
    fireEvent.doubleClick(svg.querySelector(`[data-object-id="${heading.id}"]`));
    fireEvent.change(screen.getByLabelText('Nội dung văn bản'),{target:{value:'Bài giảng tiếng Việt đã chỉnh'}});
    fireEvent.keyDown(screen.getByLabelText('Nội dung văn bản'),{key:'Enter',ctrlKey:true});
    stored=persist(book.id);expect(stored.pages[1].objects.find(o=>o.id===heading.id).data.text).toBe('Bài giảng tiếng Việt đã chỉnh');
  });
  it('matches ASCII queries against Vietnamese titles and content and navigates to the result',()=>{
    const book=createBook({title:'Tìm kiếm'}),second=createPage(book.id,2);second.title='Định luật bảo toàn';second.objects=[{id:'text',type:'text',x:100,y:100,width:400,height:70,data:{text:'Động lượng của hệ kín',fontSize:22}}];book.pages.push(second);mount(book);
    fireEvent.change(screen.getByLabelText('Tìm trong vở'),{target:{value:'dong luong'}});
    const results=screen.getByLabelText('Kết quả tìm kiếm');fireEvent.click(within(results).getByRole('button',{name:/Định luật bảo toàn/}));
    expect(screen.getByRole('img',{name:/Canvas Định luật bảo toàn/})).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Tìm trong vở'),{target:{value:'dinh luat'}});
    expect(within(screen.getByLabelText('Kết quả tìm kiếm')).getByRole('button',{name:/Định luật bảo toàn/})).toBeTruthy();
  });
  it('crops, flips, resizes and deletes an image through real selection properties',()=>{
    const book=createBook({title:'Ảnh bài học'});book.pages[0].objects=[{id:'image',type:'image',x:100,y:100,width:200,height:120,rotation:0,data:{src:'data:image/png;base64,iVBORw0KGgo=',opacity:1}}];const svg=mount(book);select(svg,'image');
    const right=screen.getByRole('complementary',{name:/Thuộc tính và lớp/});
    fireEvent.change(within(right).getByLabelText('Trái'),{target:{value:'20'}});fireEvent.change(within(right).getAllByLabelText('Rộng')[0],{target:{value:'60'}});
    fireEvent.click(within(right).getByRole('button',{name:'Lật ngang'}));fireEvent.change(within(right).getAllByLabelText('Rộng')[1],{target:{value:'300'}});
    let image=persist(book.id).pages[0].objects[0];expect(image.data.crop).toEqual({x:20,y:0,width:60,height:100});expect(image.data.flipX).toBe(true);expect(image.width).toBeCloseTo(300);
    expect(svg.querySelector('[data-object-id="image"] svg').getAttribute('viewBox')).toBe('20 0 60 100');
    fireEvent.click(within(right).getByRole('button',{name:'Xóa đối tượng'}));expect(persist(book.id).pages[0].objects).toHaveLength(0);
    fireEvent.keyDown(window,{key:'z',ctrlKey:true});expect(persist(book.id).pages[0].objects[0].id).toBe('image');
  });
  it('previews and applies a real inline LaTeX formula as self-contained SVG',async()=>{
    const book=createBook({title:'Công thức'});const svg=mount(book);insert('Công thức LaTeX');
    const dialog=screen.getByRole('dialog');fireEvent.change(within(dialog).getByLabelText('Nhập công thức LaTeX'),{target:{value:String.raw`\frac{x^2+1}{y}`}});fireEvent.change(within(dialog).getByLabelText('Kiểu công thức'),{target:{value:'inline'}});
    expect(dialog.querySelector('.katex')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button',{name:'Áp dụng'}));
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull(),{timeout:10000});
    const formula=persist(book.id).pages[0].objects[0];expect(formula.type).toBe('formula');expect(formula.data.inline).toBe(true);expect(formula.data.latex).toBe(String.raw`\frac{x^2+1}{y}`);expect(decodeURIComponent(formula.data.svg)).toContain('<path');expect(svg.querySelector('[data-object-id] image')).toBeTruthy();
  });
  it('opens, downloads and deletes an attachment card',async()=>{
    const book=createBook({title:'Tệp bài học'}),src='data:text/plain;base64,SGVsbG8=';book.pages[0].objects=[{id:'file',type:'file',x:100,y:100,width:320,height:76,data:{name:'Ghi chú.txt',size:5,src}}];const svg=mount(book);select(svg,'file');
    const right=screen.getByRole('complementary',{name:/Thuộc tính và lớp/}),download=within(right).getByRole('link',{name:'Tải xuống'});expect(download.getAttribute('href')).toBe(src);expect(download.getAttribute('download')).toBe('Ghi chú.txt');
    const open=vi.spyOn(window,'open').mockImplementation(()=>null),fetchMock=vi.fn().mockResolvedValue({blob:async()=>new Blob(['Hello'])});vi.stubGlobal('fetch',fetchMock);const url=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:attachment-test');
    fireEvent.click(within(right).getByRole('button',{name:'Mở tệp đính kèm'}));await waitFor(()=>expect(open).toHaveBeenCalledWith('blob:attachment-test','_blank','noopener,noreferrer'));expect(fetchMock).toHaveBeenCalledWith(src);
    fireEvent.click(within(right).getByRole('button',{name:'Xóa đối tượng'}));expect(persist(book.id).pages[0].objects).toHaveLength(0);open.mockRestore();url.mockRestore();
  });
  it('exposes all export formats and selected-page scope',()=>{
    const book=createBook({title:'Xuất bài'});book.pages.push(createPage(book.id,2));mount(book);fireEvent.click(screen.getByRole('button',{name:'Xuất vở',exact:true}));const dialog=screen.getByRole('dialog'),format=within(dialog).getByLabelText('Định dạng');
    expect(Array.from(format.options).map(option=>option.value)).toEqual(['pdf','png','jpg','svg']);
    for(const value of ['png','jpg','svg','pdf']){fireEvent.change(format,{target:{value}});expect(format.value).toBe(value);}
    fireEvent.change(within(dialog).getByLabelText('Phạm vi'),{target:{value:'selected'}});expect(within(dialog).getAllByRole('checkbox')).toHaveLength(2);
    fireEvent.click(within(dialog).getAllByRole('checkbox')[1]);expect(within(dialog).getAllByRole('checkbox')[1].checked).toBe(true);
  });
});
