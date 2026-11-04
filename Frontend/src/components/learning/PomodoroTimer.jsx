import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Save, Trash2 } from "lucide-react";
import { pomodoroApi } from "../../api";
import { useApi } from "../../hooks/useApi";
import { responseList, unwrapResponse } from "../../api/apiClient";
import {
  Card,
  Button,
  Tabs,
  ApiContent,
  ConfirmModal,
  EmptyState,
  Modal,
  Field,
  useAction,
} from "../common/ui";
import { formatDateTime } from "../../utils/date";
import { POMODORO_SESSION_KEY as SESSION_KEY, POMODORO_PRESETS, breakMinutes, emptyLearningContext, focusSeconds, readPomodoroSession, todayFocusStats, weeklyFocusSummary, pomodoroConflicts, unfinishedPomodoroGoal } from "../../utils/pomodoro";
import { usePomodoroPlan } from "./usePomodoroPlan";
import PomodoroGoalSuggestions from "./PomodoroGoalSuggestions";
import foxAssets from "../../assets/foxAssets";
import { sameLearningSubject } from '../../utils/learningFlow';
import "./PomodoroTimer.css";
const alarm = new URL(
  "../../assets/pomodoro-chime.wav",
  import.meta.url,
).href;
export default function PomodoroTimer({ onReview, initialContext = null, initialMinutes = 25 }) {
  const history = useApi(pomodoroApi.list),
    { run, busy } = useAction();
  const plan = usePomodoroPlan();
  const [saved] = useState(readPomodoroSession);
  const duration = [15, 25, 50].find(value => value >= Number(initialMinutes)) || 50;
  const [workMinutes, setWorkMinutes] = useState(saved?.workMinutes || duration);
  const [learningContext, setLearningContext] = useState(saved?.learningContext || { ...emptyLearningContext(), ...initialContext });
  const [completeTask, setCompleteTask] = useState(saved?.completeTask || false);
  const [lastSaved, setLastSaved] = useState(null);
  const [startWarning, setStartWarning] = useState(null), [checking, setChecking] = useState(false);
  const [historySubject, setHistorySubject] = useState("");
  const [autoAnalyzeGoal, setAutoAnalyzeGoal] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [mode, setMode] = useState(saved?.mode || "focus"),
    [remaining, setRemaining] = useState(saved?.remaining ?? duration * 60),
    [running, setRunning] = useState(saved?.running || false),
    [pending, setPending] = useState(saved?.pending || false),
    [changing, setChanging] = useState(null),
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
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* The in-memory session still resets. */ }
    setRunning(false);
    setMode(v);
    setRemaining((v === "focus" ? workMinutes : breakMinutes(workMinutes)) * 60);
    start.current = null;
    segment.current = null;
    segments.current = [];
    sessionId.current = null;
    end.current = 0;
    setPending(false);
    setChanging(null);
    setCompleteTask(false);
    setAutoAnalyzeGoal(false);
    setLearningContext(context => ({ ...context, outcome: "UNRECORDED", reflection: "", nextStep: "", microGoals: (context.microGoals || []).map(step => ({ ...step, completed: false })) }));
  }
  const seconds = () => focusSeconds(segments.current);
  function pauseTimer() {
    if (!running) return remaining;
    const now = Date.now();
    closeSegment(Math.min(now, end.current));
    const left = Math.max(0, Math.ceil((end.current - now) / 1000));
    setRemaining(left);
    setRunning(false);
    return left;
  }
  function requestReset(nextMode) {
    const activeSeconds = running && segment.current !== null
      ? Math.max(0, Math.min(Date.now(), end.current) - segment.current) / 1000 : 0;
    if (mode === "focus" && seconds() + activeSeconds >= 1) {
      pauseTimer();
      setPending(false);
      setChanging({ mode: nextMode });
    } else reset(nextMode);
  }
  function saveSession(nextMode = mode) {
    return run(async () => {
      if (mode !== "focus" || seconds() < 1) throw new Error("Hãy tập trung ít nhất một giây trước khi lưu.");
      const savedContext = { ...learningContext };
      const response = await pomodoroApi.create({
        id: sessionId.current,
        startTime: new Date(start.current).toISOString(),
        endTime: segments.current.at(-1).end,
        actualStudySeconds: seconds(),
        focusSegments: segments.current,
        workDurationMinutes: workMinutes,
        status: remaining === 0 ? "Hoàn thành" : "Kết thúc sớm",
        learningContext: { ...learningContext, subjectId: learningContext.subjectId ? Number(learningContext.subjectId) : null },
        completeTask: completeTask && learningContext.outcome === "DONE" && Boolean(learningContext.taskId),
      });
      const result = unwrapResponse(response);
      const acceptedContext = { ...savedContext, ...(result.learningContext || {}) };
      setLastSaved({ ...result, learningContext: acceptedContext });
      reset(nextMode);
      setLearningContext({ ...acceptedContext, goal: acceptedContext.outcome === "CONTINUE" ? (acceptedContext.nextStep || acceptedContext.goal).slice(0, 300) : "", outcome: "UNRECORDED", reflection: "", nextStep: "", microGoals: [] });
      await history.refetch();
      plan.refetch();
      window.dispatchEvent(new Event("workspace-updated"));
    }, "Đã lưu phiên học");
  }
  function begin() {
    const now = Date.now();
    if (start.current === null) { start.current = now; sessionId.current = crypto.randomUUID(); }
    segment.current = now;
    end.current = now + remaining * 1000;
    setRunning(true);
    setStartWarning(null);
  }
  function checkStart(data) {
    const conflicts = mode === "focus" ? pomodoroConflicts(data?.classes || [], data?.exams || [], remaining / 60) : [];
    if (mode === "focus" && (!data?.scheduleKnown || conflicts.length)) setStartWarning({ conflicts, known: Boolean(data?.scheduleKnown), data });
    else begin();
  }
  function toggle() {
    if (running) {
      if (pauseTimer() === 0 && mode === "focus") setPending(true);
    } else {
      if (mode === "break" || !plan.data || Date.now() - (plan.data?.checkedAt || 0) <= 60000) checkStart(plan.data);
      else { setChecking(true); plan.execute().then(data => { if (mounted.current) checkStart(data); }).finally(() => { if (mounted.current) setChecking(false); }); }
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
        workMinutes, learningContext, completeTask,
        end: end.current, start: start.current, segment: segment.current,
        segments: segments.current, sessionId: sessionId.current,
      }));
    } catch {
      // Browsers with storage disabled still support the current timer.
    }
  }, [mode, remaining, running, pending, workMinutes, learningContext, completeTask]);
  const rows = responseList(history.data, "sessions");
  const today = todayFocusStats(rows);
  const weekly = weeklyFocusSummary(rows);
  const tasks = plan.data?.tasks || [], subjects = plan.data?.subjects || [];
  const locked = start.current !== null || busy || checking;
  const contextField = key => ({ value: learningContext[key] || "", onChange: event => {
    if (key === "goal") setAutoAnalyzeGoal(true);
    setLearningContext(context => ({ ...context, [key]: event.target.value, ...(key === "goal" ? { microGoals: [] } : {}) }));
  } });
  function selectTask(key) {
    const task = tasks.find(task => task.key === key);
    setAutoAnalyzeGoal(true);
    setLearningContext(context => task ? { ...context, microGoals: [], taskId: String(task.id), taskSource: task.source, taskTitle: task.title,
      subjectId: task.source === "PERSONAL" ? task.subjectId || "" : "", subjectName: task.subject,
      goal: !context.goal || context.goal === `Làm tiếp: ${context.taskTitle}`.slice(0, 300) ? `Làm tiếp: ${task.title}`.slice(0, 300) : context.goal } : { ...context, microGoals: [], taskId: "", taskSource: null, taskTitle: "", subjectName: context.subjectId ? context.subjectName : "" });
  }
  function choosePreset(minutes) { setWorkMinutes(minutes); setRemaining((mode === "focus" ? minutes : breakMinutes(minutes)) * 60); setLearningContext(context => ({ ...context, microGoals: [] })); }
  const unfinished = unfinishedPomodoroGoal(rows);
  useEffect(() => {
    if (historySubject && !rows.some(row => (row.learningContext?.subjectName || "Chưa phân loại") === historySubject)) setHistorySubject("");
  }, [rows, historySubject]);
  useEffect(() => {
    if (locked || plan.loading || !plan.data) return;
    const selectedTask = tasks.find(task => task.source === learningContext.taskSource && String(task.id) === learningContext.taskId);
    const namedSubject = !learningContext.subjectId && !learningContext.taskId && subjects.find(subject => sameLearningSubject(subject.subject_name, learningContext.subjectName));
    if (namedSubject || selectedTask && !learningContext.taskTitle) {
      setLearningContext(context => ({ ...context, ...(namedSubject ? { subjectId: String(namedSubject.subject_id), subjectName: namedSubject.subject_name } : {}),
        ...(selectedTask ? { taskTitle: selectedTask.title } : {}) }));
    }
    const staleTask = learningContext.taskId && !tasks.some(task => task.source === learningContext.taskSource && String(task.id) === learningContext.taskId);
    const staleSubject = learningContext.subjectId && !subjects.some(subject => String(subject.subject_id) === String(learningContext.subjectId));
    if (staleTask || staleSubject) {
      setLearningContext(context => ({ ...context, subjectId: "", subjectName: "", taskId: "", taskSource: null, taskTitle: "", microGoals: [] }));
      setAutoAnalyzeGoal(false);
    }
  }, [locked, plan.loading, plan.data, learningContext.taskId, learningContext.taskSource, learningContext.subjectId, learningContext.subjectName, learningContext.taskTitle]);
  function resumeGoal(row) {
    const currentTask = tasks.find(task => task.source === row.learningContext.taskSource && String(task.id) === row.learningContext.taskId);
    const currentSubject = subjects.find(subject => String(subject.subject_id) === String(row.learningContext.subjectId));
    setLearningContext({ ...emptyLearningContext(), ...row.learningContext,
      ...(!currentTask ? { taskId: "", taskSource: null, taskTitle: "" } : {}), ...(!currentSubject && !currentTask ? { subjectId: "", subjectName: "" } : {}),
      goal: (row.learningContext.nextStep || row.learningContext.goal).slice(0, 300), outcome: "UNRECORDED", reflection: "", nextStep: "", microGoals: [] });
    reset("focus");
    setAutoAnalyzeGoal(true);
  }
  const review = (tab, context) => {
    if (onReview) onReview(tab, context);
    else window.location.assign(`/learning?tab=${tab === "flashcard" ? "flashcards" : "quiz"}&subject=${encodeURIComponent(context.subjectName || "")}&topic=${encodeURIComponent(context.topic || context.goal || "")}`);
  };
  return (
    <div className="pomodoro-layout">
      <Card className="pomodoro-widget focus-timer-card">
        <div className="pomodoro-heading">
          <img src={foxAssets["fox-pomodoro.png"]} alt="" />
          <div><h2>Một phiên, một việc</h2><p>{workMinutes} phút tập trung · {breakMinutes(workMinutes)} phút nghỉ ngắn</p></div>
        </div>
        <div className="pomodoro-presets" aria-label="Chọn nhịp học">
          {POMODORO_PRESETS.map(preset => <Button key={preset.work} size="sm" variant={workMinutes === preset.work ? "primary" : "outline"} disabled={locked} aria-pressed={workMinutes === preset.work} onClick={() => choosePreset(preset.work)}>{preset.work} phút</Button>)}
        </div>
        {learningContext.goal && <p className="pomodoro-active-goal"><strong>Mục tiêu:</strong> {learningContext.goal}</p>}
        {saved && initialContext?.goal && initialContext.goal !== learningContext.goal && <div className="stack"><p className="hint">Phiên trước đang được giữ. Lưu hoặc đặt lại phiên trước để dùng mục tiêu vừa chọn: {initialContext.goal}</p><Button size="sm" variant="outline" disabled={locked} onClick={() => { setLearningContext({ ...emptyLearningContext(), ...initialContext }); choosePreset(duration); }}>Dùng mục tiêu vừa chọn</Button></div>}
        <Tabs
          items={[
            ["focus", "Tập trung"],
            ["break", "Nghỉ ngắn"],
          ]}
          value={mode}
          onChange={(v) => { if (v !== mode && !busy && !checking) requestReset(v); }}
        />
        <div className="timer-value" role="timer" aria-label={mode === "focus" ? "Thời gian tập trung còn lại" : "Thời gian nghỉ còn lại"}>
          {String(Math.floor(remaining / 60)).padStart(2, "0")}:
          {String(remaining % 60).padStart(2, "0")}
        </div>
        <p className="timer-mode">
          {running
            ? mode === "focus" ? "Một việc thôi, thật tập trung." : "Thả lỏng và nghỉ mắt một chút."
            : remaining === 0 ? mode === "focus" ? "Đã hoàn thành phiên tập trung. Hãy lưu kết quả." : "Đã nghỉ xong. Sẵn sàng cho phiên tập trung mới."
              : start.current !== null ? "Đã tạm dừng. Thời gian nghỉ không tính vào phiên học." : "Chọn một việc nhỏ và bắt đầu nhé."}
        </p>
        <div className="actions pomodoro-controls">
          <Button onClick={toggle} disabled={busy || checking || remaining === 0 || pending || !!changing}>
            {running ? <Pause size={16} /> : <Play size={16} />}
            {running ? "Tạm dừng" : checking ? "Đang kiểm tra lịch..." : "Bắt đầu"}
          </Button>
          <Button
            variant="outline"
            aria-label="Đặt lại đồng hồ"
            disabled={busy || checking}
            onClick={() => requestReset(mode)}
          >
            <RotateCcw size={16} />
          </Button>
          <Button
            variant="outline"
            disabled={busy || mode !== "focus" || start.current === null}
            onClick={() => {
              pauseTimer();
              setPending(true);
            }}
          >
            <Save size={14} />
            Lưu phiên học
          </Button>
        </div>
        <p className="hint">
          Thời gian tạm dừng không được tính vào thời gian tập trung. Phiên đang học
          được giữ khi chuyển trang trong tab này; hãy lưu để thêm vào lịch sử.
        </p>
        <div className="pomodoro-today" aria-label="Thống kê tập trung hôm nay">
          <span><strong>{history.loading || history.error ? "—" : today.sessions}</strong> phiên đã lưu hôm nay</span>
          <span><strong>{history.loading || history.error ? "—" : today.minutes}</strong> phút thực học hôm nay</span>
        </div>
      </Card>
      <div className="pomodoro-side">
      <Card title="Bạn sẽ làm gì trong phiên này?" className="pomodoro-plan">
        <ApiContent state={plan}>
          <p className="hint">{plan.data?.termLabel ? `Môn kỳ hiện tại: ${plan.data.termLabel}` : plan.data?.currentCourseMessage || 'Chỉ các môn đang học trong kỳ hiện tại.'}</p>
          <Field label="Môn cho phiên học">
            <select disabled={locked || Boolean(learningContext.taskId)} value={learningContext.subjectId || ""} onChange={event => {
              const subject = subjects.find(subject => String(subject.subject_id ?? subject.id) === event.target.value);
              setLearningContext(context => ({ ...context, microGoals: [], subjectId: event.target.value, subjectName: subject?.subject_name || subject?.name || "" }));
            }}><option value="">{learningContext.taskId && learningContext.subjectName ? learningContext.subjectName : "Tự học / chưa phân loại"}</option>{subjects.map(subject => <option key={subject.subject_id ?? subject.id} value={subject.subject_id ?? subject.id}>{subject.subject_name || subject.name}</option>)}</select>
          </Field>
          <Field label="Công việc cần tập trung">
            <select disabled={locked} value={learningContext.taskId ? `${learningContext.taskSource}:${learningContext.taskId}` : ""} onChange={event => selectTask(event.target.value)}>
              <option value="">Tự đặt mục tiêu</option>
              {learningContext.taskId && !tasks.some(task => task.key === `${learningContext.taskSource}:${learningContext.taskId}`) && <option value={`${learningContext.taskSource}:${learningContext.taskId}`}>{learningContext.taskTitle || "Công việc đã chọn"}</option>}
              {tasks.map(task => <option key={task.key} value={task.key}>{task.source === "EDUX" ? "EDUX · " : ""}{task.title}</option>)}
            </select>
          </Field>
          {!locked && tasks.length > 0 && <div className="pomodoro-task-suggestions"><small>Việc gần hạn</small>{tasks.slice(0, 3).map(task => <button type="button" key={task.key} onClick={() => selectTask(task.key)}>{task.title}{task.deadline && <small> · {task.dueLabel}</small>}</button>)}</div>}
          <Field label="Mục tiêu nhỏ của phiên" placeholder="Ví dụ: Hoàn thành 3 bài JOIN" maxLength={300} disabled={locked} {...contextField("goal")} />
          <Field label="Chương/chủ đề ôn lại" placeholder="Ví dụ: Chương 2 hoặc JOIN" maxLength={200} disabled={locked} {...contextField('topic')} />
          <p className="hint">Dùng tên chương/chủ đề trên thẻ để lọc khi ôn lại. Nếu để trống, dùng mục tiêu phiên.</p>
          <PomodoroGoalSuggestions goal={learningContext.goal} subjectId={learningContext.subjectId} taskId={learningContext.taskId} taskSource={learningContext.taskSource}
            durationMinutes={workMinutes} disabled={locked} autoAnalyze={autoAnalyzeGoal} hasPlan={Boolean(learningContext.microGoals?.length)}
            onApply={steps => setLearningContext(context => ({ ...context, microGoals: steps.map((step, index) => ({ ...step, id: `step-${index + 1}`, completed: false })) }))} />
          {learningContext.microGoals?.length > 0 && <div className="pomodoro-micro-goals" aria-label="Các bước của phiên">
            <strong>Đã xong {learningContext.microGoals.filter(step => step.completed).length}/{learningContext.microGoals.length} bước</strong>
            {learningContext.microGoals.map((step, index) => <label key={step.id}><input type="checkbox" disabled={busy} checked={step.completed} onChange={event => {
              const completed = event.target.checked;
              setLearningContext(context => ({ ...context, microGoals: context.microGoals.map((item, i) => i === index ? { ...item, completed } : item) }));
            }} /><span>{step.title} · khoảng {step.minutes} phút<small>Xong khi: {step.doneWhen}</small></span></label>)}
            {!locked && <Button size="sm" variant="ghost" onClick={() => { setLearningContext(context => ({ ...context, microGoals: [] })); setAutoAnalyzeGoal(false); }}>Bỏ các bước gợi ý</Button>}
          </div>}
          {locked && <p className="hint">Mục tiêu được giữ trong suốt phiên. Lưu hoặc đặt lại để chọn việc khác.</p>}
          {plan.data?.unavailable?.length > 0 && <p className="hint">Chưa tải được: {plan.data.unavailable.join(", ")}. <button type="button" onClick={plan.refetch}>Thử lại</button></p>}
          {plan.data?.eduxLoading && <p className="hint">Đang tải thêm bài tập EDUX; bạn vẫn có thể bắt đầu phiên tự học.</p>}
          {!locked && unfinished && <div className="pomodoro-resume"><small>Phần cần làm tiếp</small><p>{unfinished.learningContext.nextStep || unfinished.learningContext.goal}</p><Button size="sm" variant="outline" onClick={() => resumeGoal(unfinished)}>Tiếp tục mục tiêu này</Button></div>}
        </ApiContent>
      </Card>
      {lastSaved && <Card title="Phiên học đã được ghi lại" className="pomodoro-result">
        <p>{lastSaved.learningContext.goal || "Một phiên tự học"}</p>
        <p className="hint">{lastSaved.learningContext.outcome === "DONE" ? "Bạn đã xác nhận đạt mục tiêu." : lastSaved.learningContext.outcome === "CONTINUE" ? "Phần còn lại đã được giữ để học tiếp." : "Có thể ôn lại nhanh để tự kiểm tra kiến thức."}</p>
        <div className="actions"><Button size="sm" variant="outline" onClick={() => review("flashcard", lastSaved.learningContext)}>Ôn flashcard</Button><Button size="sm" variant="outline" onClick={() => review("quiz", lastSaved.learningContext)}>Tự kiểm tra bằng quiz</Button></div>
      </Card>}
      <Card title="Thời gian theo môn · tuần này" className="pomodoro-week">
        {history.loading || history.error ? <p className="hint">Chưa có số liệu tuần.</p> : <><p><strong>{weekly.minutes}</strong> phút thực học · {weekly.sessions} phiên</p>{weekly.subjects.map(subject => <div className="summary-line" key={subject.subject}><span>{subject.subject}</span><small>{subject.minutes} phút · {subject.goalsDone} mục tiêu đã đạt</small></div>)}</>}
      </Card>
      <Card
        className="pomodoro-history"
        title="Lịch sử tập trung"
        action={
          <Button
            variant="ghost"
            aria-label="Xóa lịch sử Pomodoro"
            disabled={busy || history.loading || !!history.error || !rows.length}
            onClick={() => setClearing(true)}
          >
            <Trash2 size={15} />
          </Button>
        }
      >
        <ApiContent state={history}>
          {!rows.length && <EmptyState title="Chưa có phiên tập trung" description="Bắt đầu một việc nhỏ, rồi lưu phiên học để theo dõi thời gian thực học của bạn." />}
          {rows.length > 0 && <Field label="Lọc lịch sử theo môn"><select value={historySubject} onChange={event => setHistorySubject(event.target.value)}><option value="">Tất cả môn</option>{[...new Set(rows.map(row => row.learningContext?.subjectName || "Chưa phân loại"))].map(subject => <option key={subject}>{subject}</option>)}</select></Field>}
          {rows.filter(row => !historySubject || (row.learningContext?.subjectName || "Chưa phân loại") === historySubject).map((r, i) => (
            <div className="history-row" key={r.id || i}>
              <span>
                {r.learningContext?.goal || "Phiên tập trung"}
                {r.learningContext?.subjectName && <small className="pomodoro-history-status">{r.learningContext.subjectName}{r.learningContext.taskTitle ? ` · ${r.learningContext.taskTitle}` : ""}</small>}
                <small className="muted" style={{ display: "block" }}>
                  {formatDateTime(r.createdAt || r.startTime || r.created_at)}
                </small>
                <small className="pomodoro-history-status">{r.status || "Đã lưu"}{r.learningContext?.outcome === "DONE" ? " · Đạt mục tiêu" : r.learningContext?.outcome === "CONTINUE" ? " · Cần học tiếp" : ""}</small>
                {r.learningContext?.microGoals?.length > 0 && <small className="pomodoro-history-status">{r.learningContext.microGoals.filter(step => step.completed).length}/{r.learningContext.microGoals.length} bước đã xong</small>}
                {(r.learningContext?.reflection || r.learningContext?.nextStep) && <details className="pomodoro-history-notes"><summary>Kết quả và bước tiếp theo</summary><p>{r.learningContext.reflection}</p>{r.learningContext.nextStep && <p>Tiếp theo: {r.learningContext.nextStep}</p>}<button type="button" disabled={locked} onClick={() => resumeGoal(r)}>Học tiếp từ phiên này</button></details>}
              </span>
              <strong>
                {Math.round((Number(r.actualStudySeconds || 0) / 60) * 10) / 10}{" "}
                phút
              </strong>
            </div>
          ))}
        </ApiContent>
      </Card>
      </div>
      <ConfirmModal
        item={clearing ? { title: "toàn bộ lịch sử Pomodoro" } : null}
        busy={busy}
        onClose={() => setClearing(false)}
        onConfirm={() =>
          run(async () => {
            await pomodoroApi.remove();
            setClearing(false);
            await history.refetch();
            window.dispatchEvent(new Event("workspace-updated"));
          }, "Đã xóa lịch sử")
        }
      />
      <Modal isOpen={pending} title="Lưu phiên vừa học" onClose={() => { if (!busy) setPending(false); }}>
          <p>{Math.round((seconds() / 60) * 10) / 10} phút tập trung</p>
          <p className="hint">Chỉ tính thời gian tập trung thực tế; thời gian tạm dừng và chờ lưu được loại trừ.</p>
          <p><strong>Mục tiêu:</strong> {learningContext.goal || "Tự học"}</p>
          <Field label="Kết quả phiên học"><select disabled={busy} value={learningContext.outcome} onChange={event => { const outcome = event.target.value; setLearningContext(context => ({ ...context, outcome, nextStep: outcome === "CONTINUE" && !context.nextStep ? (context.microGoals || []).filter(step => !step.completed).map(step => step.title).join('; ').slice(0, 500) : context.nextStep })); setCompleteTask(false); }}><option value="UNRECORDED">Chưa đánh giá</option><option value="DONE">Đã đạt mục tiêu</option><option value="CONTINUE">Cần học tiếp</option></select></Field>
          <Field label="Đã làm được gì?"><textarea disabled={busy} maxLength={1000} {...contextField("reflection")} /></Field>
          {learningContext.outcome === "CONTINUE" && <Field label="Phần cần làm tiếp"><textarea disabled={busy} maxLength={500} placeholder="Ghi một bước nhỏ để lần sau bắt đầu ngay" {...contextField("nextStep")} /></Field>}
          {learningContext.outcome === "DONE" && learningContext.taskId && <label className="pomodoro-complete-task"><input type="checkbox" disabled={busy} checked={completeTask} onChange={event => setCompleteTask(event.target.checked)} />Đánh dấu công việc “{learningContext.taskTitle}” hoàn thành</label>}
          {learningContext.taskSource === "EDUX" && <p className="hint">Trạng thái này theo dõi tiến độ trong Smart Study Hub. Bạn vẫn cần nộp bài trên EDUX.</p>}
          <div className="form-actions">
            <Button variant="outline" disabled={busy} onClick={() => setPending(false)}>
              Tiếp tục sau
            </Button>
            <Button
              disabled={busy || seconds() < 1}
              onClick={() => saveSession()}
            >
              Lưu phiên học
            </Button>
          </div>
      </Modal>
      <Modal isOpen={!!startWarning} title="Kiểm tra lịch trước khi tập trung" onClose={() => setStartWarning(null)}>
        {startWarning?.known ? <><p>Phiên này trùng với lịch đã có:</p>{startWarning.conflicts.map((event, index) => <p key={index}>{event.title} · {new Date(event.start).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}</p>)}</> : <p>Chưa kiểm tra được đầy đủ lịch lớp và lịch thi. Bạn có thể thử tải lại hoặc chủ động bắt đầu.</p>}
        <div className="form-actions"><Button variant="outline" onClick={() => setStartWarning(null)}>Quay lại</Button>
          {start.current === null && startWarning?.known && POMODORO_PRESETS.filter(preset => preset.work < workMinutes && !pomodoroConflicts(startWarning.data.classes, startWarning.data.exams, preset.work).length).map(preset => <Button key={preset.work} variant="outline" onClick={() => { choosePreset(preset.work); setStartWarning(null); }}>Đổi sang {preset.work} phút</Button>)}
          <Button onClick={begin}>Vẫn bắt đầu</Button></div>
      </Modal>
      <Modal isOpen={!!changing} title="Phiên học chưa được lưu" onClose={() => { if (!busy) setChanging(null); }}>
        <p>Bạn đã tập trung {Math.round((seconds() / 60) * 10) / 10} phút. Lưu lại trước khi đổi chế độ hoặc đặt lại đồng hồ?</p>
        <div className="form-actions">
          <Button variant="outline" disabled={busy} onClick={() => setChanging(null)}>Giữ phiên hiện tại</Button>
          <Button variant="danger" disabled={busy} onClick={() => reset(changing.mode)}>Bỏ phiên chưa lưu</Button>
          <Button disabled={busy} onClick={() => saveSession(changing.mode)}>Lưu và tiếp tục</Button>
        </div>
      </Modal>
    </div>
  );
}
