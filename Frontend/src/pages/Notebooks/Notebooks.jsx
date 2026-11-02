import { lazy, Suspense } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { Button, EmptyState, ErrorState, LoadingSkeleton } from '../../components/common/ui';
import useNotebooks from './useNotebooks';
import NotebookDashboard from './NotebookDashboard';
const NotebookEditor = lazy(() => import('./editor/NotebookEditor'));

export default function Notebooks({ embedded = false }) {
  const store = useNotebooks();
  const [params, setParams] = useSearchParams();
  const route = useParams(), navigate = useNavigate();
  const id = route.id || params.get('notebook');
  const notebook = store.notebooks.find(book => String(book.id) === String(id));
  const open = (notebookId, pageId) => {
    if (embedded) {
      const next = new URLSearchParams({ tab: 'notebooks', notebook: String(notebookId) });
      if (pageId) next.set('page', String(pageId));
      setParams(next);
    } else if (route.id) {
      const next = new URLSearchParams();
      if (pageId) next.set('page', String(pageId));
      setParams(next);
    } else {
      const next = new URLSearchParams({ notebook: String(notebookId) });
      if (pageId) next.set('page', String(pageId));
      setParams(next);
    }
  };
  if (store.loading) return <div className="page"><LoadingSkeleton /><LoadingSkeleton /></div>;
  if (store.error && !store.notebooks.length) return <div className="page"><ErrorState error={store.error} onRetry={store.refetch} /></div>;
  if (id && !notebook) return <div className="page"><EmptyState title="Không tìm thấy sổ tay" description="Sổ tay có thể đã được xóa hoặc thuộc hồ sơ khác." action={<Button onClick={() => embedded ? setParams({ tab: 'notebooks' }) : navigate('/notebooks')}>Về sổ tay của tôi</Button>} /></div>;
  return notebook ? <Suspense fallback={<div className="page"><LoadingSkeleton /></div>}><NotebookEditor key={notebook.id} notebook={notebook} store={store} pageId={params.get('page')} onSelectPage={pageId => open(notebook.id, pageId)} onBack={() => embedded ? setParams({ tab: 'notebooks' }) : navigate('/notebooks')} /></Suspense> : <NotebookDashboard store={store} onOpen={open} />;
}
