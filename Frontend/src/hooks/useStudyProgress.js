import { useCallback, useEffect, useState } from 'react';

export const studyStorageKey = owner => `ssh-study-v1:${encodeURIComponent(owner || 'device')}`;
export default function useStudyProgress(owner) {
  const key = studyStorageKey(owner);
  const [snapshot, setSnapshot] = useState({ key: '', records: {}, error: null });
  const read = useCallback(() => {
    try {
      const raw = localStorage.getItem(key), value = raw ? JSON.parse(raw) : { version: 1, records: {} };
      if (value.version !== 1 || !value.records || typeof value.records !== 'object' || Array.isArray(value.records)
        || Object.values(value.records).some(record => !record || typeof record !== 'object' || (record.note != null && typeof record.note !== 'string'))) throw new Error('Dữ liệu học tập trên thiết bị không đọc được. Hãy sao lưu bộ nhớ trước khi khôi phục.');
      setSnapshot({ key, records: value.records, error: null });
      return value.records;
    } catch { setSnapshot(previous => ({ ...previous, error: new Error('Dữ liệu học tập trên thiết bị không đọc được. Hãy sao lưu bộ nhớ trước khi khôi phục.') })); return null; }
  }, [key]);
  useEffect(() => {
    read();
    const listener = event => { if (!event.key || event.key === key) read(); };
    window.addEventListener('storage', listener);
    window.addEventListener('study-progress-changed', listener);
    return () => { window.removeEventListener('storage', listener); window.removeEventListener('study-progress-changed', listener); };
  }, [read, key]);
  const update = useCallback((slideKey, patch) => {
    const records = read();
    if (!records) return false;
    const next = { ...records, [slideKey]: { ...records[slideKey], ...patch } };
    try {
      localStorage.setItem(key, JSON.stringify({ version: 1, records: next }));
      setSnapshot({ key, records: next, error: null });
      window.dispatchEvent(new CustomEvent('study-progress-changed'));
      return true;
    } catch { setSnapshot(previous => ({ ...previous, error: new Error('Không lưu được trên thiết bị. Bộ nhớ có thể đã đầy hoặc bị chặn; hãy sao chép ghi chú trước khi đóng.') })); return false; }
  }, [key, read]);
  return { records: snapshot.key === key ? snapshot.records : {}, error: snapshot.error, update };
}
