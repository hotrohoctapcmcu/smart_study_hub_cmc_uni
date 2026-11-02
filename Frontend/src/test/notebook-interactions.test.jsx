import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from '../components/common/ui';
import TextbookEditor from '../pages/Textbook/TextbookEditor';
import { createBook, createPage, getBook, saveBook, setTextbookOwner } from '../utils/textbookStore';
import { localToWorld, worldToLocal } from '../utils/notebookGeometry';

class NotebookPointerEvent extends MouseEvent {
  constructor(type,options={}){super(type,options);this.pointerId=options.pointerId||1;this.pointerType=options.pointerType||'pen';this.pressure=options.pressure??.5;}
}
const initialClipboard=Object.getOwnPropertyDescriptor(navigator,'clipboard');
beforeEach(()=>{localStorage.clear();setTextbookOwner('device');vi.useFakeTimers();vi.stubGlobal('PointerEvent',NotebookPointerEvent);window.PointerEvent=NotebookPointerEvent;});
afterEach(()=>{vi.useRealTimers();if(initialClipboard)Object.defineProperty(navigator,'clipboard',initialClipboard);else delete navigator.clipboard;});
function open(objects=[]){
  const book=createBook({title:'Kiểm tra tương tác'});book.pages[0].objects=objects;saveBook(book);
  return mount(book);
}
function mount(book){
  render(<MemoryRouter initialEntries={['/textbook/'+book.id]}><AppProvider><Routes><Route path="/textbook/:id" element={<TextbookEditor/>}/></Routes></AppProvider></MemoryRouter>);
  const svg=screen.getByRole('img',{name:/Canvas/});svg.getBoundingClientRect=()=>({left:0,top:0,x:0,y:0,width:794,height:1123,right:794,bottom:1123});
  return {book,svg};
}
function key(key,options={}){fireEvent.keyDown(window,{key,...options});if(key==='v'&&options.ctrlKey)fireEvent.paste(window,{clipboardData:{items:[],getData:()=>''}});}
function pointer(svg,type,point,options={}){fireEvent[type](svg,{clientX:point.x,clientY:point.y,button:0,...options});}
function drag(svg,points){pointer(svg,'pointerDown',points[0]);for(const point of points.slice(1))pointer(svg,'pointerMove',point);pointer(svg,'pointerUp',points.at(-1));}
function saved(book){act(()=>vi.advanceTimersByTime(810));return getBook(book.id).pages[0].objects;}
function text(id,x=100,y=100,locked=false){return {id,type:'text',x,y,width:180,height:60,rotation:0,locked,data:{text:'Kiến thức tiếng Việt',font:'Arial',fontSize:20,color:'#343047'}};}
function stroke(id,x=100,y=100){return {id,type:'drawing',x,y,width:100,height:1,rotation:0,data:{points:[{x:0,y:0,pressure:.5},{x:50,y:0,pressure:.7},{x:100,y:0,pressure:.5}],thickness:3,color:'#8060c9',tool:'pen'}};}

describe('Notebook interactions',()=>{
  it.each([0,43,90])('draws a straight stroke on the actual ruler edge at %s degrees',rotation=>{
    const ruler={id:'ruler-a',type:'ruler',x:230,y:270,width:350,height:60,rotation,data:{color:'#8060c9'}};
    const {book,svg}=open([ruler]);key('p');
    drag(svg,[{x:40,y:8},{x:130,y:-7},{x:240,y:6}].map(point=>localToWorld(point,ruler)));
    const result=saved(book).find(object=>object.type==='drawing');expect(result).toBeTruthy();
    expect(result.data.points).toHaveLength(3);
    for(const point of result.data.points){const local=worldToLocal({...point,x:point.x+result.x,y:point.y+result.y},ruler);expect(local.y).toBeCloseTo(0,6);}
  });
  it('deletes the selected ruler and restores it through undo, then redoes deletion',()=>{
    const ruler={id:'ruler-a',type:'ruler',x:100,y:100,width:350,height:60,rotation:0,data:{}};
    const {book,svg}=open([ruler]);key('v');pointer(svg,'pointerDown',{x:240,y:130});pointer(svg,'pointerUp',{x:240,y:130});key('Delete');
    expect(saved(book)).toHaveLength(0);key('z',{ctrlKey:true});expect(saved(book).map(o=>o.id)).toEqual(['ruler-a']);key('y',{ctrlKey:true});expect(saved(book)).toHaveLength(0);
  });
  it('copies and repeatedly pastes independent objects at increasing offsets',()=>{
    const {book,svg}=open([text('note')]);key('v');pointer(svg,'pointerDown',{x:150,y:120});pointer(svg,'pointerUp',{x:150,y:120});key('c',{ctrlKey:true});key('v',{ctrlKey:true});key('v',{ctrlKey:true});
    const result=saved(book);expect(result).toHaveLength(3);expect(new Set(result.map(o=>o.id)).size).toBe(3);expect(result.map(o=>o.x)).toEqual([100,124,148]);expect(result.map(o=>o.data.text)).toEqual(Array(3).fill('Kiến thức tiếng Việt'));
  });
  it('protects a locked object from Delete and the object eraser',()=>{
    const {book,svg}=open([text('locked',100,100,true)]);key('v');pointer(svg,'pointerDown',{x:150,y:120});pointer(svg,'pointerUp',{x:150,y:120});key('Delete');expect(saved(book)).toHaveLength(1);
    key('e');fireEvent.change(screen.getByLabelText('Chế độ tẩy'),{target:{value:'object'}});expect(screen.getByLabelText('Chế độ tẩy').value).toBe('object');drag(svg,[{x:150,y:120},{x:170,y:130}]);expect(saved(book)).toHaveLength(1);expect(saved(book)[0].locked).toBe(true);
  });
  it('edits Vietnamese text inline, changes its font, and retains content after save',()=>{
    const {book,svg}=open();key('t');pointer(svg,'pointerDown',{x:180,y:220});
    const input=screen.getByLabelText('Nội dung văn bản');fireEvent.change(input,{target:{value:'Định lý đường tròn — Nguyễn Ánh'}});fireEvent.blur(input);
    const fonts=screen.getAllByLabelText('Phông chữ');fireEvent.change(fonts[0],{target:{value:'Be Vietnam Pro'}});
    const result=saved(book);expect(result).toHaveLength(1);expect(result[0].data.text).toBe('Định lý đường tròn — Nguyễn Ánh');expect(result[0].data.font).toBe('Be Vietnam Pro');
    key('Delete');expect(saved(book)).toHaveLength(0);key('z',{ctrlKey:true});expect(saved(book)[0].data.text).toBe('Định lý đường tròn — Nguyễn Ánh');
  });
  it('lassos multiple strokes, moves them together, then deletes the selection',()=>{
    const {book,svg}=open([stroke('one',100,100),stroke('two',100,150),text('outside',450,450)]);key('L',{shiftKey:true});
    drag(svg,[{x:70,y:70},{x:240,y:70},{x:240,y:190},{x:70,y:190},{x:70,y:70}]);
    drag(svg,[{x:140,y:100},{x:170,y:130}]);const moved=saved(book);expect(moved.find(o=>o.id==='one')).toMatchObject({x:130,y:130});expect(moved.find(o=>o.id==='two')).toMatchObject({x:130,y:180});expect(moved.find(o=>o.id==='outside')).toMatchObject({x:450,y:450});
    key('Delete');expect(saved(book).map(o=>o.id)).toEqual(['outside']);key('z',{ctrlKey:true});expect(saved(book)).toHaveLength(3);
  });
  it('distinguishes stroke erasing from object erasing and undoes both',()=>{
    const {book,svg}=open([stroke('ink',100,100),text('note',100,200)]);key('e');drag(svg,[{x:150,y:100}]);expect(saved(book).map(o=>o.id)).toEqual(['note']);key('z',{ctrlKey:true});
    drag(svg,[{x:150,y:220}]);expect(saved(book)).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Chế độ tẩy'),{target:{value:'object'}});drag(svg,[{x:150,y:220}]);expect(saved(book).map(o=>o.id)).toEqual(['ink']);key('z',{ctrlKey:true});expect(saved(book)).toHaveLength(2);
  });
  it('partially erases a sparse stroke without losing the remaining segments',()=>{
    const {book,svg}=open([stroke('ink',100,100)]);key('e');fireEvent.change(screen.getByLabelText('Chế độ tẩy'),{target:{value:'pixel'}});drag(svg,[{x:150,y:100}]);
    const remaining=saved(book);expect(remaining).toHaveLength(2);expect(remaining.every(object=>object.type==='drawing')).toBe(true);expect(remaining[0].data.points.at(-1).x).toBeLessThan(50);expect(remaining[1].data.points[0].x).toBeGreaterThan(50);
    key('z',{ctrlKey:true});expect(saved(book).map(o=>o.id)).toEqual(['ink']);
  });
  it('reopens the autosaved notebook with object coordinates and content intact',()=>{
    const {book,svg}=open([text('note')]);key('v');drag(svg,[{x:150,y:120},{x:180,y:150}]);const before=saved(book);cleanup();
    mount(getBook(book.id));const artwork=screen.getByRole('img',{name:/Canvas/});expect(artwork.textContent).toContain('Kiến thức tiếng');expect(artwork.textContent).toContain('Việt');expect(getBook(book.id).pages[0].objects).toEqual(before);expect(before[0]).toMatchObject({x:130,y:130});expect(before[0].data.text).toBe('Kiến thức tiếng Việt');
  });
  it('autosaves Vietnamese input while the inline editor remains open',()=>{
    const {book,svg}=open();key('t');pointer(svg,'pointerDown',{x:180,y:220});
    const input=screen.getByLabelText('Nội dung văn bản');fireEvent.change(input,{target:{value:'Bài học chưa rời ô nhập'}});
    expect(saved(book)[0].data.text).toBe('Bài học chưa rời ô nhập');expect(screen.getByLabelText('Nội dung văn bản')).toBe(input);
    fireEvent.change(input,{target:{value:'Tiếp tục ghi chép tiếng Việt'}});expect(saved(book)[0].data.text).toBe('Tiếp tục ghi chép tiếng Việt');
    fireEvent.blur(input);expect(saved(book)).toHaveLength(1);key('z',{ctrlKey:true});expect(saved(book)).toHaveLength(0);
  });
  it('flushes the live inline draft when the document becomes hidden before debounce',()=>{
    const {book,svg}=open();key('t');pointer(svg,'pointerDown',{x:180,y:220});
    fireEvent.change(screen.getByLabelText('Nội dung văn bản'),{target:{value:'Nội dung phải còn khi đổi tab'}});
    vi.spyOn(document,'hidden','get').mockReturnValue(true);fireEvent(document,new Event('visibilitychange'));
    expect(getBook(book.id).pages[0].objects[0].data.text).toBe('Nội dung phải còn khi đổi tab');
  });
  it('edits table cells directly and pastes a rectangular TSV range',()=>{
    const table={id:'table',type:'table',x:100,y:100,width:300,height:120,rotation:0,data:{rows:2,cols:2,cells:[['A','B'],['C','D']],color:'#8060c9'}};
    const {book,svg}=open([table]);key('v');fireEvent.doubleClick(svg.querySelector('[data-object-id="table"]'));
    const cell=screen.getByLabelText('Ô hàng 1 cột 1');fireEvent.change(cell,{target:{value:'Nội dung'}});
    fireEvent.paste(cell,{clipboardData:{getData:()=> 'Môn học\tTín chỉ\nToán\t3'}});
    expect(screen.getByLabelText('Ô hàng 2 cột 2').value).toBe('3');fireEvent.keyDown(cell,{key:'Enter',ctrlKey:true});
    expect(saved(book)[0].data.cells).toEqual([['Môn học','Tín chỉ'],['Toán','3']]);key('z',{ctrlKey:true});expect(saved(book)[0].data.cells).toEqual(table.data.cells);
  });
  it('uses the SVG coordinate system after zooming instead of shifting objects',()=>{
    const {book,svg}=open([text('note')]);fireEvent.change(screen.getByLabelText('Mức thu phóng'),{target:{value:'150'}});
    svg.getBoundingClientRect=()=>({left:20,top:30,x:20,y:30,width:1191,height:1684.5,right:1211,bottom:1714.5});key('v');
    drag(svg,[{x:245,y:210},{x:290,y:255}]);expect(saved(book)[0]).toMatchObject({x:130,y:130});
  });
  it('resizes and rotates through canvas handles with separate undo steps',()=>{
    const shape={id:'shape',type:'shape',x:100,y:100,width:120,height:80,rotation:0,data:{shape:'rectangle',color:'#8060c9'}};
    const {book,svg}=open([shape]);key('v');pointer(svg,'pointerDown',{x:130,y:120});pointer(svg,'pointerUp',{x:130,y:120});
    pointer(svg.querySelector('[data-handle="resize"]'),'pointerDown',{x:220,y:180});pointer(svg,'pointerMove',{x:340,y:260});pointer(svg,'pointerUp',{x:340,y:260});expect(saved(book)[0]).toMatchObject({x:100,y:100,width:240,height:160});
    pointer(svg.querySelector('[data-handle="rotate"]'),'pointerDown',{x:220,y:60});pointer(svg,'pointerMove',{x:340,y:180});pointer(svg,'pointerUp',{x:340,y:180});expect(saved(book)[0].rotation).toBe(90);
    key('z',{ctrlKey:true});expect(saved(book)[0]).toMatchObject({width:240,height:160,rotation:0});key('z',{ctrlKey:true});expect(saved(book)[0]).toMatchObject({width:120,height:80,rotation:0});
  });
  it('groups a multi-selection so selecting and moving one member moves the group',()=>{
    const {book,svg}=open([text('first',100,100),text('second',350,100)]);key('a',{ctrlKey:true});fireEvent.click(screen.getByRole('button',{name:'Nhóm các đối tượng'}));
    const grouped=saved(book);expect(grouped[0].groupId).toBeTruthy();expect(grouped[0].groupId).toBe(grouped[1].groupId);
    key('Escape');drag(svg,[{x:150,y:120},{x:180,y:150}]);const moved=saved(book);expect(moved[0]).toMatchObject({x:130,y:130});expect(moved[1]).toMatchObject({x:380,y:130});
    fireEvent.click(screen.getByRole('button',{name:'Bỏ nhóm'}));expect(saved(book).every(o=>!o.groupId)).toBe(true);
  });
  it('opens a right-click menu and locks, unlocks, and deletes the target object',()=>{
    const {book,svg}=open([text('note')]);const context=()=>fireEvent.contextMenu(svg,{clientX:150,clientY:120});context();
    fireEvent.click(within(screen.getByRole('menu',{name:'Thao tác đối tượng'})).getByRole('menuitem',{name:'Khóa'}));expect(saved(book)[0].locked).toBe(true);context();
    expect(within(screen.getByRole('menu',{name:'Thao tác đối tượng'})).getByRole('menuitem',{name:'Xóa Delete'}).disabled).toBe(true);
    fireEvent.click(within(screen.getByRole('menu',{name:'Thao tác đối tượng'})).getByRole('menuitem',{name:'Mở khóa'}));expect(saved(book)[0].locked).toBe(false);context();fireEvent.click(within(screen.getByRole('menu',{name:'Thao tác đối tượng'})).getByRole('menuitem',{name:'Xóa Delete'}));expect(saved(book)).toHaveLength(0);key('z',{ctrlKey:true});expect(saved(book)[0].id).toBe('note');
  });
  it('hides, restores, locks and reorders objects through the layers panel',()=>{
    const {book}=open([text('first',100,100),text('second',350,100)]);fireEvent.click(screen.getByTitle('Các lớp'));fireEvent.click(screen.getByRole('button',{name:'Ẩn first'}));expect(saved(book)[0].hidden).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Hiện first'}));expect(saved(book)[0].hidden).toBe(false);fireEvent.click(screen.getByRole('button',{name:'Khóa first'}));expect(saved(book)[0].locked).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Mở khóa first'}));expect(saved(book)[0].locked).toBe(false);
    fireEvent.click(screen.getByRole('button',{name:'Đưa lớp lên first'}));expect(saved(book).map(o=>o.id)).toEqual(['second','first']);key('z',{ctrlKey:true});expect(saved(book).map(o=>o.id)).toEqual(['first','second']);
  });
  it('rotates grouped member centers around the common pivot and preserves initial angles',()=>{
    const first={...text('first',100,100),groupId:'group',width:100,height:60,rotation:10},second={...text('second',300,100),groupId:'group',width:100,height:60,rotation:10};
    const {book,svg}=open([first,second]);key('v');pointer(svg,'pointerDown',{x:150,y:120});pointer(svg,'pointerUp',{x:150,y:120});
    const handle=svg.querySelector('[data-handle="rotate"]'),cx=Number(handle.getAttribute('cx')),startY=Number(handle.getAttribute('cy'));
    pointer(handle,'pointerDown',{x:cx,y:startY});const pivotY=130;pointer(svg,'pointerMove',{x:cx+(pivotY-startY),y:pivotY});pointer(svg,'pointerUp',{x:cx+(pivotY-startY),y:pivotY});
    const result=saved(book);expect(result[0].rotation).toBeCloseTo(100,0);expect(result[1].rotation).toBeCloseTo(100,0);expect(result[0].x+50).toBeCloseTo(250,0);expect(result[0].y+30).toBeCloseTo(30,0);expect(result[1].x+50).toBeCloseTo(250,0);expect(result[1].y+30).toBeCloseTo(230,0);
  });
  it('leaves browser paste dispatch available when an object was copied internally',()=>{
    const {book,svg}=open([text('note')]);key('v');pointer(svg,'pointerDown',{x:150,y:120});pointer(svg,'pointerUp',{x:150,y:120});key('c',{ctrlKey:true});
    const keydown=new KeyboardEvent('keydown',{key:'v',ctrlKey:true,bubbles:true,cancelable:true});fireEvent(window,keydown);
    expect(keydown.defaultPrevented).toBe(false);expect(saved(book)).toHaveLength(1);
  });
  it('selects the whole group through layers before moving a grouped member',()=>{
    const first={...text('first',100,100),groupId:'g'};first.data.name='Thành viên thứ nhất';const {book,svg}=open([first,{...text('second',350,100),groupId:'g'}]);fireEvent.click(screen.getByTitle('Các lớp'));
    fireEvent.click(screen.getByRole('button',{name:'Thành viên thứ nhất'}));
    drag(svg,[{x:150,y:120},{x:180,y:150}]);const result=saved(book);expect(result[0]).toMatchObject({x:130,y:130});expect(result[1]).toMatchObject({x:380,y:130});
  });
  it('pastes the actual clipboard sentinel repeatedly with increasing offsets',()=>{
    let captured='';const writeText=vi.fn(value=>{captured=value;return Promise.resolve();});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
    const {book,svg}=open([text('note')]);key('v');pointer(svg,'pointerDown',{x:150,y:120});pointer(svg,'pointerUp',{x:150,y:120});key('c',{ctrlKey:true});
    expect(writeText).toHaveBeenCalledOnce();expect(captured.startsWith('smart-study-objects:')).toBe(true);const payload=JSON.parse(captured.slice('smart-study-objects:'.length));expect(payload[0].id).toBe('note');
    fireEvent.paste(window,{clipboardData:{items:[],getData:type=>type==='text/plain'?captured:''}});fireEvent.paste(window,{clipboardData:{items:[],getData:type=>type==='text/plain'?captured:''}});
    const result=saved(book);expect(result).toHaveLength(3);expect(result.map(o=>[o.x,o.y])).toEqual([[100,100],[124,124],[148,148]]);expect(new Set(result.map(o=>o.id)).size).toBe(3);
  });
  it('opens an external pasted URL as a link while an internal object remains copied',()=>{
    const {book,svg}=open([text('note')]);key('v');pointer(svg,'pointerDown',{x:150,y:120});pointer(svg,'pointerUp',{x:150,y:120});key('c',{ctrlKey:true});
    fireEvent.paste(window,{clipboardData:{items:[],getData:type=>type==='text/plain'?'https://example.edu.vn/ghi-chu':''}});
    const dialog=screen.getByRole('dialog');expect(within(dialog).getByLabelText('Đường dẫn').value).toBe('https://example.edu.vn/ghi-chu');expect(within(dialog).getByLabelText('Hiển thị liên kết').value).toBe('card');expect(saved(book)).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole('button',{name:'Hủy'}));expect(saved(book)).toHaveLength(1);
  });
  it('rotates a group from properties around its common center',()=>{
    const first={...text('first',100,100),groupId:'group',width:100,height:60},second={...text('second',300,100),groupId:'group',width:100,height:60};
    const {book,svg}=open([first,second]);key('v');pointer(svg,'pointerDown',{x:150,y:120});pointer(svg,'pointerUp',{x:150,y:120});
    fireEvent.change(screen.getByLabelText('Góc xoay · 0°'),{target:{value:'90'}});const result=saved(book);expect(result[0]).toMatchObject({x:200,y:0,rotation:90});expect(result[1]).toMatchObject({x:200,y:200,rotation:90});key('z',{ctrlKey:true});expect(saved(book)[0]).toMatchObject({x:100,y:100,rotation:0});
  });
  it('commits an existing text object cleared to empty and restores it with undo',()=>{
    const {book,svg}=open([text('note')]);key('v');fireEvent.doubleClick(svg.querySelector('[data-object-id="note"]'));const input=screen.getByLabelText('Nội dung văn bản');fireEvent.change(input,{target:{value:''}});fireEvent.blur(input);
    expect(saved(book)).toHaveLength(1);expect(saved(book)[0].data.text).toBe('');key('z',{ctrlKey:true});expect(saved(book)[0].data.text).toBe('Kiến thức tiếng Việt');
  });
  it('keeps a live text draft on its original page when switching pages',()=>{
    const book=createBook({title:'Hai trang'});const second=createPage(book.id,2);second.title='Trang đích';book.pages.push(second);saveBook(book);const {svg}=mount(book);key('t');pointer(svg,'pointerDown',{x:180,y:220});fireEvent.change(screen.getByLabelText('Nội dung văn bản'),{target:{value:'Chỉ thuộc trang ban đầu'}});
    fireEvent.click(screen.getByRole('button',{name:'Mở Trang đích'}));act(()=>vi.advanceTimersByTime(810));const stored=getBook(book.id);expect(stored.pages[0].objects[0].data.text).toBe('Chỉ thuộc trang ban đầu');expect(stored.pages[1].objects).toHaveLength(0);expect(screen.queryByLabelText('Nội dung văn bản')).toBeNull();expect(screen.getByRole('img',{name:/Canvas Trang đích/})).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Mở Trang 1'}));expect(screen.getByRole('img',{name:/Canvas Trang 1/}).textContent).toContain('Chỉ thuộc trang');
  });
  it('deletes every supported object through both universal selection and properties, with undo',()=>{
    const specs=[['ruler',{}],['protractor',{}],['triangle-ruler',{}],['coordinate-grid',{}],['number-line',{}],['shape',{shape:'compass'}],['image',{src:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E'}],['text',{text:'⭐',fontSize:32}],['table',{rows:1,cols:1,cells:[['Ô dữ liệu']]}],['formula',{latex:'x^2',svg:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E'}],['file',{name:'bai-hoc.txt',src:'data:text/plain,ghi-chu',size:7}]];
    const fixtures=specs.map(([type,data],index)=>({id:`all-${index}`,type,x:40+index*5,y:80+index*5,width:150,height:75,rotation:0,data:{...data,name:`Lớp kiểm tra ${index}`}}));const {book}=open(fixtures);key('a',{ctrlKey:true});key('Delete');expect(saved(book)).toHaveLength(0);key('z',{ctrlKey:true});expect(saved(book).map(o=>o.id)).toEqual(fixtures.map(o=>o.id));
    for(const fixture of fixtures){fireEvent.click(screen.getByTitle('Các lớp'));fireEvent.click(screen.getByRole('button',{name:fixture.data.name}));fireEvent.click(screen.getByRole('button',{name:'Thuộc tính',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Xóa đối tượng',exact:true}));expect(saved(book)).toHaveLength(fixtures.length-1);expect(saved(book).some(o=>o.id===fixture.id)).toBe(false);key('z',{ctrlKey:true});expect(saved(book).map(o=>o.id)).toEqual(fixtures.map(o=>o.id));}
  },30000);
});
