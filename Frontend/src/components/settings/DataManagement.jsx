import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { ApiContent, Button, ErrorState, Field, Modal } from '../common/ui';

export default function DataManagement() {
  const bridge = globalThis.__uniStudyData;
  const state = useApi(async () => bridge ? bridge.catalog() : []);
  const [selected, setSelected] = useState([]), [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const all = selected.includes('all'), categories = Array.isArray(state.data) ? state.data : [];
  const toggle = id => setSelected(values => id === 'all' ? (values.includes('all') ? [] : ['all'])
    : values.includes(id) ? values.filter(value => value !== id) : [...values, id]);
  const labels = all ? ['Toàn bộ dữ liệu trên máy, bao gồm hồ sơ sinh viên']
    : categories.filter(item => selected.includes(item.id)).map(item => item.label);
  async function reset(event) {
    event.preventDefault();
    if (busy || confirmation !== 'XÓA') return;
    setBusy(true); setError(null);
    try { await bridge.reset({ categories: selected, confirmation }); }
    catch (error) { setError(error); setBusy(false); }
  }
  if (!bridge) return <p>Mở ứng dụng desktop để quản lý và xóa dữ liệu lưu trên máy.</p>;
  return <div className="stack data-management">
    <p>Chọn những loại dữ liệu muốn xóa. Thao tác áp dụng cho bản lưu trên máy này và ứng dụng sẽ khởi động lại.</p>
    <div className="data-reset-actions"><span>{all ? 'Đã chọn toàn bộ dữ liệu' : `Đã chọn ${selected.length} loại dữ liệu`}</span><Button variant="danger" disabled={!selected.length || state.loading || !!state.error || busy} onClick={() => { setConfirmation(''); setError(null); setConfirming(true); }}>
      <Trash2 size={15} />Xóa dữ liệu đã chọn
    </Button></div>
    <ApiContent state={state}>
      <label className="setting-row">
        <div><strong>Xóa toàn bộ dữ liệu</strong><p>Gồm hồ sơ, mọi loại dữ liệu bên dưới và phiên đăng nhập.</p></div>
        <input type="checkbox" checked={all} disabled={busy} onChange={() => toggle('all')} aria-label="Xóa toàn bộ dữ liệu" />
      </label>
      <fieldset disabled={all || busy} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend>Hoặc chọn từng loại dữ liệu</legend>
        {categories.map(item => <label key={item.id} className="setting-row">
          <div><strong>{item.label}</strong><p>{item.description}</p><small className="muted">{item.count} bản ghi; có thể kèm tệp hoặc bản nháp trên máy.</small></div>
          <input type="checkbox" disabled={all || busy} checked={all || selected.includes(item.id)} onChange={() => toggle(item.id)} aria-label={item.label} />
        </label>)}
      </fieldset>
    </ApiContent>
    <p className="hint">Nếu giữ phiên đăng nhập, dữ liệu trường có thể được tải lại khi đồng bộ. Chọn thêm “Phiên đăng nhập” để ngắt các nguồn.</p>
    <Modal isOpen={confirming} title="Xác nhận xóa dữ liệu" onClose={() => { if (!busy) setConfirming(false); }}>
      <form className="stack" onSubmit={reset}>
        <p>Các dữ liệu sau sẽ bị xóa khỏi máy này:</p>
        <ul>{labels.map(label => <li key={label}>{label}</li>)}</ul>
        <p>Hãy xuất hoặc sao lưu nội dung cần giữ trước khi tiếp tục. Ứng dụng khởi động lại để hoàn tất việc xóa.</p>
        <Field label="Nhập XÓA để xác nhận" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" disabled={busy} />
        {error && <ErrorState error={error} title="Chưa xóa được dữ liệu" />}
        {busy && <p role="status">Đang khởi động lại để xóa dữ liệu đã chọn…</p>}
        <div className="form-actions">
          <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Hủy</Button>
          <Button variant="danger" type="submit" disabled={busy || confirmation !== 'XÓA'}>Xóa & khởi động lại</Button>
        </div>
      </form>
    </Modal>
  </div>;
}
