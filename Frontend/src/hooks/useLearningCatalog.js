import { useEffect, useRef, useState } from 'react';
import { courseApi } from '../api';
import { responseList, unwrapResponse } from '../api/apiClient';

export const learningJobActive = job => ['running', 'queued', 'pending'].includes(String(job?.status).toLowerCase());
const terminal = job => ['completed', 'done', 'succeeded', 'partial', 'failed', 'error', 'unavailable'].includes(String(job?.status).toLowerCase());
const signature = data => JSON.stringify((data?.courses || []).map(c => [c.id, c.chapterCount, c.sourceCount, c.cardCount, c.complete, c.updatedAt, c.summary?.summaryHash, c.failures]));

// Read-only polling follows jobs started by this screen, another screen or the
// background IU/EDUX sync. It never starts a sync or calls AI on its own.
export function useLearningCatalog({ onChange, onSettled } = {}) {
  const [state, setState] = useState({ data: null, loading: true, error: null, refreshError: null });
  const [jobs, setJobs] = useState([]);
  const callbacks = useRef({ onChange, onSettled }); callbacks.current = { onChange, onSettled };
  const tracked = useRef(new Map()), currentData = useRef(null), mounted = useRef(false), version = useRef(0), wake = useRef(null);
  const publish = () => { if (mounted.current) setJobs([...tracked.current.values()]); };
  function merge(value, metadata = {}) {
    const id = value?.jobId || value?.id;
    if (!id) return;
    const previous = tracked.current.get(id);
    const { result, ...snapshot } = value;
    const job = { ...previous, ...metadata, ...snapshot, jobId: id, status: value.status || previous?.status || 'queued' };
    if (terminal(previous) && learningJobActive(job)) return;
    tracked.current.set(id, job);
    if (previous && learningJobActive(previous) && terminal(job)) callbacks.current.onSettled?.(job);
    // Keep active entries plus a small recent history while this page is open.
    const finished = [...tracked.current.values()].filter(j => !learningJobActive(j));
    for (const old of finished.slice(0, Math.max(0, finished.length - 6))) tracked.current.delete(old.jobId);
  }
  async function refresh() {
    const request = ++version.current;
    try {
      const payload = unwrapResponse(await courseApi.list());
      if (!payload || typeof payload !== 'object') throw new Error('Máy chủ chưa trả danh sách học liệu hợp lệ.');
      const data = { ...payload, courses: responseList(payload, 'courses') };
      if (!mounted.current || request !== version.current) return data;
      const changed = currentData.current && signature(currentData.current) !== signature(data);
      currentData.current = data;
      for (const job of data.jobs || []) merge(job);
      setState({ data, loading: false, error: null, refreshError: null }); publish();
      if (changed) callbacks.current.onChange?.(data);
      return data;
    } catch (error) {
      if (mounted.current && request === version.current) setState(s => ({ ...s, loading: false,
        error: s.data ? null : error, refreshError: s.data ? error : null }));
    }
  }
  useEffect(() => {
    mounted.current = true;
    let canceled = false, timer, polling = false, again = false;
    async function poll() {
      if (polling) { again = true; return; }
      polling = true;
      try {
        await refresh();
        if (canceled) return;
        const active = [...tracked.current.values()].filter(learningJobActive);
        const results = await Promise.allSettled(active.map(j => courseApi.getJob(j.jobId)));
        if (canceled) return;
        let changed = false;
        results.forEach((result, index) => {
          const before = active[index];
          if (result.status === 'fulfilled') {
            const value = unwrapResponse(result.value);
            if (!value?.status) return;
            changed ||= terminal(value) || Boolean(value.materialsUpdatedAt && value.materialsUpdatedAt !== before.materialsUpdatedAt);
            merge({ ...value, jobId: before.jobId });
          } else if (result.reason.response?.status === 404) {
            merge({ jobId: before.jobId, status: 'unavailable', message: 'Tiến trình không còn trên máy chủ. Dữ liệu đã lưu vẫn được giữ; hãy kiểm tra lại môn học.' });
          } else {
            setState(s => ({ ...s, refreshError: result.reason }));
          }
        });
        publish();
        if (changed) await refresh();
      } finally {
        polling = false;
        if (!canceled) {
          const active = [...tracked.current.values()].some(learningJobActive);
          timer = setTimeout(poll, again ? 0 : active ? 1500 : 8000); again = false;
        }
      }
    }
    wake.current = () => { clearTimeout(timer); void poll(); };
    const resume = () => wake.current?.();
    window.addEventListener('focus', resume); window.addEventListener('workspace-updated', resume);
    void poll();
    return () => { canceled = true; mounted.current = false; version.current++; clearTimeout(timer); wake.current = null;
      window.removeEventListener('focus', resume); window.removeEventListener('workspace-updated', resume); };
  }, []);
  return { ...state, jobs, execute: refresh, refetch: refresh,
    watch: (job, metadata) => { merge(job, metadata); publish(); wake.current?.(); } };
}
