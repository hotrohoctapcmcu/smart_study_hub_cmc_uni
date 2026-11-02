import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useId,
  cloneElement,
  isValidElement,
} from "react";
import { X, AlertCircle, RefreshCw, Check, Search, Plus } from "lucide-react";
import foxAssets from "../../assets/foxAssets";

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={"btn btn-" + variant + " btn-" + size + " " + className}
      {...props}
    >
      {children}
    </button>
  );
}
export function Card({
  children,
  title,
  action,
  className = "",
  padded = true,
  region,
  ...props
}) {
  return (
    <section className={"card " + className} aria-label={title || undefined} data-region={region} {...props}>
      {title && (
        <div className="card-heading">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      <div className={padded ? "card-content" : ""}>{children}</div>
    </section>
  );
}
export function Badge({ children, label, variant = "primary" }) {
  return <span className={"badge badge-" + variant}>{children || label}</span>;
}
export function LoadingSkeleton({ className = "" }) {
  return (
    <div
      role="status"
      aria-label="Đang tải dữ liệu"
      className={"skeleton " + className}
    >
      <span className="sr-only">Đang tải dữ liệu</span>
    </div>
  );
}
export function EmptyState({
  title = "Chưa có dữ liệu",
  description = "",
  action,
  icon,
  mascot = "fox-study.png",
}) {
  return (
    <div className="empty-state">
      {icon || <img src={foxAssets[mascot]} alt="" />}
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorState({
  error,
  onRetry,
  title = "Không thể kết nối máy chủ",
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={22} />
      <div>
        <h3>{title}</h3>
        <p>
          {error?.response?.data?.message ||
            (error?.response
              ? "Máy chủ trả lỗi " + error.response.status
              : error?.code === "ERR_NETWORK"
                ? "Vui lòng kiểm tra backend và cấu hình VITE_API_URL."
                : error?.message) ||
            "Vui lòng kiểm tra backend tại localhost:3001."}
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw size={14} />
            Thử lại
          </Button>
        )}
      </div>
    </div>
  );
}
export function ApiContent({ state, empty, children }) {
  if (state.loading)
    return (
      <div className="loading-grid">
        <LoadingSkeleton />
        <LoadingSkeleton />
        <LoadingSkeleton />
      </div>
    );
  if (state.error)
    return <ErrorState error={state.error} onRetry={state.refetch} />;
  if (empty) return <EmptyState />;
  return children;
}
export function PageHeader({ title, description, children, eyebrow = "KHÔNG GIAN CỦA BẠN" }) {
  return (
    <div className="page-header" data-region="A" aria-label={"A · " + title}>
      <div>
        <span className="page-eyebrow"><span aria-hidden="true" />{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function Tabs({ items, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => {
        const [key, label] = Array.isArray(item) ? item : [item, item];
        return (
          <button
            key={key}
            role="tab"
            aria-selected={value === key}
            className={value === key ? "active" : ""}
            onClick={() => onChange(key)}
          >
      {label}
          </button>
        );
      })}
    </div>
  );
}
export function Field({ label, children, ...props }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      {isValidElement(children) ? (
        cloneElement(children, { id })
      ) : (
        <input id={id} {...props} />
      )}
    </label>
  );
}
export function SearchBox({ value, onChange, placeholder = "Tìm kiếm..." }) {
  return (
    <div className="search-box">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function ProgressBar({ value = 0, max = 100 }) {
  const percent =
    Math.max(0, Math.min(100, (Number(value) / (max || 1)) * 100)) || 0;
  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: percent + "%" }} />
    </div>
  );
}
export function ProgressRing({ value = 0 }) {
  const n = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="progress-ring" style={{ "--percent": n + "%" }}>
      <div>
        <strong>{Math.round(n)}%</strong>
        <small>Hoàn thành</small>
      </div>
    </div>
  );
}
export function Modal({ isOpen, onClose, title, children, size = "md" }) {
  const ref = useRef(null),
    titleId = useId(),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement;
    const node = ref.current;
    (node?.querySelector("[data-autofocus]") || node?.querySelector(".modal-body input, .modal-body textarea, .modal-body select, button"))?.focus();
    const handler = (e) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const items = [
          ...node.querySelectorAll(
            'button, input, select, textarea, a[href], [tabindex="0"]',
          ),
        ].filter((el) => !el.disabled);
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={"modal modal-" + size}
      >
        <div className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <Button variant="ghost" aria-label="Đóng hộp thoại" onClick={onClose}>
            <X size={19} />
          </Button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
export function ConfirmModal({ item, onClose, onConfirm, busy }) {
  return (
    <Modal isOpen={!!item} title="Xác nhận xóa" onClose={onClose}>
      <p>
        Bạn muốn xóa “
        {item?.title || item?.subjectName || item?.name || "mục này"}”?
      </p>
      <div className="form-actions">
        <Button variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button variant="danger" disabled={busy} onClick={onConfirm}>
          Xóa
        </Button>
      </div>
    </Modal>
  );
}
const ToastContext = createContext(null);
export function AppProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const notify = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={"toast " + t.type}>
            {t.type === "success" ? (
              <Check size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export function useAction() {
  const notify = useContext(ToastContext);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function run(action, message = "Đã lưu thay đổi") {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    try {
      await action();
      if (message) notify?.(message);
      return true;
    } catch (error) {
      notify?.(
        error.response?.data?.message || error.message || "Thao tác thất bại",
        "error",
      );
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { run, busy, notify };
}
export function AddButton({ children, ...props }) {
  return (
    <Button {...props}>
      <Plus size={16} />
      {children}
    </Button>
  );
}
