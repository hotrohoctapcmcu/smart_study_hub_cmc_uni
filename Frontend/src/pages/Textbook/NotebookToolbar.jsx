import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MousePointer2, Lasso, Hand, PenLine, Pencil, Highlighter, Eraser, Type, Shapes, Ruler, Triangle, Circle, Table2, ImagePlus, Paperclip, Link2, Sigma, Sticker, Sparkles, Undo2, Redo2, ChevronDown, Pin, PinOff, Clock3, Star, Minus, MoveUpRight, Heading, StickyNote, AlignLeft, Grid2X2, Code2, GitBranch, Camera, Search, Check, X, Brush } from 'lucide-react';
import './NotebookToolbar.css';

const entry = (id, label, icon, action, value, options, shortcut) => ({ id, label, icon, action, value, options, shortcut });
export const NOTEBOOK_TOOL_GROUPS = [
  { id:'selection', label:'Chọn', icon:MousePointer2, entries:[
    entry('select','Chọn đối tượng',MousePointer2,'tool','select',null,'V'), entry('lasso','Khoanh vùng Lasso',Lasso,'tool','lasso'), entry('multi','Chọn nhiều đối tượng',MousePointer2,'tool','multi'), entry('pan','Di chuyển trang',Hand,'tool','pan',null,'H / Space + kéo')
  ] },
  { id:'writing', label:'Viết', icon:PenLine, entries:[
    entry('ballpoint','Bút bi',PenLine,'tool','pen',{penType:'ballpoint'},'P'), entry('pencil','Bút chì',Pencil,'tool','pencil'), entry('fountain','Bút máy',PenLine,'tool','pen',{penType:'fountain'}), entry('brush','Bút cọ',Brush,'tool','pen',{penType:'brush'}), entry('marker','Bút dạ',PenLine,'tool','marker'), entry('calligraphy','Bút thư pháp',PenLine,'tool','pen',{penType:'calligraphy'}), entry('highlighter','Bút đánh dấu',Highlighter,'tool','highlighter'), entry('eraser','Tẩy',Eraser,'tool','eraser',null,'E')
  ] },
  { id:'text', label:'Văn bản', icon:Type, entries:[
    entry('text','Chữ tự do',Type,'tool','text',{variant:'text'},'T'), entry('textbox','Hộp văn bản',Type,'tool','text',{variant:'textbox'}), entry('paragraph','Đoạn văn',AlignLeft,'tool','text',{variant:'paragraph'}), entry('heading','Tiêu đề',Heading,'tool','text',{variant:'heading'}), entry('sticky','Giấy ghi chú',StickyNote,'tool','text',{variant:'sticky'})
  ] },
  { id:'shapes', label:'Hình học', icon:Shapes, entries:[
    entry('line','Đường thẳng',Minus,'tool','line',null,'L'), entry('arrow','Mũi tên',MoveUpRight,'tool','arrow'),
    ...[['rectangle','Chữ nhật'],['rounded','Chữ nhật bo góc'],['circle','Hình tròn'],['ellipse','Ellipse'],['triangle','Tam giác'],['polygon','Đa giác'],['diamond','Hình thoi'],['star','Ngôi sao'],['bubble','Bong bóng hội thoại']].map(([shape,label])=>entry(shape,label,shape==='circle'?Circle:shape==='triangle'?Triangle:shape==='star'?Star:Shapes,'tool','shape',{shape},shape==='rectangle'?'R':null))
  ] },
  { id:'study', label:'Dụng cụ', icon:Ruler, entries:[
    entry('ruler','Thước kẻ',Ruler,'insert','ruler'), entry('triangle-ruler','Ê-ke',Triangle,'insert','triangle-ruler'), entry('protractor','Thước đo góc',Circle,'insert','protractor'), entry('compass','Compa · kéo để vẽ tròn',Circle,'tool','compass'), entry('coordinate-grid','Hệ trục tọa độ',Grid2X2,'insert','coordinate-grid'), entry('number-line','Trục số',MoveUpRight,'insert','number-line')
  ] },
  { id:'content', label:'Chèn', icon:ImagePlus, entries:[
    entry('table','Bảng',Table2,'insert','table'), entry('image','Hình ảnh',ImagePlus,'insert','image'), entry('camera','Ảnh từ camera',Camera,'insert','camera'), entry('file','Tệp đính kèm / PDF',Paperclip,'insert','file'), entry('link','Liên kết',Link2,'insert','link'), entry('formula','Công thức LaTeX',Sigma,'insert','formula'), entry('code','Khối mã',Code2,'insert','code'), entry('diagram','Sơ đồ',GitBranch,'insert','diagram'), entry('mindmap','Sơ đồ tư duy',GitBranch,'insert','mindmap'), entry('sticker','Sticker',Sticker,'insert','sticker')
  ] },
  { id:'ai', label:'Trợ lý AI', icon:Sparkles, entries:[
    ...['Hỗ trợ ghi chú','Tóm tắt','Giải thích','Tạo flashcard','Tạo quiz','Sửa chính tả','Viết lại','OCR','Viết tay thành chữ','Công thức viết tay thành LaTeX'].map((label,i)=>entry('ai-'+i,label,Sparkles,'ai',label))
  ] }
];
const allEntries=NOTEBOOK_TOOL_GROUPS.flatMap(group=>group.entries);
function readPreferences(){try{const value=JSON.parse(localStorage.getItem('ssh-notebook-toolbar')||'null');return {pins:Array.isArray(value?.pins)?value.pins:['ballpoint','text','ruler'],recent:Array.isArray(value?.recent)?value.recent:[]};}catch{return {pins:['ballpoint','text','ruler'],recent:[]};}}

export default function NotebookToolbar({tool,toolOptions,onTool,onInsert,onAI,onUndo,onRedo,canUndo,canRedo,color,onColor,thickness,onThickness,children}){
  const [preferences,setPreferences]=useState(readPreferences),[menu,setMenu]=useState(null),[query,setQuery]=useState(''),[position,setPosition]=useState({top:0,left:0}),[chosen,setChosen]=useState(null);
  const toolbarRef=useRef(null),menuRef=useRef(null),triggerRef=useRef(null);
  useEffect(()=>{try{localStorage.setItem('ssh-notebook-toolbar',JSON.stringify(preferences));}catch{/* Preferences must never interrupt writing. */}},[preferences]);
  useEffect(()=>{if(!menu)return;const close=e=>{if(!menuRef.current?.contains(e.target)&&!toolbarRef.current?.contains(e.target))setMenu(null);};const escape=e=>{if(e.key==='Escape'){setMenu(null);triggerRef.current?.focus();}};const reposition=()=>setMenu(null);document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);window.addEventListener('resize',reposition);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);window.removeEventListener('resize',reposition);};},[menu]);
  function toggleMenu(id,event){if(menu===id){setMenu(null);return;}const rect=event.currentTarget.getBoundingClientRect();triggerRef.current=event.currentTarget;setPosition({left:Math.max(8,Math.min(rect.left,window.innerWidth-310)),top:rect.bottom+8});setQuery('');setMenu(id);}
  function activate(item){setChosen(item.id);setPreferences(old=>({...old,recent:[item.id,...old.recent.filter(id=>id!==item.id)].slice(0,8)}));setMenu(null);if(item.action==='tool')onTool?.(item.value,item.options||{});else if(item.action==='insert')onInsert?.(item.value,item.options||{});else onAI?.(item.value);}
  function togglePin(id){setPreferences(old=>({...old,pins:old.pins.includes(id)?old.pins.filter(value=>value!==id):[...old.pins,id].slice(-8)}));}
  const isActive=item=>item.action==='tool'&&item.value===tool&&(toolOptions?Object.entries(item.options||{}).every(([key,value])=>toolOptions[key]===value):(!chosen||chosen===item.id||allEntries.find(value=>value.id===chosen)?.value!==tool));
  const group=NOTEBOOK_TOOL_GROUPS.find(value=>value.id===menu);
  const entries=(menu==='favorites'?preferences.pins.map(id=>allEntries.find(item=>item.id===id)):menu==='recent'?preferences.recent.map(id=>allEntries.find(item=>item.id===id)):group?.entries||[]).filter(Boolean).filter(item=>item.label.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
  return <div ref={toolbarRef} className="nb-toolbar" role="toolbar" aria-label="C · Công cụ vở ghi">
    <div className="nb-history"><button type="button" title="Hoàn tác · Ctrl Z" aria-label="Hoàn tác · Ctrl Z" disabled={!canUndo} onClick={onUndo}><Undo2 size={17}/></button><button type="button" title="Làm lại · Ctrl Shift Z" aria-label="Làm lại · Ctrl Shift Z" disabled={!canRedo} onClick={onRedo}><Redo2 size={17}/></button></div>
    <div className="nb-primary-tools" aria-label="Công cụ nhanh">{[['ballpoint','Bút mực · P'],['eraser','Tẩy · E'],['text','Văn bản · T']].map(([id,label])=>{const item=allEntries.find(value=>value.id===id),Icon=item.icon;return <button type="button" key={id} aria-label={label} title={label} className={isActive(item)?'active':''} onClick={()=>activate(item)}><Icon size={18}/></button>;})}</div>
    <div className="nb-tool-groups">{NOTEBOOK_TOOL_GROUPS.map(({id,label,icon:Icon,entries:items})=>{const active=items.some(isActive);return <button type="button" key={id} className={'nb-group-trigger '+(active?'active ':'')+(menu===id?'open':'')} title={label} aria-label={label} aria-haspopup="menu" aria-expanded={menu===id} onClick={e=>toggleMenu(id,e)}><Icon size={18}/><span>{label}</span><ChevronDown size={12}/></button>;})}</div>
    <div className="nb-quick-settings">{onColor&&<label className="nb-color" title="Màu công cụ"><input type="color" aria-label="Màu công cụ nhanh" value={color||'#8060c9'} onChange={e=>onColor(e.target.value)}/><span style={{background:color||'#8060c9'}}/></label>}{onThickness&&<select aria-label="Độ dày công cụ nhanh" title="Độ dày nét" value={thickness} onChange={e=>onThickness(Number(e.target.value))}>{![1,2,3,5,8,12].includes(thickness)&&<option value={thickness}>{thickness} px</option>}{[1,2,3,5,8,12].map(width=><option value={width} key={width}>{width} px</option>)}</select>}<button type="button" className={menu==='favorites'?'active':''} title="Công cụ đã ghim" aria-label="Công cụ đã ghim" aria-haspopup="menu" aria-expanded={menu==='favorites'} onClick={e=>toggleMenu('favorites',e)}><Pin size={16}/></button><button type="button" className={menu==='recent'?'active':''} title="Công cụ vừa dùng" aria-label="Công cụ vừa dùng" aria-haspopup="menu" aria-expanded={menu==='recent'} onClick={e=>toggleMenu('recent',e)}><Clock3 size={16}/></button></div>
    {children&&<div className="nb-extra-controls">{children}</div>}
    {menu&&createPortal(<div ref={menuRef} className="nb-tool-menu" style={{left:position.left,top:position.top,maxHeight:`calc(100dvh - ${position.top+12}px)`}} onKeyDown={e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;const items=[...menuRef.current.querySelectorAll('[role="menuitem"]')];if(!items.length)return;e.preventDefault();const index=items.indexOf(document.activeElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}}>
      <div className="nb-menu-heading"><strong>{group?.label||(menu==='favorites'?'Công cụ đã ghim':'Vừa sử dụng')}</strong><button type="button" title="Đóng menu" aria-label="Đóng menu công cụ" onClick={()=>{setMenu(null);triggerRef.current?.focus();}}><X size={15}/></button></div>
      <label className="nb-menu-search"><Search size={14}/><input autoFocus aria-label="Tìm công cụ" placeholder="Tìm công cụ…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <div role="menu" aria-label={group?.label||'Công cụ'} className="nb-menu-list">{entries.map(item=>{const Icon=item.icon,pinned=preferences.pins.includes(item.id);return <div className="nb-menu-row" key={item.id}><button type="button" role="menuitem" className={isActive(item)?'active':''} title={item.label+(item.shortcut?' · '+item.shortcut:'')} onClick={()=>activate(item)}><Icon size={17}/><span>{item.label}</span>{item.shortcut&&<kbd>{item.shortcut}</kbd>}{isActive(item)&&<Check size={14}/>}</button><button type="button" className={'nb-pin '+(pinned?'pinned':'')} aria-label={(pinned?'Bỏ ghim ':'Ghim ')+item.label} title={(pinned?'Bỏ ghim ':'Ghim ')+item.label} aria-pressed={pinned} onClick={()=>togglePin(item.id)}>{pinned?<PinOff size={14}/>:<Pin size={14}/>}</button></div>;})}{!entries.length&&<p className="nb-menu-empty">{query?'Không tìm thấy công cụ.':menu==='recent'?'Công cụ bạn sử dụng sẽ xuất hiện ở đây.':'Mở nhóm công cụ và nhấn ghim để thêm vào đây.'}</p>}</div>
      <div className="nb-menu-footnote">{menu==='study'?'Thước ở lại trên trang khi bạn chuyển sang bút.':'Nhấn biểu tượng ghim để truy cập công cụ yêu thích.'}</div>
    </div>,document.body)}
  </div>;
}
