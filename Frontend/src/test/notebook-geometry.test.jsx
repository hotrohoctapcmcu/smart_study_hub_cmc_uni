import { describe, it, expect } from 'vitest';
import { localToWorld, worldToLocal, rulerEdges, snapToRulers, snapToProtractor, hitObject, eraseStroke, recognizeShape } from '../utils/notebookGeometry';
import { objectBounds, pageToSvg, regionToSvg, tableLayout, textLines, textContentHeight, scaleObject } from '../utils/textbookCanvas';

const ruler={id:'r',type:'ruler',x:100,y:100,width:400,height:60,rotation:0};
describe('Notebook geometry constraints',()=>{
  it('projects pen points to the actual rotated edge and releases outside its snap region',()=>{
    for(const rotation of [0,45,90,-30]){
      const object={...ruler,rotation},near=localToWorld({x:135,y:-8,pressure:.7},object),result=snapToRulers(near,[object]);
      expect(worldToLocal(result.point,object).y).toBeCloseTo(0,8);
      expect(result.point.pressure).toBe(.7);
      expect(result.edge.objectId).toBe('r');
      expect(snapToRulers(localToWorld({x:135,y:-80},object),[object],18,result.edge).edge).toBeNull();
    }
  });
  it('prevents drawing through the body of a ruler and supports all set-square edges',()=>{
    expect(snapToRulers({x:200,y:130},[ruler],8).edge).not.toBeNull();
    const triangle={...ruler,type:'triangle-ruler',height:200,rotation:45};
    expect(rulerEdges(triangle)).toHaveLength(3);
    const result=snapToRulers(localToWorld({x:200,y:100},triangle),[triangle]);
    expect(result.edge.index).toBe(2);
  });
  it('never snaps to a hidden ruler',()=>expect(snapToRulers({x:200,y:103},[{...ruler,hidden:true}]).edge).toBeNull());
  it('keeps the captured ruler edge through its body and releases beyond the snap threshold',()=>{
    for(const rotation of [0,45,90]){
      const object={...ruler,rotation},start=snapToRulers(localToWorld({x:100,y:-3},object),[object]);
      const across=snapToRulers(localToWorld({x:180,y:55},object),[object],18,start.edge);
      expect(across.edge.index).toBe(0);expect(worldToLocal(across.point,object).y).toBeCloseTo(0);
      expect(snapToRulers(localToWorld({x:180,y:90},object),[object],18,across.edge).edge).toBeNull();
    }
  });
  it('constrains a ray from a rotated protractor center to its marker angle',()=>{
    const object={...ruler,type:'protractor',rotation:30,height:200,data:{markerAngle:60}},center=localToWorld({x:200,y:200},object),start=snapToProtractor(center,[object]);
    expect(start.edge.kind).toBe('protractor');
    const result=snapToProtractor(localToWorld({x:280,y:130},object),[object],18,start.edge),local=worldToLocal(result.point,object);
    expect(Math.atan2(local.y-200,local.x-200)*180/Math.PI).toBeCloseTo(-60);
  });
  it('erases inside sparse segments and preserves both remaining pieces on a rotated drawing',()=>{
    const object={id:'ink',type:'drawing',x:20,y:30,width:100,height:1,rotation:45,data:{thickness:2,points:[{x:0,y:0,pressure:.2},{x:100,y:0,pressure:.8}]}};
    const center=localToWorld({x:50,y:0},object),parts=eraseStroke(object,center,10);
    expect(parts).toHaveLength(2);
    expect(parts[0].data.points.at(-1).x).toBeCloseTo(39);
    expect(parts[1].data.points[0].x).toBeCloseTo(61);
    expect(parts[0].data.points.at(-1).pressure).toBeCloseTo(.434);
    expect(eraseStroke({...object,locked:true},center,10)).toEqual([{...object,locked:true}]);
    expect(hitObject(center,object)).toBe(true);
    expect(hitObject(localToWorld({x:50,y:40},object),object)).toBe(false);
  });
  it('includes rotation in selection bounds',()=>{
    const bounds=objectBounds({...ruler,rotation:90});
    expect(bounds.width).toBeCloseTo(60);
    expect(bounds.height).toBeCloseTo(400);
  });
  it('resizes rotated objects exactly in world coordinates, including successive nonuniform resizes',()=>{
    for(const rotation of [30,45,90,-45]){
      let object={...ruler,rotation};
      for(const [sx,sy] of [[2,1],[.7,1.5]]){
        const before=objectBounds(object),next=scaleObject(object,before,sx,sy),after=objectBounds(next);
        expect(after.x).toBeCloseTo(before.x);expect(after.y).toBeCloseTo(before.y);
        expect(after.width).toBeCloseTo(before.width*sx);expect(after.height).toBeCloseTo(before.height*sy);
        const local={x:next.width*.4,y:next.height*.7};
        expect(worldToLocal(localToWorld(local,next),next).x).toBeCloseTo(local.x);
        expect(worldToLocal(localToWorld(local,next),next).y).toBeCloseTo(local.y);
        object=next;
      }
    }
  });
  it('offers a clean line only for a recognized stroke',()=>{
    const line={x:10,y:10,data:{points:[{x:0,y:0},{x:30,y:1},{x:90,y:0}]}};
    expect(recognizeShape(line).data.shape).toBe('line');
    expect(recognizeShape({data:{points:[{x:0,y:0},{x:30,y:70},{x:90,y:0}]}})).toBeNull();
  });
});
describe('Notebook SVG rendering',()=>{
  it('renders independent text backgrounds and per-line highlights with alignment and lists',()=>{
    for(const align of ['left','center','right','justify']){
      const object={...ruler,type:'text',width:180,height:240,data:{text:'Ghi chú tiếng Việt và nội dung cần ôn',fontSize:20,list:'bullet',align,background:'#e0edf9',highlight:'#fff078'}},svg=pageToSvg({paper:{size:'A4'},objects:[object]}),doc=new DOMParser().parseFromString(svg,'image/svg+xml'),group=doc.querySelector('[data-object-id="r"]'),highlights=group.querySelectorAll('[data-text-highlight]');
      expect(group.querySelector('rect[fill="#e0edf9"]')).toBeTruthy();expect(highlights.length).toBeGreaterThan(1);
      expect(highlights.length).toBe(group.querySelectorAll('tspan').length);
      highlights.forEach(rect=>{expect(rect.getAttribute('fill')).toBe('#fff078');expect(+rect.getAttribute('height')).toBeCloseTo(23);expect(+rect.getAttribute('x')).toBeGreaterThanOrEqual(0);expect(+rect.getAttribute('width')).toBeLessThanOrEqual(180);});
    }
  });
  it('renders OCR selection outside A4 with rotated bounds and uniform pixel limits',()=>{
    const object={...ruler,id:'far',type:'text',x:2400,y:-200,width:5000,height:200,rotation:30,data:{text:'Vùng ghi chú ngoài trang'}},box=objectBounds(object),region=regionToSvg({paper:{size:'A4',type:'grid'},objects:[object]},[object]);
    expect(region.bounds.x).toBeCloseTo(box.x-20);expect(region.bounds.y).toBeCloseTo(box.y-20);
    expect(region.bounds.width).toBeCloseTo(box.width+40);expect(region.bounds.height).toBeCloseTo(box.height+40);
    expect(Math.max(region.width,region.height)).toBeLessThanOrEqual(4096);
    expect(region.width/region.height).toBeCloseTo(region.bounds.width/region.bounds.height,2);
    expect(region.svg).toContain(`viewBox="${region.bounds.x} ${region.bounds.y} ${region.bounds.width} ${region.bounds.height}"`);
    expect(region.svg).toContain('Vùng');expect(region.svg).not.toContain('url(#recognition-region-grid)');
  });
  it('wraps Vietnamese text, honors list modes and proportional table dimensions',()=>{
    const lines=textLines('Ghi chú tiếng Việt cho bài học',{fontSize:20,list:'check'},100);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].text.startsWith('☐ ')).toBe(true);
    const layout=tableLayout({rows:2,cols:2,columnWidths:[1,3],rowHeights:[2,1]},400,90);
    expect(layout.widths).toEqual([100,300]);expect(layout.heights).toEqual([60,30]);
    expect(textContentHeight('Ghi chú tiếng Việt cho bài học',{fontSize:20,lineHeight:1.5},100)).toBeGreaterThan(60);
  });
  it('exports pressure-sensitive segments at different widths and every wrapped text line',()=>{
    const text='Sinh viên ghi bài bằng tiếng Việt trên lớp và ôn lại kiến thức',data={text,fontSize:20,lineHeight:1.5,paragraphSpacing:10},width=180,height=textContentHeight(text,data,width);
    const objects=[{id:'ink',type:'drawing',x:0,y:0,width:100,height:10,data:{penType:'fountain',thickness:4,points:[{x:0,y:0,pressure:.1},{x:40,y:5,pressure:.2},{x:100,y:10,pressure:.9}]}},{id:'text',type:'text',x:10,y:30,width,height,data}];
    const svg=pageToSvg({paper:{size:'A4'},objects});
    expect(svg).toContain('stroke-width="2.18"');expect(svg).toContain('stroke-width="4.26"');
    const lines=textLines(text,data,width);expect((svg.match(/<tspan/g)||[])).toHaveLength(lines.length);
    expect(height).toBeGreaterThan(20+(lines.length-1)*30);
  });
  it('exports study aids, attachments, typography, and clipped image crops without foreignObject',()=>{
    const objects=[{...ruler,type:'triangle-ruler'}, {...ruler,id:'grid',type:'coordinate-grid'}, {...ruler,id:'number',type:'number-line'}, {...ruler,id:'file',type:'file',data:{name:'Bài tập.pdf',size:2048}}, {...ruler,id:'text',type:'text',data:{text:'Tiếng Việt',font:'Be Vietnam Pro',strike:true,variant:'sticky',letterSpacing:1}}, {...ruler,id:'image',type:'image',data:{src:'data:image/png;base64,AAAA',crop:{x:10,y:20,width:60,height:50},flipX:true}}];
    const svg=pageToSvg({paper:{size:'A4'},objects});
    expect(svg).toContain('Be Vietnam Pro');expect(svg).toContain('line-through');expect(svg).toContain('Bài tập.pdf');expect(svg).toContain('viewBox="10 20 60 50"');expect(svg).toContain('scale(-1 1)');expect(svg).not.toContain('foreignObject');
  });
});
