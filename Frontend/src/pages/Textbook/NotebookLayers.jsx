import { useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, Trash2, Layers } from 'lucide-react';

const labels={drawing:'Nét viết tay',text:'Văn bản',image:'Hình ảnh',shape:'Hình học',table:'Bảng',formula:'Công thức',ruler:'Thước kẻ','triangle-ruler':'Ê-ke',protractor:'Thước đo góc',file:'Tệp đính kèm','coordinate-grid':'Hệ trục tọa độ','number-line':'Trục số'};
export default function NotebookLayers({objects,selected,onSelect,onPatch,onMove,onDelete,onReorder}){
  const [drag,setDrag]=useState(null),[renaming,setRenaming]=useState(null),[name,setName]=useState('');
  return <><div className="tb-tool-title">Các lớp<span>Kéo để đổi thứ tự · nhấp đúp tên để đổi tên</span></div>{!objects.length?<p className="tb-tip">Nét viết, chữ và hình sẽ xuất hiện ở đây.</p>:[...objects].reverse().map(o=><div key={o.id} className={'tb-layer '+(selected.includes(o.id)?'active':'')} draggable={!renaming} onDragStart={()=>setDrag(o.id)} onDragEnd={()=>setDrag(null)} onDragOver={e=>e.preventDefault()} onDrop={()=>{if(drag&&drag!==o.id)onReorder(drag,o.id);setDrag(null);}}>
    {renaming===o.id?<input aria-label="Đổi tên lớp" autoFocus value={name} onChange={e=>setName(e.target.value)} onBlur={()=>{onPatch(o.id,{data:{...o.data,name:name.trim()}});setRenaming(null);}} onKeyDown={e=>{if(e.key==='Enter')e.target.blur();if(e.key==='Escape')setRenaming(null);}}/>:<button className="tb-layer-name" onClick={()=>onSelect(o.id)} onDoubleClick={()=>{setRenaming(o.id);setName(o.data?.name||'');}}><Layers size={14}/><span>{o.data?.name||o.data?.text?.slice(0,24)||labels[o.type]||o.type}</span></button>}
    <div>{[[`${o.hidden?'Hiện':'Ẩn'} ${o.id}`,o.hidden?EyeOff:Eye,()=>onPatch(o.id,{hidden:!o.hidden})],[`${o.locked?'Mở khóa':'Khóa'} ${o.id}`,o.locked?Lock:Unlock,()=>onPatch(o.id,{locked:!o.locked})],[`Đưa lớp lên ${o.id}`,ChevronUp,()=>onMove(o,1)],[`Đưa lớp xuống ${o.id}`,ChevronDown,()=>onMove(o,-1)],[`Xóa lớp ${o.id}`,Trash2,()=>onDelete(o.id)]].map(([label,Icon,click],i)=><button type="button" key={label} className="tb-icon" aria-label={label} title={label} disabled={o.locked&&i>=2} onClick={click}><Icon size={13}/></button>)}</div>
  </div>)}</>;
}
