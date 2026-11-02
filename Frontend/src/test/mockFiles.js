// Tiny uncompressed ZIP writer for valid DOCX fixtures (no production dependency).
const encoder=new TextEncoder();
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function zip(entries,mime){
 const locals=[],central=[];let offset=0,centralSize=0;
 for(const [name,text] of Object.entries(entries)){
  const filename=encoder.encode(name),data=encoder.encode(text),crc=crc32(data);
  const header=new Uint8Array(30+filename.length),view=new DataView(header.buffer);
  view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x0800,true);view.setUint32(14,crc,true);view.setUint32(18,data.length,true);view.setUint32(22,data.length,true);view.setUint16(26,filename.length,true);header.set(filename,30);
  locals.push(header,data);
  const record=new Uint8Array(46+filename.length),cv=new DataView(record.buffer);
  cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,filename.length,true);cv.setUint32(42,offset,true);record.set(filename,46);
  central.push(record);centralSize+=record.length;offset+=header.length+data.length;
 }
 const end=new Uint8Array(22),ev=new DataView(end.buffer),count=central.length;
 ev.setUint32(0,0x06054b50,true);ev.setUint16(8,count,true);ev.setUint16(10,count,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);
 return new Blob([...locals,...central,end],{type:mime});
}
const xml=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function mockDocx(title,content){
 const paragraphs=[title,...String(content||'').split('\n')].map(line=>'<w:p><w:r><w:t xml:space="preserve">'+xml(line)+'</w:t></w:r></w:p>').join('');
 return zip({
 '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
 '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
 'word/document.xml':'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paragraphs+'<w:sectPr/></w:body></w:document>',
 },'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
export function mockPdf(){
 const stream='BT /F1 18 Tf 50 760 Td (Smart Study Hub - Sample document) Tj 0 -30 Td /F1 12 Tf (Upload your own file or connect the backend for real content.) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'];
 let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((obj,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+obj+'\nendobj\n';});const xref=pdf.length;
 pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
 return new Blob([pdf],{type:'application/pdf'});
}
