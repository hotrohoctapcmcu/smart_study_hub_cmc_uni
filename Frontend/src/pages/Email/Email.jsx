import { useState } from "react";
import {
  RefreshCw,
  CheckCheck,
  ListTodo,
  CalendarDays,
  LogOut,
  Inbox,
  Mail,
  MailOpen,
} from "lucide-react";
import { emailApi } from "../../api";
import { useApi } from "../../hooks/useApi";
import { responseList } from "../../api/apiClient";
import { formatDateTime } from "../../utils/date";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  ApiContent,
  EmptyState,
  ConfirmModal,
  useAction,
  SearchBox,
} from "../../components/common/ui";
function bodyText(value) {
  const text = typeof value === "string" ? value : value?.content || "";
  if (!text.includes("<")) return text;
  return (
    new DOMParser().parseFromString(text, "text/html").body.textContent || ""
  );
}
export default function Email() {
  const state = useApi(emailApi.list),
    status = useApi(emailApi.status),
    { run, busy } = useAction();
  const [selected, setSelected] = useState(null),
    [disconnect, setDisconnect] = useState(false),
    [folder, setFolder] = useState("all"),
    [query, setQuery] = useState("");
  const rows = responseList(state.data, "emails").map((r) => ({
    ...r,
    id: r.email_id ?? r.id,
    subject: r.subject || r.title || "Không tiêu đề",
    sender:
      typeof r.sender === "string"
        ? r.sender
        : r.sender?.emailAddress?.address ||
          r.from?.emailAddress?.address ||
          r.from ||
          "Email trường",
    isRead: !!(r.isRead ?? Number(r.is_read ?? r.read ?? 0)),
  }));
  const email = rows.find((r) => r.id === selected);
  const visibleRows = rows.filter(r =>
    (folder === "all" || (folder === "read" ? r.isRead : !r.isRead)) &&
    [r.subject, r.sender, bodyText(r.bodyPreview || r.preview || r.content)].join(" ").toLowerCase().includes(query.toLowerCase())
  );
  async function reload() {
    await state.refetch();
    await status.refetch();
    window.dispatchEvent(new Event("workspace-updated"));
  }
  return (
    <div className="page email-page">
      <PageHeader
        eyebrow="KẾT NỐI VỚI GIẢNG ĐƯỜNG"
        title="Email trường"
        description="Thư từ giảng viên, lịch thi và những điều cần nhớ."
      >
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await emailApi.readAll();
              await reload();
            }, "Đã đánh dấu tất cả đã đọc")
          }
        >
          <CheckCheck size={14} />
          Đọc tất cả
        </Button>
        <Button
          disabled={busy}
          onClick={() =>
            run(async () => {
              await emailApi.sync();
              await reload();
            }, "Đã đồng bộ email")
          }
        >
          <RefreshCw size={14} />
          Đồng bộ
        </Button>
      </PageHeader>
      <Card>
        <div className="filter-bar">
          <div>
            <strong>Outlook</strong>
            <p className="hint" style={{ margin: 0 }}>
              {status.error
                ? "Không kiểm tra được kết nối"
                : status.loading
                  ? "Đang kiểm tra..."
                  : status.data?.connected
                    ? "Đã kết nối"
                    : "Chưa kết nối"}
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => setDisconnect(true)}
            disabled={!status.data?.connected}
          >
            <LogOut size={14} />
            Ngắt phiên
          </Button>
        </div>
      </Card>
      <Card padded={false}>
        <ApiContent state={state}>
          {rows.length ? (
            <div className="mail-layout mail-workspace">
              <nav className="mail-folders" aria-label="B. Thư mục email">
                <strong>HỘP THƯ CỦA BẠN</strong>
                {[["all", "Tất cả thư", Inbox, rows.length], ["unread", "Chưa đọc", Mail, rows.filter(r => !r.isRead).length], ["read", "Đã đọc", MailOpen, rows.filter(r => r.isRead).length]].map(([key, label, Icon, count]) => <button key={key} aria-pressed={folder === key} className={folder === key ? "active" : ""} onClick={() => setFolder(key)}><Icon size={16} /><span>{label}</span><small>{count}</small></button>)}
                <p className="hint">Biến những thông báo quan trọng thành công việc hoặc lịch thi ngay trong thư.</p>
              </nav>
              <div className="mail-list" data-region="C" aria-label="C. Danh sách email">
                <div className="mail-search"><SearchBox value={query} onChange={setQuery} placeholder="Tìm email..." /></div>
                {!visibleRows.length && <EmptyState title="Không có email phù hợp" description="Thử đổi thư mục hoặc từ khóa tìm kiếm." />}
                {visibleRows.map((r) => (
                  <button
                    key={r.id}
                    className={
                      "mail-item " +
                      (selected === r.id ? "active " : "") +
                      (!r.isRead ? "unread" : "")
                    }
                    onClick={() => {
                      setSelected(r.id);
                      if (!r.isRead)
                        run(async () => {
                          await emailApi.readOne(r.id);
                          await state.refetch();
                        }, "");
                    }}
                  >
                    <h3>{r.subject}</h3>
                    <p>{r.sender}</p>
                    <p>
                      {formatDateTime(
                        r.received_at ||
                          r.receivedAt ||
                          r.receivedDateTime ||
                          r.date,
                      )}
                    </p>
                  </button>
                ))}
              </div>
              <div className="mail-detail" data-region="D" aria-label="D. Nội dung email">
                {email ? (
                  <>
                    <h2>{email.subject}</h2>
                    <p className="muted">{email.sender}</p>
                    <div className="mail-body">
                      {bodyText(
                        email.body ||
                          email.content ||
                          email.bodyPreview ||
                          email.preview,
                      ) || "Email chưa có nội dung. Hãy làm mới thư."}
                    </div>
                    <div className="actions">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await emailApi.refresh(email.id);
                            await state.refetch();
                          }, "Đã làm mới thư")
                        }
                      >
                        <RefreshCw size={13} />
                        Làm mới thư
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await emailApi.toTask(email.id);
                            window.dispatchEvent(
                              new Event("workspace-updated"),
                            );
                          }, "Đã chuyển thành công việc")
                        }
                      >
                        <ListTodo size={13} />
                        Tạo công việc
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await emailApi.toExam(email.id);
                            window.dispatchEvent(new Event("workspace-updated"));
                          }, "Đã tạo kỳ thi từ email")
                        }
                      >
                        <CalendarDays size={13} />
                        Tạo kỳ thi
                      </Button>
                    </div>
                  </>
                ) : (
                  <EmptyState title="Chọn một email để đọc" />
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              title="Hộp thư đang trống"
              description="Đồng bộ Outlook để cập nhật email trường."
            />
          )}
        </ApiContent>
      </Card>
      <ConfirmModal
        item={disconnect ? { title: "phiên Outlook đang kết nối" } : null}
        onClose={() => setDisconnect(false)}
        busy={busy}
        onConfirm={() =>
          run(async () => {
            await emailApi.deleteSession();
            setDisconnect(false);
            await reload();
          }, "Đã ngắt kết nối Outlook")
        }
      />
    </div>
  );
}
