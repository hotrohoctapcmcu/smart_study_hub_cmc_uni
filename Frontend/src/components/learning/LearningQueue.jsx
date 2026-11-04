import { useId, useState } from 'react';
import { AlertCircle, Check, ChevronDown, ChevronUp, ListOrdered, LoaderCircle, RefreshCw } from 'lucide-react';
import { Button } from '../common/ui';
import { learningJobActive } from '../../hooks/useLearningCatalog';
import './LearningQueue.css';

const needsAttention = job => ['partial', 'failed', 'error', 'unavailable'].includes(String(job.status).toLowerCase());

function partProgress(job) {
  if (String(job.status).toLowerCase() !== 'running') return '';
  if (job.phase === 'cards' && Number.isInteger(job.completedBatches) && job.totalBatches > 0) return `Flashcard · ${job.completedBatches}/${job.totalBatches} lô đã lưu`;
  if (job.summaryStage === 'merge') return 'Đang tổng hợp bản tóm tắt';
  if (job.totalParts > 0 && Number.isInteger(job.completedParts)) return `${job.completedParts}/${job.totalParts} phần đã lưu${Number.isInteger(job.activeWorkers) ? ` · ${job.activeWorkers} lượt AI đang chạy` : ''}`;
  return '';
}

function QueueItem({ job, showDetails }) {
  const status = String(job.status).toLowerCase();
  const waiting = ['queued', 'pending'].includes(status), running = status === 'running', attention = needsAttention(job);
  const label = waiting ? `Chờ lượt ${job.queuePosition || ''}`.trim() : running ? 'Đang xử lý' : status === 'partial' ? 'Chưa đầy đủ' : attention ? 'Cần kiểm tra' : 'Hoàn tất';
  const kind = job.kind === 'summary' ? 'Tóm tắt AI' : 'Đồng bộ slide';
  const subject = job.currentSubject || job.subject || 'Học liệu';
  const concise = partProgress(job);
  const message = showDetails || attention ? job.message || job.error : concise || (!waiting ? job.message : '');
  return <li className={`learning-queue__item${running ? ' learning-queue__item--running' : ''}${attention ? ' learning-queue__item--attention' : ''}`} aria-label={`${label} · ${kind} · ${subject}`}>
    <span className="learning-queue__marker" aria-hidden="true">
      {running ? <LoaderCircle size={16} className="learning-queue__spinner" /> : waiting ? job.queuePosition || '·' : attention ? <AlertCircle size={16} /> : <Check size={16} />}
    </span>
    <div className="learning-queue__item-body">
      <div className="learning-queue__item-title"><strong>{subject}</strong><span className="learning-queue__kind">{kind}</span></div>
      {message && <p className={`learning-queue__message${showDetails || attention ? ' learning-queue__message--full' : ''}`} title={job.message}>{message}</p>}
    </div>
    <span className="learning-queue__status">{label}</span>
  </li>;
}

export default function LearningQueue({ queue }) {
  const [collapsed, setCollapsed] = useState(false), [showDetails, setShowDetails] = useState(false);
  const bodyId = useId();
  if (!queue.jobs.length && !queue.refreshError) return null;
  const active = queue.jobs.filter(learningJobActive).sort((a, b) => (a.queuePosition || 1) - (b.queuePosition || 1));
  const finished = queue.jobs.filter(job => !learningJobActive(job)).slice(-3).reverse();
  const attentionCount = finished.filter(needsAttention).length;
  return <section className="learning-queue" aria-label="Hàng đợi học liệu">
    <div className="learning-queue__header">
      <div className="learning-queue__heading"><ListOrdered size={17} aria-hidden="true" /><h2>Hàng đợi học liệu</h2>{active.length > 0 && <span className="learning-queue__count">{active.length} yêu cầu</span>}</div>
      <div className="learning-queue__actions">
        <Button size="sm" variant="ghost" className="learning-queue__refresh" aria-label="Làm mới tiến trình" onClick={queue.refetch}><RefreshCw size={14} aria-hidden="true" /><span>Làm mới</span></Button>
        <Button size="sm" variant="ghost" aria-label={collapsed ? 'Mở rộng hàng đợi' : 'Thu gọn hàng đợi'} aria-expanded={!collapsed} aria-controls={bodyId} onClick={() => setCollapsed(value => !value)}>{collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</Button>
      </div>
    </div>
    <div id={bodyId} hidden={collapsed}>
      {active.length > 0 && <ol className="learning-queue__list" aria-label="Yêu cầu đang xử lý và chờ">{active.map(job => <QueueItem key={job.jobId} job={job} showDetails={showDetails} />)}</ol>}
      {finished.length > 0 && <details className="learning-queue__history" open={attentionCount > 0}>
        <summary><ChevronDown size={13} aria-hidden="true" />Gần đây <span>{finished.length}</span>{attentionCount > 0 && <span className="learning-queue__attention-count">{attentionCount} cần kiểm tra</span>}</summary>
        <ol className="learning-queue__list" aria-label="Yêu cầu gần đây">{finished.map(job => <QueueItem key={job.jobId} job={job} showDetails={showDetails} />)}</ol>
      </details>}
      <div className="learning-queue__footer"><p>AI chỉ chạy khi bạn yêu cầu.</p><button type="button" aria-pressed={showDetails} onClick={() => setShowDetails(value => !value)}>{showDetails ? 'Ẩn chi tiết' : 'Xem chi tiết'}</button></div>
    </div>
    {queue.refreshError && <div className="learning-queue__error" role="alert"><AlertCircle size={16} aria-hidden="true" /><p>Chưa cập nhật được tiến trình. Dữ liệu đang có vẫn được giữ.{queue.refreshError.message && <span> {queue.refreshError.message}</span>}</p><Button size="sm" variant="ghost" onClick={queue.refetch}>Thử lại</Button></div>}
  </section>;
}
