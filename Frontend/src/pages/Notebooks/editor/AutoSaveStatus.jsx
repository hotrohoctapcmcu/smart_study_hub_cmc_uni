import { Check, CloudOff, LoaderCircle, AlertCircle } from 'lucide-react';
export default function AutoSaveStatus({ state, storageError, error, onRetry }) {
  const status = storageError ? 'error' : state;
  const Icon = status === 'saving' ? LoaderCircle : status === 'offline' ? CloudOff : status === 'error' ? AlertCircle : Check;
  return <div className={`nw-save-state ${status || 'saved'}`} role="status" title={storageError?.message || error?.message || String(storageError || '')}><Icon size={14} /><span>{status === 'saving' ? 'Đang lưu…' : status === 'offline' ? 'Chưa đồng bộ' : status === 'error' ? 'Chưa đồng bộ · Cần kiểm tra' : 'Đã lưu'}</span>{['error', 'offline'].includes(status) && <button onClick={onRetry}>Thử lại</button>}</div>;
}
