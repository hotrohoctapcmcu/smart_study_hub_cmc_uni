import { useRef, useState } from 'react';
import { Upload, ImagePlus, Link as LinkIcon, Paperclip } from 'lucide-react';
import apiClient, { unwrapResponse } from '../../../api/apiClient';
import { documentApi } from '../../../api';
import { Modal, Field, Button, ErrorState } from '../../../components/common/ui';
import { imageFileToDataURL } from './blockExtensions';

export const readNotebookImage = imageFileToDataURL;
export default function AssetDialog({ kind, subject, initial, onClose, onInsert }) {
  const [url, setUrl] = useState(initial?.href || ''), [label, setLabel] = useState(''), [file, setFile] = useState(null), [error, setError] = useState(null), [busy, setBusy] = useState(false);
  const fileRef = useRef();
  const isLink = kind === 'link', isFile = kind === 'file', Icon = isLink ? LinkIcon : isFile ? Paperclip : ImagePlus;
  async function submit(event) {
    event.preventDefault(); if (busy) return; setError(null); setBusy(true);
    try {
      if (isFile) {
        if (!file) throw new Error('Chọn tệp cần đính kèm.');
        const doc = unwrapResponse(await documentApi.upload(file, { filename: file.name, title: label.trim() || file.name, subject: subject || 'Ghi chép tự học', category: 'Tài liệu tham khảo' }));
        onInsert({ type: 'attachment', attrs: { name: label.trim() || file.name, href: `${apiClient.defaults.baseURL.replace(/\/$/, '')}/documents/${encodeURIComponent(doc.id ?? doc.document_id)}/file` } });
      } else if (file && !isLink) onInsert({ type: 'image', attrs: { src: await readNotebookImage(file), caption: label.trim(), alt: label.trim() || file.name, width: '100%', align: 'center' } });
      else {
        const parsed = new URL(url.trim()); if (!['https:', 'http:', ...(isLink ? ['mailto:'] : [])].includes(parsed.protocol)) throw new Error('URL phải bắt đầu bằng https:// hoặc http://.');
        onInsert(isLink ? { href: parsed.href, label: label.trim() } : { type: 'image', attrs: { src: parsed.href, alt: label.trim(), caption: label.trim(), width: '100%', align: 'center' } });
      }
    } catch (cause) { setError(cause); }
    finally { setBusy(false); }
  }
  return <Modal isOpen title={isLink ? 'Chèn liên kết' : isFile ? 'Đính kèm tệp' : 'Chèn ảnh'} onClose={onClose}><form onSubmit={submit} className="nw-asset-form">{!isLink && <><input ref={fileRef} type="file" accept={isFile ? '.pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg' : 'image/png,image/jpeg,image/gif,image/webp'} aria-label={isFile ? 'Chọn tệp đính kèm' : 'Chọn ảnh tải lên'} onChange={event => { setFile(event.target.files[0] || null); setError(null); }} /><button type="button" className="nw-upload-area" onClick={() => fileRef.current.click()}><Upload size={25} /><strong>{file?.name || (isFile ? 'Chọn tệp từ máy tính' : 'Tải ảnh từ máy tính')}</strong><small>{isFile ? 'PDF, DOCX, PPTX, TXT, MD, PNG, JPG · tối đa 25 MB' : 'PNG, JPG, GIF, WebP · hỗ trợ cả kéo thả và Ctrl+V trong editor'}</small></button></>}{!isFile && <Field label={isLink ? 'Địa chỉ liên kết' : 'Hoặc URL ảnh'}><input type="url" placeholder="https://…" value={url} onChange={event => { setUrl(event.target.value); if (file) setFile(null); }} required={!file} /></Field>}<Field label={isLink ? 'Văn bản hiển thị (tùy chọn)' : 'Chú thích / tên tệp'}><input value={label} onChange={event => setLabel(event.target.value)} /></Field>{error && <ErrorState error={error} />}<div className="form-actions"><Button variant="outline" onClick={onClose}>Hủy</Button><Button type="submit" disabled={busy || (!file && !url.trim())}><Icon size={15} />{busy ? 'Đang xử lý…' : 'Chèn vào trang'}</Button></div></form></Modal>;
}
