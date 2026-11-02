import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Save, Trash2 } from "lucide-react";
import { pomodoroApi } from "../../api";
import { useApi } from "../../hooks/useApi";
import { responseList } from "../../api/apiClient";
import {
  Card,
  Button,
  Tabs,
  ApiContent,
  ConfirmModal,
  useAction,
} from "../common/ui";
import { formatDateTime, isToday } from "../../utils/date";
import foxAssets from "../../assets/foxAssets";
const alarm = new URL(
  "../../assets/pomodoro-chime.wav",
  import.meta.url,
).href;
const SESSION_KEY = "smart-study-hub:pomodoro:v1";
function readSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    if (!saved || !["focus", "break"].includes(saved.mode) ||
        !Number.isFinite(saved.remaining) || !Number.isFinite(saved.start) ||
        !saved.sessionId || !Array.isArray(saved.segments)) return null;
    const total = saved.mode === "focus" ? 1500 : 300;
    saved.remaining = Math.max(0, Math.min(total, saved.remaining));
    if (saved.running && Number.isFinite(saved.end)) {
      saved.remaining = Math.max(0, Math.ceil((saved.end - Date.now()) / 1000));
      if (saved.remaining === 0) {
        if (Number.isFinite(saved.segment) && saved.end > saved.segment)
          saved.segments.push({ start: new Date(saved.segment).toISOString(), end: new Date(saved.end).toISOString() });
        saved.segment = null;
        saved.running = false;
        saved.pending = saved.mode === "focus";
      }
    }
    return saved;
  } catch {
    return null;
  }
}
export default function PomodoroTimer() {
  const history = useApi(pomodoroApi.list),
    { run, busy } = useAction();
  const [saved] = useState(readSession);
  const [mode, setMode] = useState(saved?.mode || "focus"),
    [remaining, setRemaining] = useState(saved?.remaining ?? 1500),
    [running, setRunning] = useState(saved?.running || false),
    [pending, setPending] = useState(saved?.pending || false),
    [clearing, setClearing] = useState(false);
  const end = useRef(saved?.end || 0),
    start = useRef(saved?.start ?? null),
    segment = useRef(saved?.segment ?? null),
    segments = useRef(saved?.segments || []),
    sessionId = useRef(saved?.sessionId || null);
  function closeSegment(at = Date.now()) {
    if (segment.current !== null) {
      if (at > segment.current)
        segments.current.push({
          start: new Date(segment.current).toISOString(),
          end: new Date(at).toISOString(),
        });
      segment.current = null;
    }
  }
  function reset(v = mode) {
    setRunning(false);
    setMode(v);
    setRemaining(v === "focus" ? 1500 : 300);
    start.current = null;
    segment.current = null;
    segments.current = [];
    sessionId.current = null;
    end.current = 0;
    setPending(false);
  }
  function toggle() {
    if (running) {
      const now = Date.now();
      closeSegment(Math.min(now, end.current));
      setRemaining(Math.max(0, Math.ceil((end.current - now) / 1000)));
      setRunning(false);
    } else {
      const now = Date.now();
      if (start.current === null) {
        start.current = now;
        sessionId.current = crypto.randomUUID();
      }
      segment.current = now;
      end.current = now + remaining * 1000;
      setRunning(true);
    }
  }
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((end.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        closeSegment(end.current);
        setRunning(false);
        if (mode === "focus") setPending(true);
        new Audio(alarm).play().catch(() => {});
      }
    }, 250);
    return () => clearInterval(timer);
  }, [running, mode]);
  useEffect(() => {
    try {
      if (start.current === null) {
        sessionStorage.removeItem(SESSION_KEY);
        return;
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        mode, remaining, running, pending,
        end: end.current, start: start.current, segment: segment.current,
        segments: segments.current, sessionId: sessionId.current,
      }));
    } catch {
      // Browsers with storage disabled still support the current timer.
    }
  }, [mode, remaining, running, pending]);
  const rows = responseList(history.data, "sessions");
  const todaySessions = rows.filter(r => isToday(r.startTime || r.createdAt || r.created_at));
  const todayMinutes = Math.round(todaySessions.reduce((sum, row) => sum + Number(row.actualStudySeconds || 0), 0) / 60);
  const seconds = () =>
    segments.current.reduce(
      (n, s) => n + (Date.parse(s.end) - Date.parse(s.start)) / 1000,
      0,
    );
  return (
    <div className="two-columns">
      <Card className="pomodoro-widget">
        <img src={foxAssets["fox-pomodoro.png"]} alt="" />
        <Tabs
          items={[
            ["focus", "Tập trung"],
            ["break", "Nghỉ ngắn"],
          ]}
          value={mode}
          onChange={(v) => reset(v)}
        />
        <div className="timer-value">
          {String(Math.floor(remaining / 60)).padStart(2, "0")}:
          {String(remaining % 60).padStart(2, "0")}
        </div>
        <p className="timer-mode">
          {running
            ? "Một việc thôi, thật tập trung."
            : "Sẵn sàng cho một phiên học hiệu quả?"}
        </p>
        <div className="actions" style={{ margin: "20px 0" }}>
          <Button onClick={toggle} disabled={remaining === 0 || pending}>
            {running ? <Pause size={16} /> : <Play size={16} />}
            {running ? "Tạm dừng" : "Bắt đầu"}
          </Button>
          <Button
            variant="outline"
            aria-label="Đặt lại đồng hồ"
            onClick={() => reset()}
          >
            <RotateCcw size={16} />
          </Button>
        </div>
        <Button
          variant="outline"
          disabled={busy || mode !== "focus" || start.current === null}
          onClick={() => {
            closeSegment(running ? Math.min(Date.now(), end.current) : Date.now());
            setRunning(false);
            setPending(true);
          }}
        >
          <Save size={14} />
          Lưu phiên học
        </Button>
        <p className="hint">
          Thời gian tạm dừng không được tính vào thời gian tập trung. Phiên đang học
          được giữ khi chuyển trang trong tab này; hãy lưu để thêm vào lịch sử.
        </p>
        <div className="pomodoro-today" aria-label="Thống kê tập trung hôm nay">
          <span><strong>{history.loading || history.error ? "—" : todaySessions.length}</strong> Pomodoro hôm nay</span>
          <span><strong>{history.loading || history.error ? "—" : todayMinutes}</strong> phút tập trung</span>
        </div>
      </Card>
      <Card
        title="Lịch sử tập trung"
        action={
          <Button
            variant="ghost"
            aria-label="Xóa lịch sử Pomodoro"
            onClick={() => setClearing(true)}
          >
            <Trash2 size={15} />
          </Button>
        }
      >
        <ApiContent state={history} empty={!rows.length}>
          {rows.map((r, i) => (
            <div className="history-row" key={r.id || i}>
              <span>
                Phiên tập trung
                <small className="muted" style={{ display: "block" }}>
                  {formatDateTime(r.createdAt || r.startTime || r.created_at)}
                </small>
              </span>
              <strong>
                {Math.round((Number(r.actualStudySeconds || 0) / 60) * 10) / 10}{" "}
                phút
              </strong>
            </div>
          ))}
        </ApiContent>
      </Card>
      <ConfirmModal
        item={clearing ? { title: "toàn bộ lịch sử Pomodoro" } : null}
        busy={busy}
        onClose={() => setClearing(false)}
        onConfirm={() =>
          run(async () => {
            await pomodoroApi.remove();
            setClearing(false);
            await history.refetch();
          }, "Đã xóa lịch sử")
        }
      />
      {pending && (
        <Card title="Lưu phiên vừa học">
          <p>{Math.round((seconds() / 60) * 10) / 10} phút tập trung</p>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setPending(false)}>
              Tiếp tục sau
            </Button>
            <Button
              disabled={busy || seconds() < 1}
              onClick={() =>
                run(async () => {
                  await pomodoroApi.create({
                    id: sessionId.current,
                    startTime: new Date(start.current).toISOString(),
                    endTime: new Date().toISOString(),
                    actualStudySeconds: seconds(),
                    focusSegments: segments.current,
                    workDurationMinutes: 25,
                    status: remaining === 0 ? "Hoàn thành" : "Kết thúc sớm",
                  });
                  reset();
                  await history.refetch();
                }, "Đã lưu phiên học")
              }
            >
              Lưu phiên học
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
