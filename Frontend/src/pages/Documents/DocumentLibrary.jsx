import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  Download,
  Trash2,
  Pencil,
  Tag,
  ExternalLink,
} from "lucide-react";
import { documentApi, workspaceApi } from "../../api";
import { responseList } from "../../api/apiClient";
import { useApi } from "../../hooks/useApi";
import { useCurrentCourses } from "../../hooks/useCurrentCourses";
import CurrentCourseHint from "../../components/common/CurrentCourseHint";
import { documentTerm } from "../../utils/learningFlow";
import { formatDate } from "../../utils/date";
import { saveBlob, fileSize } from "../../utils/files";
import DocumentPreview from "../../components/documents/DocumentPreview";
import { normalizePage, pageText } from "../Notebooks/notebookModel";
import {
  Card,
  Button,
  Tabs,
  SearchBox,
  ApiContent,
  EmptyState,
  Modal,
  ConfirmModal,
  Field,
  Badge,
  ErrorState,
  useAction,
} from "../../components/common/ui";

export function documentCategory(value) {
  const type = String(value || "").toLowerCase();
  if (type === "pdf" || type === "application/pdf") return "pdf";
  if (["doc", "docx", "application/msword"].includes(type) || type.includes("wordprocessingml")) return "word";
  if (["ppt", "pptx", "application/vnd.ms-powerpoint"].includes(type) || type.includes("presentationml")) return "slides";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(type) || type.startsWith("image/")) return "image";
  return type;
}
export function isStructuredNote(note) {
  try {
    const content = typeof note?.content === 'string' ? JSON.parse(note.content) : note?.content;
    return !!(content && (content.type === 'doc' || content.format === 'ssh-notebook' && content.kind === 'page' && content.version === 1));
  } catch { return false; }
}
function readableNote(note) {
  return pageText(normalizePage({ ...note, content: typeof note.content === 'object' ? JSON.stringify(note.content) : note.content }));
}
function adaptDocument(r) {
  const name = r.title || r.name || r.filename || r.file_name || "Tài liệu";
  return {
    ...r,
    id: r.document_id ?? r.id,
    title: name,
    type: String(
      r.type || r.fileType || r.extension || name.split(".").at(-1),
    ).toLowerCase(),
    category: documentCategory(r.mime_type || r.mimeType || r.type || r.fileType || r.extension || name.split(".").at(-1)),
    size: r.size ?? r.file_size,
    subject: r.subject || r.subject_name || "",
    uploadedAt: r.uploaded_at || r.created_at || r.uploadedAt,
    tags: Array.isArray(r.tags) ? r.tags : [],
  };
}
export function DocumentCard({
  doc,
  onDownload,
  onPreview,
  onDelete,
  onTags,
  busy,
}) {
  return (
    <article className="card document-card">
      <div className="filter-bar">
        <div className={"file-icon " + doc.type}>
          {doc.type.slice(0, 5).toUpperCase()}
        </div>
        <Button
          variant="ghost"
          aria-label={"Tag cho " + doc.title}
          onClick={() => onTags(doc)}
        >
          <Tag size={15} />
        </Button>
      </div>
      <h3>{doc.title}</h3>
      <p>
        {doc.type.toUpperCase()} · {fileSize(doc.size)}
      </p>
      <p>{doc.subject || "Chưa phân loại"}</p>
      <p className="hint">{documentTerm(doc) || 'Học kỳ: Chưa phân loại'}</p>
      <div className="tag-list">
        {doc.tags.map((t) => (
          <Badge key={t} label={t} />
        ))}
      </div>
      <div className="document-card-footer">
        <small className="muted">{formatDate(doc.uploadedAt)}</small>
        <div className="actions">
          <Button
            variant="ghost"
            aria-label={"Xem " + doc.title}
            disabled={busy}
            onClick={() => onPreview(doc)}
          >
            <ExternalLink size={14} />
          </Button>
          <Button
            variant="ghost"
            aria-label={"Tải " + doc.title}
            disabled={busy}
            onClick={() => onDownload(doc)}
          >
            <Download size={14} />
          </Button>
          <Button
            variant="ghost"
            aria-label={"Xóa " + doc.title}
            onClick={() => onDelete(doc)}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </article>
  );
}
export default function DocumentLibrary() {
  const [params, setParams] = useSearchParams();
  const tab = ["notes", "notebooks"].includes(params.get("tab"))
    ? params.get("tab")
    : "files";
  const [query, setQuery] = useState(params.get('q') || ''),
    [subject, setSubject] = useState(""),
    [semester, setSemester] = useState(""),
    [filter, setFilter] = useState("all"),
    [upload, setUpload] = useState(false),
    [editor, setEditor] = useState(null),
    [deleting, setDeleting] = useState(null),
    [tagDoc, setTagDoc] = useState(null),
    [tags, setTags] = useState("");
  const state = useApi(documentApi.list),
    notes = useApi(workspaceApi.notes.list),
    notebooks = useApi(workspaceApi.notebooks.list);
  const { run, busy } = useAction();
  useEffect(() => {
    // Sidebar links change the query without remounting this page.
    setFilter("all");
    setSubject("");
    setEditor(null);
  }, [tab]);
  const docs = responseList(state.data, "documents").map(adaptDocument);
  const previewId = tab === "files" ? params.get("document") : null;
  const preview = previewId !== null
    ? docs.find((doc) => String(doc.id) === previewId) || { id: previewId, title: "Tài liệu", type: "" }
    : null;
  const noteId = tab === "notes" ? params.get("note") : null;
  const noteRows = responseList(notes.data, "notes").map((note) => ({ ...note, id: note.id ?? note.note_id }));
  const activeEditor = noteId !== null ? noteRows.find((note) => String(note.id) === noteId) : editor;
  function openStructuredNote(note) {
    const next = new URLSearchParams(params);
    ['note', 'document', 'subject', 'chapter', 'slide'].forEach(key => next.delete(key));
    next.set('tab', 'notebooks');
    const notebookId = note.notebookId ?? note.notebook_id;
    if (notebookId != null) next.set('notebook', String(notebookId));
    next.set('page', String(note.id ?? note.note_id));
    setParams(next);
  }
  useEffect(() => {
    if (tab === 'notes' && noteId !== null && isStructuredNote(activeEditor)) openStructuredNote(activeEditor);
  }, [tab, noteId, notes.data]);
  function clearTarget(key) {
    const next = new URLSearchParams(params);
    next.delete(key);
    if (key === "document" && !next.has("tab")) next.set("tab", "files");
    setParams(next, { replace: true });
  }
  function closeEditor() {
    setEditor(null);
    if (noteId !== null) clearTarget("note");
  }
  const workspace = tab === "notes" ? notes : notebooks,
    api = workspaceApi[tab];
  const rows =
    tab === "files"
      ? docs
      : responseList(workspace.data, tab).map((r) => ({
          ...r,
          id: r.id ?? r.note_id ?? r.notebook_id,
          content: r.content ?? r.description,
          displayContent: tab === 'notes' && isStructuredNote(r) ? readableNote(r) : r.content ?? r.description,
        }));
  const filtered = rows.filter(
    (d) =>
      [d.title, d.subject, d.chapter, d.displayContent ?? d.content, ...(d.tags || [])].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase()) &&
      (!subject || d.subject === subject) &&
      (!semester || (semester === '__unclassified' ? !documentTerm(d) : documentTerm(d) === semester)) &&
      (filter === "all" || d.category === filter),
  );
  return (
    <div className="document-library">
      {tab !== "files" && <header className="document-library-header">
        <h2>{tab === "notes" ? "Ghi chú cá nhân" : "Sổ tay cá nhân"}</h2>
        <Button onClick={() => { if (noteId !== null) clearTarget("note"); setEditor({}); }}>
          <Plus size={15} />
          Tạo {tab === "notes" ? "ghi chú" : "sổ tay"}
        </Button>
      </header>}
      <div className="filter-bar" data-region="B" aria-label="B. Tìm kiếm và lọc tài liệu">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder={tab === "notes" ? "Tìm ghi chú..." : "Tìm môn học, chương, slide, tài liệu..."}
        />
        {tab === "files" && (
          <select
            aria-label="Lọc môn học"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          >
            <option value="">Tất cả môn học</option>
            {[...new Set(docs.map((d) => d.subject).filter(Boolean))].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
        )}
      </div>
      {tab === "files" && (
        <Field label="Lọc học kỳ file"><select value={semester} onChange={e => setSemester(e.target.value)}><option value="">Tất cả học kỳ</option>{[...new Set(docs.map(documentTerm).filter(Boolean))].map(term => <option key={term}>{term}</option>)}<option value="__unclassified">Chưa phân loại</option></select></Field>
      )}
      {tab === "files" && (
        <Tabs
          items={[
            ["all", "Tất cả"],
            ["pdf", "PDF"],
            ["word", "Word"],
            ["slides", "Trình chiếu"],
            ["image", "Ảnh"],
          ]}
          value={filter}
          onChange={setFilter}
        />
      )}
      <ApiContent state={tab === "files" ? state : workspace}>
        {filtered.length ? (
          <div className="document-grid" data-region="D" aria-label="D. Danh sách tài liệu">
            {filtered.map((d) =>
              tab === "files" ? (
                <DocumentCard
                  key={d.id}
                  doc={d}
                  busy={busy}
                  onTags={(x) => {
                    setTagDoc(x);
                    setTags(x.tags.join(", "));
                  }}
                  onDelete={setDeleting}
                  onDownload={(x) =>
                    run(
                      async () =>
                        saveBlob(
                          await documentApi.download(x.id, true),
                          x.title,
                        ),
                      "Đã tải tài liệu",
                    )
                  }
                  onPreview={(x) => { const next = new URLSearchParams(params); next.set("document", String(x.id)); setParams(next); }}
                />
              ) : (
                <article className="card document-card" key={d.id}>
                  <div className="file-icon docx">
                    {tab === "notes" ? "NOTE" : "BOOK"}
                  </div>
                  <h3>{d.title}</h3>
                  <p>
                    {d.subject} {d.chapter}
                  </p>
                  <p
                    style={{
                      maxHeight: 72,
                      overflow: "hidden",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {d.displayContent ?? d.content}
                  </p>
                  <div className="tag-list">
                    {Array.isArray(d.tags) &&
                      d.tags.map((t) => <Badge key={t} label={t} />)}
                    {d.isDifficult && (
                      <Badge label="Cần ôn" variant="warning" />
                    )}
                  </div>
                  <div className="document-card-footer">
                    <small>{formatDate(d.updatedAt || d.updated_at)}</small>
                    <div className="actions">
                      <Button
                        variant="ghost"
                        aria-label="Sửa ghi chú"
                        onClick={() => {
                          if (tab === "notes") {
                            if (isStructuredNote(d)) { openStructuredNote(d); return; }
                            const next = new URLSearchParams(params);
                            next.set("note", String(d.id));
                            setParams(next);
                          } else setEditor(d);
                        }}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={tab === 'notes' && isStructuredNote(d) ? 'Xuất TXT' : 'Xuất DOCX'}
                        onClick={() =>
                          run(
                            async () => tab === 'notes' && isStructuredNote(d)
                              ? saveBlob({ data: new Blob(['\uFEFF', d.title, '\n\n', readableNote(d)], { type: 'text/plain;charset=utf-8' }) }, `${d.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')}.txt`)
                              : saveBlob(
                                await api.export(d.id),
                                d.title + ".docx",
                              ),
                            "Đã xuất tài liệu",
                          )
                        }
                      >
                        <Download size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label="Xóa ghi chú"
                        onClick={() => setDeleting(d)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </article>
              ),
            )}
          </div>
        ) : (
          <Card>
            <EmptyState
              title="Chưa có tài liệu phù hợp"
              description="Thêm tài liệu của bạn hoặc thay đổi bộ lọc."
            />
          </Card>
        )}
      </ApiContent>
      <Modal
        isOpen={upload}
        title="Tải tài liệu lên"
        onClose={() => setUpload(false)}
      >
        <UploadForm
          onClose={() => setUpload(false)}
          onSaved={async () => {
            setUpload(false);
            await state.refetch();
          }}
        />
      </Modal>
      <Modal
        isOpen={(!!editor || noteId !== null) && !isStructuredNote(activeEditor)}
        title={activeEditor?.id || noteId !== null ? "Chỉnh sửa" : "Tạo mới"}
        onClose={closeEditor}
      >
        {noteId !== null && (notes.loading || notes.error) ? (
          <ApiContent state={notes} />
        ) : activeEditor && !isStructuredNote(activeEditor) ? (
          <NoteEditor
            key={activeEditor.id ?? "new"}
            item={activeEditor}
            kind={tab}
            notebooks={responseList(notebooks.data).map((r) => ({
              ...r,
              id: r.id ?? r.notebook_id,
            }))}
            onClose={closeEditor}
            onSaved={async () => {
              closeEditor();
              await workspace.refetch();
            }}
          />
        ) : noteId !== null && (
          <EmptyState title="Không tìm thấy ghi chú" description="Ghi chú có thể đã được xóa hoặc không còn trong dữ liệu hiện tại." />
        )}
      </Modal>
      <Modal
        isOpen={!!tagDoc}
        title="Tag tài liệu"
        onClose={() => setTagDoc(null)}
      >
        <Field
          label="Tag (phân cách bằng dấu phẩy)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <div className="form-actions">
          <Button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await documentApi.updateTags(
                  tagDoc.id,
                  tags
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                );
                setTagDoc(null);
                await state.refetch();
              }, "Đã lưu tag")
            }
          >
            Lưu tag
          </Button>
        </div>
      </Modal>
      <ConfirmModal
        item={deleting}
        onClose={() => setDeleting(null)}
        busy={busy}
        onConfirm={() =>
          run(async () => {
            await (tab === "files" ? documentApi : api).remove(deleting.id);
            setDeleting(null);
            await (tab === "files" ? state : workspace).refetch();
          }, "Đã xóa")
        }
      />
      <Modal
        isOpen={!!preview}
        size="lg"
        title={preview?.title}
        onClose={() => clearTarget("document")}
      >
        {preview && <DocumentPreview key={preview.id} document={preview} />}
      </Modal>
    </div>
  );
}
export function UploadForm({ onSaved, onClose }) {
  const current = useCurrentCourses();
  const [file, setFile] = useState(null),
    [title, setTitle] = useState(""),
    [subject, setSubject] = useState(""),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          if (!file) throw new Error("Chọn một tập tin.");
          if (file.size > 25 * 1024 * 1024) throw new Error("Tập tin vượt quá giới hạn 25 MB.");
          await documentApi.upload(file, {
            title: title.trim() || file.name,
            subjectId: subject || null,
            filename: file.name,
            mimeType: file.type,
          });
          await onSaved();
        } catch (err) {
          setError(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <ErrorState error={error} title="Tải lên thất bại" />}
      <Field label="Tập tin">
        <input
          type="file"
          accept=".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg"
          required
          onChange={(e) => {
            const f = e.target.files[0];
            setFile(f);
            if (f) setTitle(f.name);
          }}
        />
      </Field>
      <Field
        label="Tên tài liệu"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <Field label="Môn học"><select value={subject} onChange={e => setSubject(e.target.value)}><option value="">Chưa phân loại</option>{current.subjects.map(s => <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>)}</select></Field>
      <CurrentCourseHint state={current} />
      <p className="hint">Học kỳ: {subject && current.data?.semester ? documentTerm({ semester: current.data.semester, academicYear: current.data.academicYear }) : 'Chưa phân loại'}. Có thể tải file chưa phân loại khi chưa đồng bộ IU.</p>
      <p className="hint">
        Hỗ trợ PDF, DOCX, PPTX, TXT, Markdown và hình ảnh, tối đa 25 MB.
      </p>
      <div className="form-actions">
        <Button variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Đang tải lên..." : "Tải lên"}
        </Button>
      </div>
    </form>
  );
}
function NoteEditor({ item, kind, notebooks = [], onSaved, onClose }) {
  const [form, setForm] = useState({
      title: item.title || "",
      subject: item.subject || "",
      chapter: item.chapter || "",
      content: item.content || item.description || "",
      notebookId: item.notebookId || "",
      tags: Array.isArray(item.tags) ? item.tags.join(", ") : "",
      isDifficult: !!item.isDifficult,
    }),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const field = (k) => ({
    value: form[k],
    onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const body =
            kind === "notebooks"
              ? { title: form.title, description: form.content }
              : {
                  ...form,
                  tags: form.tags
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                };
          await (item.id
            ? workspaceApi[kind].update(item.id, body)
            : workspaceApi[kind].create(body));
          await onSaved();
        } catch (err) {
          setError(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <ErrorState error={error} title="Chưa lưu được" />}
      <Field label="Tiêu đề" required {...field("title")} />
      {kind === "notes" && <Field label="Sổ tay"><select {...field("notebookId")}><option value="">Sổ tay học tập</option>{notebooks.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}</select></Field>}
      <div className="form-grid">
        <Field label="Môn học" {...field("subject")} />
        <Field label="Chương" {...field("chapter")} />
      </div>
      <Field label="Nội dung">
        <textarea rows="10" {...field("content")} />
      </Field>
      <Field label="Tag" {...field("tags")} />
      <label className="actions">
        <input
          type="checkbox"
          checked={form.isDifficult}
          onChange={(e) =>
            setForm((f) => ({ ...f, isDifficult: e.target.checked }))
          }
        />
        Nội dung cần ôn lại
      </label>
      <div className="form-actions">
        <Button variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={busy}>
          Lưu
        </Button>
      </div>
    </form>
  );
}
