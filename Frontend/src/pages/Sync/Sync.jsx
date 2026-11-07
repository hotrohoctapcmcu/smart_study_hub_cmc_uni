import { useState, useEffect, useRef } from "react";
import { Link } from 'react-router-dom';
import {
  Database,
  Cloud,
  Mail,
  RefreshCw,
  Link as LinkIcon,
  Unplug,
  HeartPulse,
} from "lucide-react";
import { syncApi, emailApi, healthApi } from "../../api";
import { useApi } from "../../hooks/useApi";
import { responseList, unwrapResponse } from "../../api/apiClient";
import { formatDateTime } from "../../utils/date";
import {
  PageHeader,
  Card,
  Button,
  ApiContent,
  Badge,
  Modal,
  Field,
  ErrorState,
  ConfirmModal,
  useAction,
} from "../../components/common/ui";
const definitions = [
  ["iu", "IU", "Lịch học, môn học và kết quả học tập", Database],
  ["edux", "EDUX", "Bài tập, học liệu và tiến trình học", Cloud],
  ["outlook", "Outlook", "Email và thông báo từ trường", Mail],
];
const liveStates = ["PENDING", "RUNNING", "CONNECTING"];
const resultLabel = (item) => item?.status === "CHECKING" ? "Đang kiểm tra phiên"
  : item?.status === "CONNECTED" ? "Đã kết nối, chờ đồng bộ"
  : item?.status === "CONNECTING" ? "Đang kết nối"
  : item?.status === "PENDING" ? "Đang chờ"
    : item?.status === "RUNNING" ? "Đang đồng bộ"
      : item?.status === "UNKNOWN" ? "Chưa xác nhận kết quả"
        : item?.ok ? "Đã đồng bộ" : item?.partial && item?.synced ? "Đã đồng bộ một phần" : "Chưa đồng bộ";
export default function Sync() {
  const desktop = globalThis.__SSH_RUNTIME__?.desktop;
  const sources = useApi(syncApi.getSources),
    iu = useApi(syncApi.iu.status),
    edux = useApi(syncApi.edux.status),
    outlook = useApi(emailApi.status),
    health = useApi(healthApi.check),
    courses = useApi(syncApi.currentCourses);
  const [session, setSession] = useState(null),
    [disconnect, setDisconnect] = useState(null),
    [group, setGroup] = useState(false),
    [groupValue, setGroupValue] = useState(""),
    [allCredentials, setAllCredentials] = useState(null),
    [allResults, setAllResults] = useState(null),
    [allJob, setAllJob] = useState(null);
  const generation = useRef(0), mounted = useRef(true), watcher = useRef(null);
  const { run, busy } = useAction();
  const actionBusy = busy || liveStates.includes(allJob?.status);
  async function synchronizeAll(options = {}) {
    watcher.current?.abort();
    const version = ++generation.current;
    setAllCredentials(null);
    setAllResults(null);
    try {
      const result = await syncApi.all({ ...options, onProgress: (job) => {
        if (mounted.current && generation.current === version) { setAllJob(job); setAllResults(job.results); }
      } });
      if (!mounted.current || generation.current !== version) return;
      setAllJob(result);
      setAllResults(result.results);
      const failures = Object.entries(result.results || {}).filter(([, item]) => !item.ok);
      if (failures.length)
        throw new Error(failures.map(([key, item]) => key.toUpperCase() + ": " + item.message).join("; "));
    } finally {
      if (mounted.current && generation.current === version) await reload();
      else window.dispatchEvent(new Event("workspace-updated"));
    }
  }
  async function beginAll() {
    watcher.current?.abort();
    generation.current++;
    const [iuState, eduxState] = await Promise.allSettled([
      syncApi.iu.status({ timeout: 8000 }), syncApi.edux.status({ timeout: 8000 }),
    ]);
    const hasSession = (response) => {
      if (response.status !== "fulfilled") return false;
      const info = unwrapResponse(response.value);
      return Boolean(info?.connected ?? info?.hasSession ?? info?.has_session);
    };
    const needsEdux = !hasSession(eduxState);
    const needsIu = !hasSession(iuState) && !window.__uniStudySync?.connectAll && !window.__uniStudyIU?.isAvailable;
    if (needsEdux || needsIu) {
      setAllCredentials({ needsEdux, needsIu });
      return;
    }
    await synchronizeAll();
  }
  async function reload() {
    await Promise.all([
      sources.execute(),

      iu.execute(),
      edux.execute(),
      outlook.execute(),
      health.execute(),
      courses.execute(),
    ]);
    window.dispatchEvent(new Event("workspace-updated"));
  }
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController(), version = generation.current;
    watcher.current = controller;
    const show = (job) => {
      if (!controller.signal.aborted && generation.current === version) { setAllJob(job); setAllResults(job.results); }
    };
    (async () => {
      try {
        const latest = unwrapResponse(await syncApi.status());
        if (controller.signal.aborted || generation.current !== version || !latest?.jobId) return;
        show(latest);
        if (liveStates.includes(latest.status)) {
          await syncApi.watch(latest, { signal: controller.signal, onProgress: show });
          if (!controller.signal.aborted && generation.current === version) await reload();
        }
      } catch (error) {
        if (controller.signal.aborted || generation.current !== version || error.name === "AbortError") return;
        if (error.lastJob) show({ ...error.lastJob, status: "UNKNOWN", message: "Không theo dõi được tiến trình. Dữ liệu vẫn có thể đang được đồng bộ.",
          results: Object.fromEntries(Object.entries(error.lastJob.results || {}).map(([key, item]) => [key, liveStates.includes(item.status)
            ? { ...item, status: "UNKNOWN", ok: false, message: "Chưa xác nhận kết quả đồng bộ." } : item])) });
      }
    })();
    return () => { mounted.current = false; controller.abort(); };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      sources.execute();
      iu.execute();
      edux.execute();
      outlook.execute();
    }, 10000);
    return () => clearInterval(timer);
  }, [sources.execute, iu.execute, edux.execute, outlook.execute]);
  const sourceList = responseList(sources.data, "sources"),
    current = responseList(courses.data, "courses");
  return (
    <div className="page sync-page">
      <PageHeader
        eyebrow="MỌI THỨ LUÔN LIỀN MẠCH"
        title="Đồng bộ dữ liệu"
        description="Một lần bấm để kết nối và đồng bộ IU, EDUX, Outlook."
      >
        <Link className="btn btn-outline" to="/settings?section=data">Xóa dữ liệu</Link>
        <Button
          variant="outline"
          disabled={actionBusy}
          onClick={() =>
            run(async () => {
              await syncApi.refresh();
              await reload();
            }, "Đã làm mới dữ liệu")
          }
        >
          <RefreshCw size={14} />
          Làm mới
        </Button>
        <Button
          disabled={actionBusy}
          onClick={() => run(beginAll, null)}
        >
          Đồng bộ tất cả
        </Button>
      </PageHeader>
      {actionBusy && <p role="status">Đang kết nối và đồng bộ. Hoàn tất đăng nhập Microsoft nếu có yêu cầu.</p>}
      <Card title="Thời khóa biểu & học kỳ">
        <p>Lịch các học kỳ cũ được giữ để xem lại. Lịch mới cập nhật riêng; lỗi kết nối, lịch rỗng hoặc dữ liệu không hợp lệ sẽ giữ bản đã lưu.</p>
        {courses.data?.timetableSync && <p role="status">{courses.data.timetableSync.message}
          {courses.data.timetableSync.historyCount > 0 ? ` Có ${courses.data.timetableSync.historyCount} lịch đã qua trong lịch sử.` : ''}
        </p>}
        <Link to="/schedule">Xem thời khóa biểu và lịch cũ</Link>
      </Card>
      {allResults && (
        <Card title="Kết quả đồng bộ cả 3">
          {allJob?.progress && <>
            <progress aria-label="Tiến độ đồng bộ" value={allJob.progress.completed} max={allJob.progress.total || 3} />
            <p>{allJob.progress.completed}/{allJob.progress.total} nguồn đã xử lý{allJob.activeSource && liveStates.includes(allJob.status) ? " · Đang đồng bộ " + allJob.activeSource : ""}</p>
          </>}
          {allJob?.message && <p className="hint">{allJob.message}</p>}
          {definitions.map(([key, name]) => (
            <p key={key}>{name}: {resultLabel(allResults[key])}{allResults[key]?.message ? " — " + allResults[key].message : ""}</p>
          ))}
        </Card>
      )}
      <Card region="B" aria-label="B. Trạng thái kết nối hệ thống">
        <div className="filter-bar">
          <div className="actions">
            <HeartPulse size={18} />
            <strong>{desktop ? 'Trạng thái ứng dụng' : 'Trạng thái máy chủ'}</strong>
          </div>
          <Badge
            variant={
              health.error ? "danger" : health.loading ? "default" : "success"
            }
            label={
              health.error
                ? (desktop ? 'Không đọc được dữ liệu' : 'Backend offline')
                : health.loading
                  ? "Đang kiểm tra..."
                  : (desktop ? 'Sẵn sàng' : 'Backend online')
            }
          />
          <Button variant="ghost" size="sm" onClick={health.refetch}>
            Kiểm tra lại
          </Button>
        </div>
        {health.error && (
          <p className="hint">
            {desktop ? 'Hãy thử lại hoặc mở lại ứng dụng.' : 'Kiểm tra backend tại địa chỉ đã cấu hình trong VITE_API_URL.'}
          </p>
        )}
      </Card>
      <ApiContent state={sources}>
        <div className="three-columns" data-region="C" aria-label="C. Các nguồn đồng bộ">
          {definitions.map(([key, name, desc, Icon]) => {
            const connection =
              key === "iu" ? iu : key === "edux" ? edux : outlook;
            const info = connection.data || {};
            const source =
              sourceList.find(
                (s) =>
                  (s.key || s.id || s.source || s.name)
                    ?.toString()
                    .toLowerCase() === key,
              ) || {};
            const connected =
              info.connected ??
              info.hasSession ??
              info.has_session ??
              source.connected;
            const syncing =
              info.syncing || source.syncing || allResults?.[key]?.status === "RUNNING";
            return (
              <article className="card connection-card" key={key}>
                <div className="filter-bar">
                  <div className="connection-icon">
                    <Icon size={24} />
                  </div>
                  <Badge
                    variant={
                      connection.error
                        ? "danger"
                        : syncing
                          ? "info"
                          : connected
                            ? "success"
                            : "default"
                    }
                    label={
                      connection.error
                        ? "Lỗi kết nối"
                        : syncing
                          ? "Đang đồng bộ"
                          : connected
                            ? "Đã kết nối"
                            : "Chưa kết nối"
                    }
                  />
                </div>
                <h2>{name}</h2>
                <p>{desc}</p>
                <p className="hint">Lần đồng bộ cuối: {formatDateTime(info.lastSync || info.last_sync || info.lastSyncedAt || info.last_synced_at || source.lastSync || source.last_sync || source.lastSyncedAt || source.last_synced_at)}</p>
                {info.message && <p>{info.message}</p>}
                <div className="actions">
                  {key !== "outlook" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionBusy}
                      onClick={() => {
                        if (key !== "iu") return setSession(key);
                        run(async () => {
                          if (await syncApi.iu.connect()) await reload();
                          else setSession(key);
                        }, null);
                      }}
                    >
                      <LinkIcon size={13} />
                      {connected ? "Cập nhật phiên" : "Kết nối"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={actionBusy || syncing}
                    onClick={() =>
                      run(async () => {
                        await (key === "outlook"
                          ? emailApi.sync()
                          : syncApi[key].pull());
                        await reload();
                      }, "Đã yêu cầu đồng bộ " + name)
                    }
                  >
                    <RefreshCw size={13} />
                    Đồng bộ
                  </Button>
                  {connected && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={"Ngắt " + name}
                      disabled={actionBusy}
                      onClick={() =>
                        setDisconnect({ key, title: key === 'edux' ? 'tài khoản EDUX đã lưu và các bài tập EDUX' : "phiên " + name })
                      }
                    >
                      <Unplug size={14} />
                    </Button>
                  )}
                </div>
                {key === "outlook" && !connected && (
                  <p>
                    Kết nối Outlook qua luồng đăng nhập email của hệ thống hiện
                    có.
                  </p>
                )}
                {key === "iu" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={actionBusy}
                    onClick={() => setGroup(true)}
                  >
                    Chọn nhóm lớp IU
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      </ApiContent>
      <div className="two-columns">
        <Card title="Môn học hiện tại">
          <ApiContent state={courses} empty={!current.length}>
            {current.map((c, i) => (
              <div className="summary-line" key={c.id || c.subject_id || i}>
                <span>
                  {c.subjectName || c.subject_name || c.subject || c.name}
                </span>
                <Badge
                  label={c.subject_code || c.subjectCode || c.code || "Môn học"}
                />
              </div>
            ))}
          </ApiContent>
        </Card>
        <Card title="Kết nối một lần cho cả ba nguồn">
          <p>Bấm Đồng bộ tất cả để đăng nhập nguồn chưa kết nối và lấy dữ liệu mới nhất từ IU, EDUX, Outlook.</p>
          <p className="hint">Phiên đăng nhập được giữ tại ứng dụng và máy chủ. Mật khẩu không được lưu trên trình duyệt.</p>
          {allJob?.finishedAt && <p>Lần hoàn tất gần nhất: {formatDateTime(allJob.finishedAt)}</p>}
        </Card>
      </div>
      <Modal isOpen={!!allCredentials} title="Kết nối & đồng bộ cả 3" onClose={() => setAllCredentials(null)}>
        {allCredentials && <AllConnectionsForm {...allCredentials} onClose={() => setAllCredentials(null)} onSubmit={(options) => run(() => synchronizeAll(options), "Đã đồng bộ IU, EDUX và Outlook")} />}
      </Modal>
      <Modal
        isOpen={!!session}
        title={"Kết nối " + session?.toUpperCase()}
        onClose={() => setSession(null)}
      >
        {session && (
          <SessionForm
            source={session}
            onClose={() => setSession(null)}
            onSaved={async () => {
              setSession(null);
              await reload();
            }}
          />
        )}
      </Modal>
      <ConfirmModal
        item={disconnect}
        busy={actionBusy}
        onClose={() => setDisconnect(null)}
        onConfirm={() =>
          run(async () => {
            await (disconnect.key === "outlook"
              ? emailApi.deleteSession()
              : syncApi[disconnect.key].deleteSession());
            setDisconnect(null);
            await reload();
          }, "Đã ngắt kết nối")
        }
      />
      <Modal isOpen={group} title="Nhóm lớp IU" onClose={() => setGroup(false)}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await syncApi.iu.group({ nhom: groupValue });
              setGroup(false);
              await reload();
            }, "Đã chọn nhóm lớp");
          }}
        >
          <Field
            label="Nhóm lớp"
            value={groupValue}
            onChange={(e) => setGroupValue(e.target.value)}
            required
          />
          <Button type="submit" disabled={actionBusy}>
            Lưu nhóm lớp
          </Button>
        </form>
      </Modal>
    </div>
  );
}
function AllConnectionsForm({ needsEdux, needsIu, onSubmit, onClose }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [iuValue, setIuValue] = useState(""),
    [error, setError] = useState(null);
  return (
    <form className="stack" onSubmit={(event) => {
      event.preventDefault();
      setError(null);
      const options = {};
      if (needsEdux) options.edux = { email: email.trim(), password };
      if (needsIu && iuValue.trim()) {
        try {
          options.iu = JSON.parse(iuValue);
          if (!options.iu?.session || !options.iu?.cookie) throw new Error();
        } catch {
          setError(new Error("Dữ liệu phiên IU phải là JSON có session và cookie."));
          return;
        }
      }
      setPassword("");
      setIuValue("");
      onSubmit(options);
    }}>
      <p>Luồng chung sẽ đăng nhập các nguồn chưa kết nối rồi đồng bộ cả ba. Trong ứng dụng Electron, hoàn tất cửa sổ Microsoft hoặc MFA khi được yêu cầu.</p>
      {error && <ErrorState error={error} />}
      {needsEdux && <>
        <Field label="Email EDUX" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <Field label="Mật khẩu EDUX" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      </>}
      {needsIu && <>
        <p className="hint">Trình duyệt web cần phiên IU có sẵn; dùng ứng dụng Electron để tự mở đăng nhập Microsoft. Có thể để trống để tiếp tục với các nguồn khác.</p>
        <Field label="Dữ liệu phiên IU"><textarea rows="5" value={iuValue} onChange={(event) => setIuValue(event.target.value)} spellCheck={false} autoComplete="off" /></Field>
      </>}
      <p className="hint">Tài khoản EDUX được lưu trên máy này để tự đăng nhập lại khi mở ứng dụng. Ngắt kết nối sẽ xóa tài khoản đã lưu.</p>
      <div className="form-actions">
        <Button variant="outline" onClick={onClose}>Hủy</Button>
        <Button type="submit">Kết nối & đồng bộ</Button>
      </div>
    </form>
  );
}

function SessionForm({ source, onSaved, onClose }) {
  const [value, setValue] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
          let data;
          if (source === "edux") {
            data = { email: email.trim(), password };
          } else {
            try {
              data = JSON.parse(value);
            } catch {
              throw new Error("Dữ liệu phiên IU phải là JSON hợp lệ.");
            }
            if (!data?.session || !data?.cookie)
              throw new Error("Phiên IU cần có session và cookie.");
          }
          await syncApi[source].createSession(data);
          setPassword("");
          await onSaved();
        } catch (err) {
          setError(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <ErrorState error={error} title="Chưa kết nối được" />}
      {source === "edux" ? (
        <>
          <Field
            label="Email EDUX"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Mật khẩu EDUX"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="hint">
            Tài khoản EDUX được lưu trên máy này để tự đăng nhập lại khi mở ứng dụng.
            Ngắt kết nối sẽ xóa tài khoản đã lưu.
          </p>
        </>
      ) : (
        <>
          <p className="hint">
            Dán dữ liệu phiên từ luồng đăng nhập IU hiện có. Đối tượng phiên gồm
            session và cookie.
          </p>
          <Field label="Dữ liệu phiên IU">
            <textarea
              rows="7"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              spellCheck={false}
              autoComplete="off"
            />
          </Field>
        </>
      )}
      <div className="form-actions">
        <Button variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Đang kết nối..." : "Kết nối"}
        </Button>
      </div>
    </form>
  );
}
