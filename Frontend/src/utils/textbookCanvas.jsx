import { markdownTextLines, graphemes } from './markdownCanvas';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { localToWorld } from './notebookGeometry';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function paperSize(paper = {}) {
  if(paper.size==='Infinite')return [Math.max(1800,paper.width||1800),Math.max(1800,paper.height||1800)];
  const size = paper.size === 'A5' ? [560, 794] : [794, 1123];
  return paper.orientation === 'landscape' ? [...size].reverse() : size;
}
export function objectBounds(o) {
  let box;
  if (o.type === 'drawing' && o.data?.points?.length) {
    const pts = o.data.points, xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    box={ x: Math.min(...xs), y: Math.min(...ys), width: Math.max(1, Math.max(...xs) - Math.min(...xs)), height: Math.max(1, Math.max(...ys) - Math.min(...ys)) };
  } else box={x:0,y:0,width:o.width||100,height:o.height||40};
  if(o.rotation||o.skewX){
    const corners=[{x:box.x,y:box.y},{x:box.x+box.width,y:box.y},{x:box.x+box.width,y:box.y+box.height},{x:box.x,y:box.y+box.height}].map(p=>localToWorld(p,o));
    const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);
    return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
  }
  return {...box,x:(o.x||0)+box.x,y:(o.y||0)+box.y};
}
export function selectionBounds(objects) {
  if (!objects.length) return null;
  const rows = objects.map(objectBounds), x = Math.min(...rows.map(b => b.x)), y = Math.min(...rows.map(b => b.y));
  return { x, y, width: Math.max(...rows.map(b => b.x + b.width)) - x, height: Math.max(...rows.map(b => b.y + b.height)) - y };
}
export function intersects(a, b) { return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y; }
export function normalizeTableMerges(data){
  const rows=data.rows||1,cols=data.cols||1,result=[],occupied=new Set(),source=[...(data.merged?[{row:0,col:0,rowSpan:1,colSpan:cols}]:[]),...(data.merges||[])];
  for(const entry of source){
    const row=clamp(Math.floor(entry.row||0),0,rows-1),col=clamp(Math.floor(entry.col||0),0,cols-1),rowSpan=clamp(Math.floor(entry.rowSpan||1),1,rows-row),colSpan=clamp(Math.floor(entry.colSpan||1),1,cols-col);
    if(rowSpan===1&&colSpan===1)continue;
    const keys=[];for(let r=row;r<row+rowSpan;r++)for(let c=col;c<col+colSpan;c++)keys.push(`${r}:${c}`);
    if(keys.some(key=>occupied.has(key)))continue;
    keys.forEach(key=>occupied.add(key));result.push({row,col,rowSpan,colSpan});
  }return result;
}
function tableRange(data,range){return {row:clamp(Math.min(range.row1,range.row2),0,data.rows-1),col:clamp(Math.min(range.col1,range.col2),0,data.cols-1),rowSpan:Math.abs(clamp(range.row1,0,data.rows-1)-clamp(range.row2,0,data.rows-1))+1,colSpan:Math.abs(clamp(range.col1,0,data.cols-1)-clamp(range.col2,0,data.cols-1))+1};}
export function splitTableCells(data,range){const box=tableRange(data,range),overlaps=m=>m.row<box.row+box.rowSpan&&m.row+m.rowSpan>box.row&&m.col<box.col+box.colSpan&&m.col+m.colSpan>box.col;return {...data,merged:false,merges:normalizeTableMerges(data).filter(m=>!overlaps(m))};}
export function mergeTableCells(data,range){const next=splitTableCells(data,range),merged=tableRange(data,range);return {...next,merges:[...next.merges,...(merged.rowSpan>1||merged.colSpan>1?[merged]:[])]};}
export function tableCellSpans(data,row,col){const merge=normalizeTableMerges(data).find(m=>row>=m.row&&row<m.row+m.rowSpan&&col>=m.col&&col<m.col+m.colSpan);return merge?(merge.row===row&&merge.col===col?{rowSpan:merge.rowSpan,colSpan:merge.colSpan}:null):{rowSpan:1,colSpan:1};}
export function smoothPath(points = []) {
  if (!points.length) return '';
  if (points.length === 1) return `M${points[0].x} ${points[0].y}l.1 .1`;
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) d += ` Q${points[i].x} ${points[i].y} ${(points[i].x + points[i+1].x)/2} ${(points[i].y + points[i+1].y)/2}`;
  return d + ` L${points.at(-1).x} ${points.at(-1).y}`;
}
export function scaleObject(o, box, sx, sy) {
  if(o.rotation||o.skewX){
    // Decompose the scaled world transform into rotation, scale and shear.
    // This keeps the resized corners aligned to the selection even at 45°.
    const angle=(o.rotation||0)*Math.PI/180,k=Math.tan((o.skewX||0)*Math.PI/180),c=Math.cos(angle),s=Math.sin(angle),ux=sx*c,uy=sy*s,vx=sx*(c*k-s),vy=sy*(s*k+c),ax=Math.hypot(ux,uy),ay=sx*sy/ax,shear=(ux*vx+uy*vy)/(ax*ay),width=(o.width||100)*ax,height=(o.height||40)*ay,cx=(o.x||0)+(o.width||100)/2,cy=(o.y||0)+(o.height||40)/2;
    const next={...o,x:box.x+(cx-box.x)*sx-width/2,y:box.y+(cy-box.y)*sy-height/2,width,height,rotation:Math.atan2(uy,ux)*180/Math.PI,skewX:Math.atan(shear)*180/Math.PI};
    if(o.type==='drawing')next.data={...o.data,points:o.data.points.map(p=>({...p,x:p.x*ax,y:p.y*ay}))};
    return next;
  }
  const next = { ...o, x: box.x + (o.x - box.x) * sx, y: box.y + (o.y - box.y) * sy, width: o.width * sx, height: o.height * sy };
  if (o.type === 'drawing') next.data = { ...o.data, points: o.data.points.map(p => ({ ...p, x: p.x*sx, y: p.y*sy })) };
  return next;
}
function Shape({ o }) {
  const d = o.data || {}, w = o.width, h = o.height, common = { fill: d.fill || 'none', stroke: d.color || '#7360be', strokeWidth: d.thickness || 2, strokeLinejoin: 'round',strokeDasharray:d.borderStyle==='dashed'?'9 6':d.borderStyle==='dotted'?'2 5':undefined,style:d.shadow?{filter:'drop-shadow(2px 4px 4px #30213a35)'}:undefined };
  const kind = d.shape || 'rectangle';
  if (['line','arrow','double-arrow','dashed','connector'].includes(kind)) {
    const startX=d.flipX?w:0,endX=d.flipX?0:w,startY=d.flipY?h:0,endY=d.flipY?0:h,angle = Math.atan2(endY-startY,endX-startX), length = 11, head = (x,y,a) => `${x-length*Math.cos(a-.45)},${y-length*Math.sin(a-.45)} ${x},${y} ${x-length*Math.cos(a+.45)},${y-length*Math.sin(a+.45)}`;
    return <g {...common} fill="none"><path d={kind === 'connector' ? `M${startX} ${startY}H${w/2}V${endY}H${endX}` : `M${startX} ${startY}L${endX} ${endY}`} strokeDasharray={kind === 'dashed' ? '9 6' : undefined}/>{['arrow','double-arrow'].includes(kind) && <polyline points={head(endX,endY,angle)}/>} {kind === 'double-arrow' && <polyline points={head(startX,startY,angle+Math.PI)}/>}</g>;
  }
  if (kind==='compass')return <g><ellipse cx={w/2} cy={h/2} rx={w/2} ry={h/2} {...common}/><circle cx={w/2} cy={h/2} r="2" fill={d.color||'#7360be'}/><line x1={w/2} y1={h/2} x2={w} y2={h/2} stroke={d.color||'#7360be'} strokeDasharray="4 4"/><text x={w*.75} y={h/2-7} textAnchor="middle" fontSize="11" fill={d.color||'#7360be'}>r = {Math.round(w/2)} px</text></g>;
  if (['circle','ellipse'].includes(kind)) return <ellipse cx={w/2} cy={h/2} rx={w/2} ry={h/2} {...common}/>;
  if (kind === 'triangle') return <polygon points={`${w/2},0 ${w},${h} 0,${h}`} {...common}/>;
  if (kind === 'diamond') return <polygon points={`${w/2},0 ${w},${h/2} ${w/2},${h} 0,${h/2}`} {...common}/>;
  if (['star','polygon'].includes(kind)) {
    const n = kind === 'star' ? 10 : 6, pts = Array.from({length:n},(_,i) => { const a = i * Math.PI*2/n-Math.PI/2, r = kind === 'star' && i%2 ? .22 : .5; return `${w/2+Math.cos(a)*w*r},${h/2+Math.sin(a)*h*r}`; }).join(' ');
    return <polygon points={pts} {...common}/>;
  }
  if (kind === 'bubble') return <path d={`M12 0H${w-12}Q${w} 0 ${w} 12V${h-30}Q${w} ${h-18} ${w-12} ${h-18}H40L20 ${h}V${h-18}H12Q0 ${h-18} 0 ${h-30}V12Q0 0 12 0Z`} {...common}/>;
  return <rect width={w} height={h} rx={kind === 'rounded' ? 18 : 0} {...common}/>;
}
function Geometry({ o }) {
  const w=o.width,h=o.height,d=o.data||{},ink=d.color||'#655387',angle=o.rotation||0;
  if (o.type === 'ruler') {
    const length=d.length||Math.max(1,Math.round(w/37.8)),steps=length*10;
    return <g><rect width={w} height={h} rx="4" fill="#d5c9ff" fillOpacity=".52" stroke={ink}/>{Array.from({length:steps+1},(_,i)=><g key={i}><line x1={i*w/steps} x2={i*w/steps} y1="0" y2={i%10===0?Math.min(22,h*.4):i%5===0?16:9} stroke={ink} strokeWidth={i%10===0?1:.6}/>{i%10===0&&<text x={i*w/steps+3} y={Math.min(37,h*.68)} fontSize="10" fill={ink}>{d.unit==='mm'?i:i/10}</text>}</g>)}<text x={w/2} y={h-6} textAnchor="middle" fontSize="10" fill={ink}>{d.unit==='mm'?length*10:length} {d.unit||'cm'} · {angle}°</text></g>;
  }
  if(['triangle-ruler','set-square'].includes(o.type))return <g><path d={`M0 0L0 ${h}L${w} ${h}Z M${w*.16} ${h*.43}L${w*.16} ${h*.82}L${w*.55} ${h*.82}Z`} fill="#c9e8ee" fillOpacity=".65" fillRule="evenodd" stroke={ink}/>{Array.from({length:21},(_,i)=><g key={i}><line x1={i*w/20} x2={i*w/20} y1={h} y2={h-(i%5===0?16:8)} stroke={ink}/><line x1="0" x2={i%5===0?16:8} y1={i*h/20} y2={i*h/20} stroke={ink}/></g>)}<path d={`M0 ${h-22}H22V${h}`} fill="none" stroke={ink}/><text x={w*.22} y={h*.71} fontSize="12" fill={ink}>{d.angle===30?'30° / 60°':'45° / 45°'}</text><text x={w*.25} y={h-5} fontSize="10" fill={ink}>{angle}°</text></g>;
  if(['coordinate-grid','grid'].includes(o.type)){const step=d.step||24;return <g><rect width={w} height={h} fill={d.fill||'#ffffff'} fillOpacity=".65"/>{Array.from({length:Math.floor(w/step)+1},(_,i)=><line key={'v'+i} x1={i*step} x2={i*step} y1="0" y2={h} stroke={ink} strokeOpacity=".25"/>)}{Array.from({length:Math.floor(h/step)+1},(_,i)=><line key={'h'+i} x1="0" x2={w} y1={i*step} y2={i*step} stroke={ink} strokeOpacity=".25"/>)}<path d={`M0 ${h/2}H${w}m-8 -4l8 4l-8 4M${w/2} ${h}V0m-4 8l4 -8l4 8`} fill="none" stroke={ink} strokeWidth="1.5"/><text x={w-12} y={h/2-8} fontSize="12" fill={ink}>x</text><text x={w/2+8} y="14" fontSize="12" fill={ink}>y</text><text x={w/2+5} y={h/2+15} fontSize="11" fill={ink}>0</text></g>;}
  if(o.type==='number-line'){const min=d.min??-5,max=d.max??5,count=Math.max(1,Math.min(100,max-min));return <g><path d={`M0 ${h/2}H${w}m-8 -4l8 4l-8 4M8 ${h/2-4}L0 ${h/2}l8 4`} fill="none" stroke={ink} strokeWidth="1.5"/>{Array.from({length:count+1},(_,i)=><g key={i}><line x1={15+i*(w-30)/count} x2={15+i*(w-30)/count} y1={h/2-6} y2={h/2+6} stroke={ink}/><text x={15+i*(w-30)/count} y={h/2+23} fontSize="11" textAnchor="middle" fill={ink}>{min+i}</text></g>)}</g>;}
  const marker=d.markerAngle??45,ma=-marker*Math.PI/180;
  return <g><path d={`M0 ${h}A${w/2} ${h} 0 0 1 ${w} ${h}Z`} fill="#c7dafa" fillOpacity=".45" stroke="#788caf"/>{Array.from({length:181},(_,i)=>{const a=Math.PI+i*Math.PI/180,cx=w/2,cy=h,tick=i%10===0?15:i%5===0?10:5;return <g key={i}><line x1={cx+Math.cos(a)*(w/2)} y1={cy+Math.sin(a)*h} x2={cx+Math.cos(a)*(w/2-tick)} y2={cy+Math.sin(a)*(h-tick)} stroke="#5b7196" strokeWidth={i%10===0?1:.5}/>{i%10===0&&<text x={cx+Math.cos(a)*(w/2-30)} y={cy+Math.sin(a)*(h-30)} textAnchor="middle" fontSize="9" fill="#5b7196">{180-i}°</text>}</g>;})}<line x1="0" y1={h} x2={w} y2={h} stroke="#5b7196"/><line x1={w/2} y1={h} x2={w/2+Math.cos(ma)*(w/2-10)} y2={h+Math.sin(ma)*(h-10)} stroke="#b5688e" strokeDasharray="4 3"/><circle cx={w/2} cy={h} r="4" fill="#5b7196"/><text x={w/2+7} y={h-8} fontSize="10" fill="#5b7196">{marker}° · xoay {angle}°</text></g>;
}
export function tableLayout(data,width,height){
  const rows=data.rows||3,cols=data.cols||3,weights=(list,count)=>Array.from({length:count},(_,i)=>Math.max(.1,Number(list?.[i])||1));
  const cw=weights(data.columnWidths||data.colWidths,cols),rh=weights(data.rowHeights,rows),sumW=cw.reduce((a,b)=>a+b,0),sumH=rh.reduce((a,b)=>a+b,0);
  const widths=cw.map(v=>v/sumW*width),heights=rh.map(v=>v/sumH*height),xs=[0],ys=[0];widths.forEach(v=>xs.push(xs.at(-1)+v));heights.forEach(v=>ys.push(ys.at(-1)+v));return {widths,heights,xs,ys};
}
export function textLines(text,data,width){
  if(data.markdown)return markdownTextLines(String(text||''),data,width);
  const size=data.fontSize||22,spacing=data.letterSpacing||0,limit=Math.max(1,width-(data.indent||0)),output=[];
  const estimate=value=>Array.from(value).reduce((n,c)=>n+(/[ilI.,! :;]/.test(c)?.3:/[MW@]/.test(c)?.9:.57)*size+spacing,0);
  const source=String(text||'').split('\n');
  source.forEach((paragraph,index)=>{let value=data.uppercase?paragraph.toLocaleUpperCase():data.lowercase?paragraph.toLocaleLowerCase():paragraph;
    const prefix=data.list==='bullet'?'• ':['number','numbering'].includes(data.list)?`${index+1}. `:['check','checklist'].includes(data.list)?'☐ ':'';value=prefix+value;
    if(data.wrap===false){output.push({text:value,paragraphEnd:true});return;}
    let line='';for(const word of value.split(/(\s+)/)){if(line&&estimate(line+word)>limit){output.push({text:line.trimEnd(),paragraphEnd:false});line='';}for(const char of graphemes(word)){if(line&&estimate(line+char)>limit){output.push({text:line.trimEnd(),paragraphEnd:false});line='';}line+=char;}}output.push({text:line||' ',paragraphEnd:true});
  });return output;
}
export function textContentHeight(text,data,width){
  const lines=textLines(text,data,width),size=data.fontSize||22;
  return Math.ceil(size+lines.slice(0,-1).reduce((height,line)=>height+size*(data.lineHeight||1.4)+(line.paragraphEnd?(Number(data.paragraphSpacing)||0):0),0)+size*.3+8);
}
export function ObjectArtwork({ object: o, onPointerDown, onDoubleClick, interactive = false }) {
  const d = o.data || {}, w=o.width||100,h=o.height||40;
  let content;
  if (o.type === 'drawing') {
    const pressure=['fountain','brush','calligraphy'].includes(d.penType)&&d.pressure!==false,points=d.points||[],base=d.thickness||3;
    content=pressure&&points.length>1?<g fill="none" stroke={d.color||'#343047'} strokeLinecap="round" strokeLinejoin="round">{points.slice(1).map((point,i)=><path key={i} d={`M${points[i].x} ${points[i].y}L${point.x} ${point.y}`} strokeWidth={base*(.35+((points[i].pressure??.5)+(point.pressure??.5))*.65)}/>)}</g>:<path d={smoothPath(points)} fill="none" stroke={d.color || '#343047'} strokeWidth={base} strokeLinecap="round" strokeLinejoin="round"/>;
  }
  else if (o.type === 'shape') content=<Shape o={o}/>;
  else if (o.type === 'image') {
    const crop=typeof d.crop==='object'?d.crop:null,cx=clamp(Number(crop?.x)||0,0,99),cy=clamp(Number(crop?.y)||0,0,99),cw=clamp(Number(crop?.width)||100,1,100-cx),ch=clamp(Number(crop?.height)||100,1,100-cy);
    content=<g transform={`${d.flipX?`translate(${w} 0) scale(-1 1)`:''} ${d.flipY?`translate(0 ${h}) scale(1 -1)`:''}`} style={d.shadow?{filter:'drop-shadow(0px 5px 5px #30213a40)'}:undefined}><svg width={w} height={h} viewBox={crop?`${cx} ${cy} ${cw} ${ch}`:`0 0 ${w} ${h}`} preserveAspectRatio="none" overflow="hidden"><image href={d.src} width={crop?100:w} height={crop?100:h} preserveAspectRatio={d.crop&&!crop?'xMidYMid slice':'none'}/></svg>{d.border&&<rect width={w} height={h} fill="none" stroke={d.color||'#8060c9'} strokeWidth={d.thickness||2}/>}</g>;
  }
  else if (['ruler','protractor','triangle-ruler','set-square','coordinate-grid','grid','number-line'].includes(o.type)) content=<Geometry o={o}/>;
  else if(o.type==='file')content=<g><rect width={w} height={h} rx="10" fill={d.fill||'#f5f1fc'} stroke={d.color||'#a594bf'}/><path d="M16 15H32L39 22V51H16ZM32 15V23H39" fill="none" stroke={d.color||'#8060c9'} strokeWidth="1.5"/><text x="50" y="28" fontSize="14" fontWeight="600" fill="#393044">{String(d.name||'Tệp đính kèm').slice(0,Math.max(8,(w-60)/8))}</text><text x="50" y="48" fontSize="11" fill="#7d728b">{d.size?`${Math.round(d.size/1024)} KB`:'Tệp đính kèm'} · Mở / tải xuống trong thuộc tính</text></g>;
  else if (o.type === 'table') {
    const rows=d.rows||3,cols=d.cols||3,{xs,ys}=tableLayout(d,w,h);
    content=<g style={d.shadow?{filter:'drop-shadow(2px 4px 4px #30213a35)'}:undefined}>{Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>{
      const span=tableCellSpans(d,r,c);if(!span)return null;const cellWidth=xs[c+span.colSpan]-xs[c],cellHeight=ys[r+span.rowSpan]-ys[r];
      const cellLines=textLines(d.cells?.[r]?.[c]||'',{...d,fontSize:d.fontSize||13},cellWidth-16),lineHeight=(d.fontSize||13)*1.35;
      return <g key={`${r}-${c}`}><rect x={xs[c]} y={ys[r]} width={cellWidth} height={cellHeight} fill={r===0?(d.headerColor||'#eee8ff'):(d.fill||'#ffffff')} stroke={d.color||'#8b7da7'} strokeWidth={d.thickness||1} strokeDasharray={d.borderStyle==='dashed'?'9 6':d.borderStyle==='dotted'?'2 5':undefined}/><text x={xs[c]+(d.align==='center'?cellWidth/2:d.align==='right'?cellWidth-8:8)} y={ys[r]+Math.min(cellHeight-5,22)} textAnchor={d.align==='center'?'middle':d.align==='right'?'end':'start'} fontFamily={d.font||'Arial'} fontSize={d.fontSize||13} fill={d.textColor||'#393044'}>{cellLines.slice(0,Math.max(1,Math.floor((cellHeight-10)/lineHeight))).map((line,i)=><tspan key={i} x={xs[c]+(d.align==='center'?cellWidth/2:d.align==='right'?cellWidth-8:8)} dy={i?lineHeight:0}>{line.text}</tspan>)}</text></g>;
    }))}</g>;
  } else if(o.type==='formula' && d.svg) content=<image href={d.svg} width={w} height={h} preserveAspectRatio="xMinYMin meet"/>;
  else {
    const fontSize=d.fontSize||22,lines=textLines(d.text||d.latex||'',d,w),indent=Number(d.indent)||0,anchor=d.align==='center'?'middle':d.align==='right'?'end':'start',textX=d.align==='center'?w/2:d.align==='right'?w:indent;
    let baseline=fontSize;
    const background=d.background||(d.variant==='sticky'?'#fff0ae':d.variant==='code'?'#f3f1f8':null);
    const layout=lines.map(line=>{const y=baseline;baseline+=fontSize*(d.lineHeight||1.4)+(line.paragraphEnd?(Number(d.paragraphSpacing)||0):0);const justified=d.align==='justify'&&!line.paragraphEnd&&line.text.includes(' '),estimated=Array.from(line.text).reduce((n,c)=>n+(/[ilI.,! :;]/.test(c)?.3:/[MW@]/.test(c)?.9:.57)*fontSize+(d.letterSpacing||0),0),width=justified?Math.max(1,w-indent):Math.min(Math.max(1,w-indent),estimated);return {...line,y,width,justified};});
    content=<g>{background&&background!=='none'&&<rect width={w} height={h} rx={d.variant==='sticky'?3:0} fill={background}/>}{d.highlight&&d.highlight!=='none'&&layout.map((line,i)=><rect key={'highlight-'+i} data-text-highlight={i} x={d.align==='center'?textX-line.width/2:d.align==='right'?textX-line.width:textX} y={line.y-fontSize*.85} width={line.width} height={fontSize*1.15} fill={d.highlight}/>)}<text xmlSpace="preserve" fill={d.color||'#343047'} fontSize={fontSize} fontFamily={d.font||(d.variant==='code'?'Courier New':'Arial')} fontWeight={d.bold?'bold':'normal'} fontStyle={d.italic?'italic':'normal'} textDecoration={[d.underline?'underline':'',d.strike||d.strikethrough?'line-through':''].filter(Boolean).join(' ')||undefined} letterSpacing={d.letterSpacing||0} stroke={d.textBorder?d.textBorder===true?d.color||'#343047':d.textBorder:undefined} strokeWidth={d.textBorder ? .4 : undefined} paintOrder="stroke" style={d.textShadow?{filter:'drop-shadow(1px 2px 2px #30213a55)'}:undefined} textAnchor={anchor} x={textX} y={fontSize}>{layout.map((line,i)=><tspan key={i} x={textX} y={line.y} textLength={line.justified?Math.max(1,w-indent):undefined} lengthAdjust={d.align==='justify'?'spacing':undefined}>{line.runs ? line.runs.map((run,j)=><tspan key={j} fontWeight={run.bold?'bold':undefined} fontStyle={run.italic?'italic':undefined} fontFamily={run.code?'Consolas,monospace':undefined} textDecoration={run.underline?'underline':undefined}>{run.text}</tspan>) : line.text||' '}</tspan>)}</text></g>;

  }
  const transform=o.skewX?`translate(${o.x||0} ${o.y||0}) translate(${w/2} ${h/2}) rotate(${o.rotation||0}) skewX(${o.skewX}) translate(${-w/2} ${-h/2})`:`translate(${o.x||0} ${o.y||0}) rotate(${o.rotation||0} ${w/2} ${h/2})`;
  return <g data-object-id={o.id} transform={transform} opacity={d.opacity??1} style={{display:o.hidden?'none':undefined,pointerEvents:interactive?'all':'none',cursor:interactive?(o.locked?'not-allowed':'move'):undefined}} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick}>{interactive&&o.type!=='drawing'&&<rect width={w} height={h} fill="transparent"/>}{content}</g>;
}
export function PaperArtwork({ paper={}, background, id='paper' }) {
  const [w,h]=paperSize(paper),type=paper.type||'blank',color=paper.color||'#ffffff';
  return <g><defs><pattern id={id+'-grid'} width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#b9b0cd" strokeWidth=".5"/></pattern><pattern id={id+'-ruled'} width="28" height="28" patternUnits="userSpaceOnUse"><line x1="0" y1="27" x2={w} y2="27" stroke="#b9b0cd" strokeWidth=".6"/></pattern><pattern id={id+'-dot'} width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r=".9" fill="#b5a8ca"/></pattern></defs><rect width={w} height={h} fill={color}/>{background&&<image href={background} width={w} height={h} preserveAspectRatio="none"/>}{type!=='blank'&&<rect width={w} height={h} fill={`url(#${id}-${['grid','math'].includes(type)?'grid':type==='dot'?'dot':'ruled'})`}/>} {type==='cornell'&&<g stroke="#ad9bc9" strokeWidth="1"><line x1="150" y1="0" x2="150" y2={h-170}/><line x1="0" y1={h-170} x2={w} y2={h-170}/></g>}</g>;
}
export function PageArtwork({ page, id='page' }) { const rows=page.objects.filter(o=>!o.hidden);return <><PaperArtwork paper={page.paper} background={page.background} id={id}/>{rows.map(o=><ObjectArtwork key={o.id} object={o}/>)}</>; }
export function pageToSvg(page) {
  const [w,h]=paperSize(page.paper);
  return renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width={w} height={h} viewBox={`0 0 ${w} ${h}`}><PageArtwork page={page}/></svg>);
}
export async function pageToImage(page, format='png', scale=1.5) {
  if(document.fonts?.ready)await document.fonts.ready;
  const [w,h]=paperSize(page.paper),svg=pageToSvg(page),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
  try {
    const img=new Image(); await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Không thể dựng hình trang.'));img.src=url;});
    const canvas=document.createElement('canvas'); canvas.width=w*scale;canvas.height=h*scale; const ctx=canvas.getContext('2d');ctx.fillStyle=page.paper.color||'#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    return canvas.toDataURL(format==='jpg'?'image/jpeg':'image/png',.92);
  } finally {URL.revokeObjectURL(url);}
}
export function regionToSvg(page,objects,scale=2){
  const visible=(objects||[]).filter(o=>!o.hidden),box=selectionBounds(visible);
  if(!box)throw new Error('Hãy chọn nội dung cần nhận dạng.');
  const strokePadding=Math.max(0,...visible.map(o=>(Number(o.data?.thickness)||0)/2)),margin=Math.max(20,strokePadding+4),bounds={x:box.x-margin,y:box.y-margin,width:Math.max(1,box.width)+margin*2,height:Math.max(1,box.height)+margin*2};
  const ratio=Math.min(Math.max(.1,Number(scale)||2),4096/bounds.width,4096/bounds.height),width=Math.max(1,Math.ceil(bounds.width*ratio)),height=Math.max(1,Math.ceil(bounds.height*ratio));
  // A custom viewBox is essential: A4 rendering clips handwriting outside the page.
  // Only selected artwork is rendered on white, so paper grids do not confuse OCR.
  const cleanPage={...page,paper:{...page?.paper,type:'blank',color:'#ffffff'},background:null,objects:visible};
  const svg=renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width={width} height={height} viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}><rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill="#ffffff"/><PageArtwork page={cleanPage} id="recognition-region"/></svg>);
  return {svg,bounds,width,height};
}
export async function regionToImage(page,objects,scale=2){
  if(document.fonts?.ready)await document.fonts.ready;
  const {svg,bounds,width,height}=regionToSvg(page,objects,scale),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
  try{
    const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Không thể dựng hình vùng nhận dạng.'));img.src=url;});
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Trình duyệt không hỗ trợ dựng ảnh nhận dạng.');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);ctx.drawImage(img,0,0,width,height);
    return {src:canvas.toDataURL('image/png'),bounds};
  }finally{URL.revokeObjectURL(url);}
}
export async function exportPages(book,pages,format='pdf') {
  if(!pages?.length) throw new Error('Hãy chọn ít nhất một trang.');
  const safe=String(book.title||'Vo-ghi').replace(/[<>:"/\\|?*]/g,'-');
  if(format==='pdf') {
    const {jsPDF}=await import('jspdf'),[w,h]=paperSize(pages[0].paper),pdf=new jsPDF({orientation:w>h?'landscape':'portrait',unit:'px',format:[w,h],hotfixes:['px_scaling']});
    for(let i=0;i<pages.length;i++){const [pw,ph]=paperSize(pages[i].paper);if(i)pdf.addPage([pw,ph],pw>ph?'landscape':'portrait');pdf.addImage(await pageToImage(pages[i]),'PNG',0,0,pw,ph);}
    pdf.save(safe+'.pdf');return;
  }
  for(const page of pages){const a=document.createElement('a');a.href=format==='svg'?'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(pageToSvg(page)):await pageToImage(page,format);a.download=`${safe}-${page.title||'trang'}.${format}`;a.click();}
}
let formulaEngine;
async function loadFormulaEngine(){
  if(!formulaEngine)formulaEngine=Promise.all([
    import('mathjax-full/js/mathjax.js'),import('mathjax-full/js/input/tex.js'),import('mathjax-full/js/output/svg.js'),import('mathjax-full/js/adaptors/liteAdaptor.js'),import('mathjax-full/js/handlers/html.js'),import('mathjax-full/js/input/tex/AllPackages.js'),
  ]).then(([{mathjax},{TeX},{SVG},{liteAdaptor},{RegisterHTMLHandler},{AllPackages}])=>{
    const adaptor=liteAdaptor();RegisterHTMLHandler(adaptor);const doc=mathjax.document('',{InputJax:new TeX({packages:AllPackages}),OutputJax:new SVG({fontCache:'none'})});return {adaptor,doc};
  }).catch(error=>{formulaEngine=null;throw error;});
  return formulaEngine;
}
export async function formulaToImage(latex,color='#343047',options={}) {
  // KaTeX validates the source; MathJax produces self-contained vector glyph paths.
  // No foreignObject or font download is needed when exporting a canvas to PNG/PDF.
  const {default:katex}=await import('katex');
  const inline=!!options.inline,fontSize=clamp(Number(options.fontSize)||(inline?22:30),8,160),padding=inline?4:16;
  katex.renderToString(latex,{throwOnError:true,displayMode:!inline,output:'mathml',trust:false});
  const {adaptor,doc}=await loadFormulaEngine(),node=doc.convert(latex,{display:!inline}),svg=adaptor.firstChild(node),viewBox=String(adaptor.getAttribute(svg,'viewBox')||'0 0 1000 1000').split(/\s+/).map(Number),naturalWidth=Math.max(inline?8:80,viewBox[2]/1000*fontSize),naturalHeight=Math.max(inline?fontSize:38,viewBox[3]/1000*fontSize),scale=Math.min(1,700/naturalWidth),width=Math.ceil(naturalWidth*scale+padding),height=Math.ceil(naturalHeight*scale+padding);
  adaptor.setAttribute(svg,'xmlns','http://www.w3.org/2000/svg');adaptor.setAttribute(svg,'width',String(width));adaptor.setAttribute(svg,'height',String(height));adaptor.setAttribute(svg,'style',`color:${color};`);
  const markup=adaptor.outerHTML(svg).replace(/currentColor/g,color);
  return {src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(markup),width,height};
}
