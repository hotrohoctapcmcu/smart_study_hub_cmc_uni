const radians = degrees => degrees * Math.PI / 180;
export function rotateObjects(objects,ids,degrees,pivot){
  const selected=new Set(ids),angle=radians(degrees),c=Math.cos(angle),s=Math.sin(angle);
  return objects.map(object=>{if(!selected.has(object.id)||object.locked)return object;const width=object.width||100,height=object.height||40,dx=object.x+width/2-pivot.x,dy=object.y+height/2-pivot.y;return {...object,x:pivot.x+dx*c-dy*s-width/2,y:pivot.y+dx*s+dy*c-height/2,rotation:(object.rotation||0)+degrees};});
}
export function localToWorld(point, object) {
  const cx=(object.width||0)/2,cy=(object.height||0)/2,a=radians(object.rotation||0),dy=point.y-cy,dx=point.x-cx+dy*Math.tan(radians(object.skewX||0));
  return {...point,x:(object.x||0)+cx+dx*Math.cos(a)-dy*Math.sin(a),y:(object.y||0)+cy+dx*Math.sin(a)+dy*Math.cos(a)};
}
export function worldToLocal(point, object) {
  const cx=(object.width||0)/2,cy=(object.height||0)/2,a=-radians(object.rotation||0),dx=point.x-(object.x||0)-cx,dy=point.y-(object.y||0)-cy;
  const localY=dx*Math.sin(a)+dy*Math.cos(a);
  return {...point,x:cx+dx*Math.cos(a)-dy*Math.sin(a)-localY*Math.tan(radians(object.skewX||0)),y:cy+localY};
}
export function projectToSegment(point,a,b,clamped=true){
  const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy,t=len?((point.x-a.x)*dx+(point.y-a.y)*dy)/len:0,u=clamped?Math.max(0,Math.min(1,t)):t;
  const projected={...point,x:a.x+u*dx,y:a.y+u*dy};
  return {point:projected,distance:Math.hypot(point.x-projected.x,point.y-projected.y),t};
}
export function rulerEdges(object){
  if(object.hidden)return [];
  const w=object.width||100,h=object.height||40;
  let edges=[];
  if(object.type==='ruler')edges=[[{x:0,y:0},{x:w,y:0}],[{x:0,y:h},{x:w,y:h}]];
  if(['triangle-ruler','set-square'].includes(object.type))edges=[[{x:0,y:0},{x:0,y:h}],[{x:0,y:h},{x:w,y:h}],[{x:w,y:h},{x:0,y:0}]];
  if(object.type==='protractor')edges=[[{x:0,y:h},{x:w,y:h}]];
  return edges.map(([a,b],index)=>({a:localToWorld(a,object),b:localToWorld(b,object),objectId:object.id,index}));
}
export function snapToRulers(point,objects,threshold=18,constraint=null){
  const edges=objects.flatMap(rulerEdges),preferred=constraint&&edges.find(e=>e.objectId===constraint.objectId&&e.index===constraint.index);
  if(preferred){
    const object=objects.find(o=>o.id===preferred.objectId),local=worldToLocal(point,object),inside=object.type==='ruler'&&local.x>=0&&local.x<=object.width&&local.y>=0&&local.y<=object.height;
    // Keep the captured edge while crossing the ruler body; switching edges
    // mid-stroke creates a diagonal segment straight through the ruler.
    if(inside)return {point:projectToSegment(point,preferred.a,preferred.b).point,edge:preferred};
  }
  const candidates=preferred?[preferred,...edges.filter(e=>e!==preferred)]:edges;
  let result={point,edge:null},distance=threshold;
  for(const edge of candidates){const p=projectToSegment(point,edge.a,edge.b);if(p.distance<=distance){result={point:p.point,edge};distance=p.distance;if(edge===preferred)break;}}
  if(!result.edge){
    // A pen inside a translucent ruler must remain on its nearest edge, never draw through its body.
    const inside=objects.find(o=>o.type==='ruler'&&!o.hidden&&(()=>{const p=worldToLocal(point,o);return p.x>=0&&p.x<=o.width&&p.y>=0&&p.y<=o.height;})());
    if(inside){for(const edge of rulerEdges(inside)){const p=projectToSegment(point,edge.a,edge.b);if(!result.edge||p.distance<distance){result={point:p.point,edge};distance=p.distance;}}}
  }
  return result;
}
export function snapToProtractor(point,objects,threshold=18,constraint=null){
  if(constraint?.kind==='protractor'){
    const object=objects.find(o=>o.id===constraint.objectId&&!o.hidden);
    if(object){const p=worldToLocal(point,object),center={x:object.width/2,y:object.height},angle=constraint.angle*Math.PI/180,axis={x:center.x+Math.cos(angle),y:center.y+Math.sin(angle)},result=projectToSegment(p,center,axis,false);return {point:localToWorld(result.point,object),edge:constraint};}
  }
  for(const object of objects){
    if(object.type!=='protractor'||object.hidden)continue;
    const p=worldToLocal(point,object),cx=object.width/2,cy=object.height;
    if(Math.hypot(p.x-cx,p.y-cy)>threshold)continue;
    const angle=-(object.data?.markerAngle??45),edge={kind:'protractor',objectId:object.id,angle};
    const result=projectToSegment(p,{x:cx,y:cy},{x:cx+Math.cos(radians(angle)),y:cy+Math.sin(radians(angle))},false);
    return {point:localToWorld(result.point,object),edge};
  }
  return {point,edge:null};
}
export function hitObject(point,object,tolerance=4){
  const p=worldToLocal(point,object);
  if(object.type==='drawing'){
    const pts=object.data?.points||[],radius=tolerance+(object.data?.thickness||3)/2;
    if(pts.length===1){const q=localToWorld(pts[0],object);return Math.hypot(point.x-q.x,point.y-q.y)<=radius;}
    return pts.slice(1).some((b,i)=>projectToSegment(point,localToWorld(pts[i],object),localToWorld(b,object)).distance<=radius);
  }
  return p.x>=-tolerance&&p.y>=-tolerance&&p.x<=(object.width||100)+tolerance&&p.y<=(object.height||40)+tolerance;
}
export function eraseStroke(object,center,radius){
  if(object.type!=='drawing'||object.locked||object.hidden)return [object];
  const pts=object.data?.points||[],p=center,r=radius+(object.data.thickness||3)/2;
  if(!pts.length)return [object];
  const outside=q=>{const world=localToWorld(q,object);return Math.hypot(world.x-p.x,world.y-p.y)>r;};
  if(pts.length===1)return outside(pts[0])?[object]:[];
  const fragments=[];let part=[],changed=false;
  const flush=()=>{if(part.length)fragments.push(part);part=[];};
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i],b=pts[i+1],dx=b.x-a.x,dy=b.y-a.y,wa=localToWorld(a,object),wb=localToWorld(b,object),wx=wb.x-wa.x,wy=wb.y-wa.y,qa=wx*wx+wy*wy,qb=2*((wa.x-p.x)*wx+(wa.y-p.y)*wy),qc=(wa.x-p.x)**2+(wa.y-p.y)**2-r*r,disc=qb*qb-4*qa*qc;
    const cuts=[0,1];if(qa&&disc>=0){const root=Math.sqrt(disc);for(const t of [(-qb-root)/(2*qa),(-qb+root)/(2*qa)])if(t>0&&t<1)cuts.push(t);}cuts.sort((x,y)=>x-y);
    const at=t=>({...a,x:a.x+t*dx,y:a.y+t*dy,pressure:(a.pressure??.5)+t*((b.pressure??.5)-(a.pressure??.5))});
    for(let j=0;j<cuts.length-1;j++){const from=cuts[j],to=cuts[j+1];if(outside(at((from+to)/2))){if(!part.length)part.push(at(from));part.push(at(to));}else{changed=true;flush();}}
  }flush();
  if(!changed)return [object];
  return fragments.map((points,index)=>({...object,id:`${object.id}-erase-${globalThis.crypto?.randomUUID?.()||Date.now()+'-'+index}`,data:{...object.data,points}}));
}
export function recognizeShape(object){
  const pts=object.data?.points||[];if(pts.length<3)return null;
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
  if(Math.hypot(w,h)<12)return null;
  const first=pts[0],last=pts.at(-1),closed=Math.hypot(first.x-last.x,first.y-last.y)<Math.max(w,h)*.3;
  let shape=null;
  if(!closed&&pts.every(p=>projectToSegment(p,first,last).distance<Math.max(5,Math.hypot(w,h)*.05)))shape='line';
  if(closed){const ellipseError=pts.reduce((sum,p)=>sum+Math.abs(Math.hypot((p.x-x-w/2)/(w/2||1),(p.y-y-h/2)/(h/2||1))-1),0)/pts.length;
    const edgeError=pts.reduce((sum,p)=>sum+Math.min(p.x-x,x+w-p.x,p.y-y,y+h-p.y),0)/pts.length;
    if(ellipseError<.2)shape=Math.abs(w-h)/Math.max(w,h)<.18?'circle':'ellipse';else if(edgeError<Math.min(w,h)*.13)shape='rectangle';
    if(!shape){const a={x:x+w/2,y},b={x:x+w,y:y+h},c={x,y:y+h},error=pts.reduce((sum,p)=>sum+Math.min(projectToSegment(p,a,b).distance,projectToSegment(p,b,c).distance,projectToSegment(p,c,a).distance),0)/pts.length;if(error<Math.min(w,h)*.11)shape='triangle';}
  }
  return shape?{type:'shape',x:(object.x||0)+x,y:(object.y||0)+y,width:Math.max(w,1),height:Math.max(h,1),rotation:object.rotation||0,data:{...object.data,points:undefined,shape,fill:'none',flipX:first.x>last.x,flipY:first.y>last.y}}:null;
}
