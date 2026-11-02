import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Search } from "lucide-react";
import { searchApi } from "../../api";
import { useApi } from "../../hooks/useApi";
import { Modal, Badge, EmptyState, ErrorState, LoadingSkeleton } from "../common/ui";

const groups = [
  ["tasks", "task", "Công việc", "/tasks"],
  ["documents", "document", "Tài liệu", "/documents"],
  ["notes", "note", "Ghi chú", "/documents?tab=notes"],
  ["subjects", "subject", "Môn học", "/learning"],
  ["schedules", "schedule", "Lịch học", "/schedule"],
  ["exams", "exam", "Kỳ thi", "/exams"],
  ["emails", "email", "Email trường", "/email"],
];

function resultPath(row, type, fallback) {
  const id = row.id ?? row.assignment_id ?? row.document_id ?? row.subject_id;
  const params = new URLSearchParams();
  if (type === "task" && id != null) {
    params.set(row.source === "EDUX" || !/^\d+$/.test(String(id)) ? "edux" : "task", id);
  } else if (type === "document" && id != null) params.set("document", id);
  else if (type === "note" && id != null) {
    params.set("tab", "notes");
    params.set("note", id);
  } else if (type === "schedule" && (row.selectedDate || row.study_date)) {
    params.set("date", row.selectedDate || row.study_date);
  }
  return params.size ? fallback.split("?")[0] + "?" + params : fallback;
}

export default function WorkspaceSearch({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [settledQuery, setSettledQuery] = useState(null);
  const search = useApi(searchApi.search, { immediate: false });
  const navigate = useNavigate();
  const term = query.trim();
  useEffect(() => {
    setSettledQuery(null);
    if (!isOpen || term.length < 2) return;
    let active = true;
    const timer = setTimeout(async () => {
      await search.execute(term);
      if (active) setSettledQuery(term);
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [term, isOpen, search.execute]);

  const data = search.data;
  const flat = Array.isArray(data) ? data : data?.results;
  const results = groups.map(([key, type, label, path]) => ({
    key, type, label, path,
    rows: Array.isArray(flat)
      ? flat.filter((r) => r.type === type || r.type === key)
      : Array.isArray(data?.[key]) ? data[key] : [],
  })).filter((g) => g.rows.length);
  const pending = term.length >= 2 && (search.loading || settledQuery !== term);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tìm kiếm không gian học tập" size="lg">
      <div className="search-box workspace-search-input">
        <Search size={18} aria-hidden="true" />
        <input
          data-autofocus
          aria-label="Tìm kiếm toàn bộ"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm môn học, tài liệu, công việc..."
        />
        {query && <button aria-label="Xóa từ khóa" onClick={() => setQuery("")}>×</button>}
      </div>
      {term.length < 2 ? (
        <p className="hint">Nhập ít nhất 2 ký tự. Tìm theo tiêu đề, nội dung hoặc #tag.</p>
      ) : pending ? (
        <div className="loading-grid"><LoadingSkeleton /><LoadingSkeleton /></div>
      ) : search.error ? (
        <ErrorState error={search.error} onRetry={async () => { await search.execute(term); setSettledQuery(term); }} />
      ) : !results.length ? (
        <EmptyState title="Không tìm thấy kết quả" description="Thử từ khóa khác hoặc tìm theo tên môn học." />
      ) : (
        <div className="search-results" aria-live="polite">
          <p className="hint">{results.reduce((n, g) => n + g.rows.length, 0)} kết quả cho “{term}”</p>
          {results.map(({ key, type, label, path, rows }) => (
            <section key={key}>
              <h3>{label}<Badge label={rows.length} /></h3>
              {rows.map((row, i) => (
                <button key={row.id ?? row.assignment_id ?? i} onClick={() => {
                  navigate(resultPath(row, type, path));
                  onClose();
                }}>
                  <span>
                    <strong>{row.title || row.subject_name || row.name || row.subject}</strong>
                    {row.preview && <small>{row.preview}</small>}
                  </span>
                  <ArrowUpRight size={15} aria-hidden="true" />
                </button>
              ))}
            </section>
          ))}
        </div>
      )}
    </Modal>
  );
}
