import { useState, useRef, useEffect } from "react";
import {
  ArrowUp,
  Bot,
  Sparkles,
  CalendarDays,
  FileText,
  Brain,
  Plus,
  MessageCircle,
  ChevronDown,
  SlidersHorizontal,
  LoaderCircle,
  Maximize2,
  Minimize2,
  History,
} from "lucide-react";
import { aiApi, progressApi, examApi } from "../../api";
import { useLocation, useSearchParams } from 'react-router-dom';
import { unwrapResponse, responseList } from "../../api/apiClient";
import { useCurrentCourses } from '../../hooks/useCurrentCourses';
import CurrentCourseHint from '../../components/common/CurrentCourseHint';
import { mapExam } from '../../utils/examAdapter';
import { useApi } from "../../hooks/useApi";
import { formatTime } from "../../utils/date";
import { planningNow, validateAIPlanningOptions, isFutureStart } from "../../utils/planning";
import { textContent } from "../../utils/files";
import {
  defaultAIOptions,
  buildAIRequest,
  formatAIResult,
} from "../../utils/aiAdapter";
import { Button, Field, useAction } from "../../components/common/ui";
import foxAssets from "../../assets/foxAssets";
import AIContent, { EditableAIContent } from '../../components/common/AIContent';
import { hasAIText } from '../../utils/aiText';
import ConversationHistory from './ConversationHistory';
import "./AITutor.css";

const quick = [
  ["explain", "Giải thích bài", Brain],
  ["questions", "Tạo câu hỏi", Sparkles],
  ["summarize", "Tóm tắt", FileText],
  ["plan", "Lập kế hoạch", CalendarDays],
];
const modes = [["ask", "Trò chuyện", MessageCircle], ...quick];
const tools = [
  ["ask", "Trò chuyện"],
  ["plan", "Kế hoạch học"],
  ["examPlan", "Kế hoạch ôn thi"],
  ["check", "Kiểm tra nội dung"],
  ["summarize", "Tóm tắt"],
  ["draftLeave", "Soạn đơn nghỉ"],
  ["progressAdvice", "Tư vấn tiến độ"],
  ["difficultNotes", "Phân tích phần khó"],
];
function waitForAI(work, signal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(work).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
export function AIQuickActions({ onSelect }) {
  return (
    <div className="ai-welcome-actions" aria-label="Gợi ý học tập">
      {quick.map(([key, label, Icon]) => (
        <button type="button" key={key} onClick={() => onSelect(key)}>
          <Icon size={18} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
export function ChatMessage({ message, onConfirm, busy }) {
  const [draft, setDraft] = useState(message.plan?.data);
  return (
    <div className={"message " + message.role}>
      {message.role !== "user" && (
        <div className="message-avatar" aria-hidden="true">
          <Bot size={19} />
        </div>
      )}
      <div className="message-bubble">
        {message.role !== "user" && (
          <strong className="ai-message-label">AI Tutor</strong>
        )}
        <div className="message-text">{message.role === 'user' ? message.text : message.plan ? <AIContent text={message.text} /> : <EditableAIContent text={message.text} />}</div>
        {message.plan && (
          <div className="plan-preview">
            <p>
              {message.confirmed
                ? "Đã xác nhận kế hoạch"
                : "Xem lại kế hoạch trước khi lưu vào hệ thống."}
            </p>
            {!message.confirmed && <fieldset disabled={busy} className="stack" style={{ border: 0, padding: 0 }}>{(draft?.sessions || []).map((s, i) => <div key={i} className="stack schedule-note">
              {['title', 'date', 'start', 'end', ...(message.plan.kind === 'examPlan' ? ['objective', 'selfTest'] : [])].map(key => <Field key={key} label={`${({ title: 'Nội dung', date: 'Ngày', start: 'Bắt đầu', end: 'Kết thúc', objective: 'Mục tiêu', selfTest: 'Tự kiểm tra' })[key]} buổi ${i + 1}`} type={key === 'date' ? 'date' : ['start', 'end'].includes(key) ? 'time' : 'text'} value={s[key] || ''} onChange={e => setDraft(d => ({ ...d, sessions: d.sessions.map((row, index) => index === i ? { ...row, [key]: e.target.value } : row) }))} />)}
              <Button size="sm" variant="ghost" onClick={() => setDraft(d => ({ ...d, sessions: d.sessions.filter((_, index) => index !== i) }))}>Bỏ buổi {i + 1}</Button>
            </div>)}</fieldset>}
            <Button
              size="sm"
              disabled={busy || message.confirmed || !(draft?.sessions?.length || draft?.phases?.length)}
              onClick={() => onConfirm({ ...message, plan: { ...message.plan, data: draft } })}
            >
              Xác nhận kế hoạch
            </Button>
          </div>
        )}
        <small>{formatTime(message.createdAt)}</small>
      </div>
    </div>
  );
}
export function ChatInput({ value, onChange, onSend, busy, mode = "ask", visible = true }) {
  const textarea = useRef(null);
  const limit = mode === 'summarize' ? 500000 : mode === 'draftLeave' ? 1000 : mode === 'check' ? 8000 : 32000;
  const count = Array.from(value).length, tooLong = count > limit;
  const [, label, Icon] = modes.find(([key]) => key === mode) || [
    mode,
    tools.find(([key]) => key === mode)?.[1] || "Trò chuyện",
    Sparkles,
  ];
  useEffect(() => {
    if (!visible) return;
    const field = textarea.current;
    field.style.height = "auto";
    field.style.height = Math.min(field.scrollHeight, 160) + "px";
  }, [value, visible]);
  return (
    <form
      className="chat-input"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && !tooLong && hasAIText(value)) onSend();
      }}
    >
      <textarea
        ref={textarea}
        aria-label="Tin nhắn cho AI Tutor"
        placeholder="Hỏi AI Tutor bất cứ điều gì..."
        rows="1"
        value={value}
        aria-invalid={tooLong}
        aria-describedby="ai-input-length"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (!busy && !tooLong && hasAIText(value)) onSend();
          }
        }}
      />
      <div className="ai-composer-toolbar">
        <small id="ai-input-length" role={tooLong ? 'alert' : undefined}>{count.toLocaleString('vi-VN')}/{limit.toLocaleString('vi-VN')} ký tự{tooLong ? ' · Nội dung quá dài, hãy chia nhỏ.' : ''}</small>
        <span className="ai-composer-mode">
          <Icon size={16} aria-hidden="true" />
          {label}
        </span>
        <span className="ai-composer-shortcut">
          Enter để gửi <span>·</span> Shift + Enter xuống dòng
        </span>
        <Button
          type="submit"
          aria-label="Gửi tin nhắn"
          disabled={busy || tooLong || !hasAIText(value)}
        >
          {busy ? (
            <LoaderCircle size={21} className="ai-spinning" />
          ) : (
            <ArrowUp size={21} />
          )}
        </Button>
      </div>
    </form>
  );
}
export function AITutorChat({
  messages,
  input,
  setInput,
  onSend,
  busy,
  error,
  onConfirm,
  onQuick,
  mode = "ask",
  progress,
  onCancel,
  reading = false,
}) {
  const end = useRef(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy, error]);
  return (
    <section
      className="ai-chat-workspace"
      id="ai-chat-panel"
      role="tabpanel"
      tabIndex={0}
      aria-label="Trò chuyện với AI Tutor"
      aria-labelledby={
        modes.some(([key]) => key === mode) ? `ai-mode-${mode}` : undefined
      }
      data-region="C"
    >
      <div
        className="chat-messages"
        role="log"
        aria-label="Tin nhắn"
        aria-live="polite"
      >
        <div className="ai-message-container">
          {messages.length ? (
            messages.map((m) => (
              <ChatMessage
                key={m.id}
                message={m}
                onConfirm={onConfirm}
                busy={busy}
              />
            ))
          ) : (
            <div className="chat-welcome">
              <img src={foxAssets["fox-ai-tutor.png"]} alt="" />
              <span className="ai-welcome-label">
                <Sparkles size={14} aria-hidden="true" /> NGƯỜI BẠN ĐỒNG HÀNH
                HỌC TẬP
              </span>
              <h2>Bạn muốn học gì hôm nay?</h2>
              <p>
                Mình có thể giúp bạn giải thích bài, tóm tắt tài liệu, tạo câu
                hỏi ôn tập hoặc lập kế hoạch học tập.
              </p>
              <AIQuickActions onSelect={onQuick} />
            </div>
          )}
          {busy && (
            <div className="ai-thinking" role="status">
              <span className="message-avatar" aria-hidden="true">
                <Bot size={19} />
              </span>
              <span className="ai-thinking-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>{progress || 'AI Tutor đang xử lý...'}</span>
              {onCancel && <Button size="sm" variant="outline" onClick={onCancel}>{mode === 'summarize' ? 'Dừng tóm tắt' : 'Dừng yêu cầu'}</Button>}
            </div>
          )}
          {error && (
            <div className="chat-error" role="alert">
              {error} · Nội dung vẫn được giữ để bạn thử lại.
            </div>
          )}
          <div ref={end} />
        </div>
      </div>
      <div className="ai-composer-dock" hidden={reading}>
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={onSend}
          busy={busy}
          mode={mode}
          visible={!reading}
        />
      </div>
    </section>
  );
}
export default function AITutor() {
  const [params] = useSearchParams(), location = useLocation();
  const sourceContext = location.state?.learningContext || {};
  const currentCourses = useCurrentCourses(), examsState = useApi(examApi.list);
  const upcomingExams = responseList(examsState.data, 'exams').map(mapExam).filter(e => isFutureStart(String(e.examDate).slice(0, 10), e.startTime) && !['CANCELLED', 'CANCELED'].includes(e.exam_status));
  const status = useApi(aiApi.status),
    { run, busy: confirming } = useAction();
  const [messages, setMessages] = useState([]),
    [input, setInput] = useState(sourceContext.prompt || params.get('prompt') || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [conversationId, setConversationId] = useState(null),
    [tool, setTool] = useState(params.get('tool') === 'examPlan' ? 'examPlan' : 'ask');
  const [activeMode, setActiveMode] = useState("ask");
  const [reading, setReading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversationTitle, setConversationTitle] = useState('');
  const [options, setOptions] = useState(() => ({ ...defaultAIOptions(), subject: sourceContext.subject || params.get('subject') || '', topic: sourceContext.topic || params.get('topic') || '', context: String(sourceContext.text || '').slice(0, 8000), examId: params.get('examId') || '' }));
  const lock = useRef(false);
  const requestController = useRef(null);
  const mounted = useRef(true);
  const [progress, setProgress] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; requestController.current?.abort(new Error('Đã dừng yêu cầu AI.')); }; }, []);
  async function send() {
    const text = input.trim();
    if (!hasAIText(text) || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setProgress('');
    const controller = new AbortController();
    requestController.current = controller;
    const deadline = tool === 'summarize' ? null : setTimeout(() => controller.abort(new Error('AI chưa phản hồi trong thời gian chờ. Hãy thử lại.')), 120000);
    const slow = setTimeout(() => { if (mounted.current) setProgress('AI đang phản hồi chậm. Bạn có thể dừng yêu cầu và thử lại.'); }, 15000);
    const id = Date.now();
    setMessages((m) => [
      ...m,
      { id, role: "user", text, createdAt: new Date() },
    ]);
    setInput("");
    try {
      if (tool === 'examPlan' && options.examId && !upcomingExams.some(e => String(e.id) === String(options.examId))) throw new Error('Kỳ thi đã chọn không còn sắp tới. Hãy tải lại danh sách.');
      if (tool === "plan") validateAIPlanningOptions(options);
      if (tool === "check" && !options.question.trim())
        throw new Error("Nhập câu hỏi cần kiểm tra trong Tùy chọn công cụ.");
      const progress =
        tool === "progressAdvice"
          ? unwrapResponse(await waitForAI(() => progressApi.getProgress(), controller.signal))
          : {};
      const request = buildAIRequest(
        tool,
        text,
        options,
        conversationId,
        progress,
      );
      const response = await waitForAI(() => aiApi[tool](request, { signal: controller.signal, ...(tool === 'summarize' ? { onProgress: setProgress } : {}) }), controller.signal);
      if (!mounted.current) return;
      const data = unwrapResponse(response);
      if (data?.conversationId) setConversationId(data.conversationId);
      if (!messages.length) setConversationTitle(text);
      const answer = formatAIResult(data);
      setMessages((m) => [
        ...m,
        {
          id: id + 1,
          role: "ai",
          text: typeof answer === "string" ? answer : textContent(answer),
          createdAt: new Date(),
          metadata: data,
          plan: ["plan", "examPlan"].includes(tool)
            ? { kind: tool, data }
            : null,
        },
      ]);
    } catch (err) {
      if (!mounted.current) return;
      setError(
        controller.signal.aborted ? controller.signal.reason?.message || 'Đã dừng yêu cầu AI.'
          : err.response?.data?.message || err.message || "Không thể gửi tin nhắn",
      );
      setInput(current => current || text);
    } finally {
      lock.current = false;
      clearTimeout(deadline);
      clearTimeout(slow);
      requestController.current = null;
      if (mounted.current) { setBusy(false); setProgress(''); status.refetch(); }
    }
  }
  function onQuick(key) {
    if (lock.current) return;
    setReading(false);
    setActiveMode(key);
    if (key === "plan") {
      setTool("plan");
      setInput(
        "Lập kế hoạch học tập cho tuần này dựa trên lịch học và công việc của tôi.",
      );
    } else {
      setTool(key === "summarize" ? "summarize" : "ask");
      setInput(
        key === "questions"
          ? "Tạo câu hỏi ôn tập về "
          : key === "summarize"
            ? "Tóm tắt nội dung sau:\n"
            : "Giải thích dễ hiểu giúp tôi về ",
      );
    }
  }
  return (
    <div className={'page ai-page ai-workspace' + (reading ? ' is-reading' : '')} onKeyDown={event => { if (reading && !historyOpen && event.key === 'Escape') setReading(false); }}>
      <header className="ai-workspace-header" data-region="A">
        <div className="ai-workspace-title">
          <span className="ai-title-icon" aria-hidden="true">
            <Sparkles size={23} />
          </span>
          <h1>AI Tutor</h1>
          {messages.length > 0 && (
            <span className="ai-conversation-title" title={conversationTitle || messages[0].text}>
              {conversationTitle || messages[0].text}
            </span>
          )}
        </div>
        <div className="ai-header-actions">
          <Button size="sm" variant="outline" className="ai-history-toggle" aria-label="Lịch sử trò chuyện" aria-haspopup="dialog" disabled={busy || confirming} onClick={() => setHistoryOpen(true)}>
            <History size={16} /><span>Lịch sử</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="ai-reading-toggle"
            aria-label={reading ? 'Thoát chế độ đọc' : 'Chế độ đọc'}
            aria-pressed={reading}
            title={reading ? 'Thoát chế độ đọc (Esc)' : 'Mở rộng vùng đọc câu trả lời'}
            onClick={() => setReading(value => !value)}
          >
            {reading ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span>{reading ? 'Tiếp tục hỏi' : 'Chế độ đọc'}</span>
          </Button>
          <div className="ai-tool-picker">
            <SlidersHorizontal size={16} aria-hidden="true" />
            <select
              aria-label="Công cụ AI"
              disabled={busy}
              value={tool}
              onChange={(e) => {
                setTool(e.target.value);
                setActiveMode(e.target.value);
              }}
            >
              {tools.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </div>
          {tool !== "ask" && tool !== "summarize" && (
            <details
              className="ai-tool-options"
              key={tool}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.currentTarget.open = false;
                  event.currentTarget.querySelector("summary")?.focus();
                }
              }}
            >
              <summary aria-label="Tùy chọn công cụ" title="Tùy chọn công cụ">
                <SlidersHorizontal size={16} aria-hidden="true" />
                <span>Tùy chọn công cụ</span>
                <ChevronDown size={14} aria-hidden="true" />
              </summary>
              <div className="ai-options-panel">
                <h2>{tools.find(([key]) => key === tool)?.[1]}</h2>
                <AIToolOptions
                  tool={tool}
                  options={options}
                  currentCourses={currentCourses}
                  exams={upcomingExams}
                  examsState={examsState}
                  disabled={busy}
                  onChange={(key, value) =>
                    setOptions((o) => ({ ...o, [key]: value }))
                  }
                />
              </div>
            </details>
          )}
          <Button
            size="sm"
            variant="outline"
            className="ai-new-conversation"
            aria-label="Cuộc trò chuyện mới"
            disabled={busy}
            onClick={() => {
              setMessages([]);
              setConversationId(null);
              setConversationTitle('');
              setError("");
            }}
          >
            <Plus size={18} />
            <span>Cuộc trò chuyện mới</span>
          </Button>
        </div>
      </header>
      <div className="ai-controls" hidden={reading}>
      <div className="ai-course-bar">
        <Field label="Môn kỳ hiện tại">
          <select disabled={busy} value={options.subject} onChange={e => setOptions(o => ({ ...o, subject: e.target.value, context: '', topic: '' }))}>
            <option value="">Chọn môn (tùy chọn)</option>
            {currentCourses.subjects.map(s => <option key={s.subject_id}>{s.subject_name}</option>)}
          </select>
        </Field>
      </div>
      <div className="ai-mode-bar" data-region="B">
        <div
          className="ai-mode-tabs"
          role="tablist"
          aria-label="Chế độ học tập"
        >
          {modes.map(([key, label, Icon], index) => (
            <button
              type="button"
              role="tab"
              id={`ai-mode-${key}`}
              key={key}
              aria-selected={activeMode === key}
              aria-controls="ai-chat-panel"
              tabIndex={
                activeMode === key ||
                (!modes.some(([mode]) => mode === activeMode) && index === 0)
                  ? 0
                  : -1
              }
              onClick={() => {
                if (lock.current) return;
                if (key === "ask") {
                  setTool("ask");
                  setActiveMode("ask");
                } else onQuick(key);
              }}
              onKeyDown={(event) => {
                const next =
                  event.key === "ArrowRight"
                    ? (index + 1) % modes.length
                    : event.key === "ArrowLeft"
                      ? (index + modes.length - 1) % modes.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? modes.length - 1
                          : null;
                if (next === null) return;
                event.preventDefault();
                event.currentTarget.parentElement.children[next].focus();
              }}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <div
          className={
            "ai-availability " +
            (status.error ||
            status.data?.available === false ||
            status.data?.online === false
              ? "is-unavailable"
              : status.loading
                ? "is-checking"
                : status.data?.connection === 'unchecked'
                  ? 'is-checking'
                : "")
          }
          role={status.loading ? "status" : undefined}
          aria-live="polite"
        >
          <span aria-hidden="true" />
          {status.error
            ? "Chưa kiểm tra được AI"
            : status.loading
              ? "Đang kiểm tra AI..."
              : status.data?.available === false ||
                  status.data?.online === false
                ? "AI chưa sẵn sàng"
                : status.data?.connection === 'unchecked'
                  ? 'Chưa kiểm tra kết nối AI'
                  : "Sẵn sàng cùng bạn học tập"}
        </div>
      </div>
      {(currentCourses.message || options.topic || options.context) && <div className="ai-context-hints">
        <CurrentCourseHint state={currentCourses} />
        {options.topic && <p className="hint">Chủ đề: {options.topic}</p>}
        {options.context && <p className="hint">Đã điền ngữ cảnh từ màn hình nguồn ({options.context.length} ký tự). Bạn có thể sửa câu hỏi trước khi gửi.</p>}
      </div>}
      </div>
      <ConversationHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        conversationId={conversationId}
        busy={busy || confirming}
        onSelect={data => {
          if (lock.current || confirming) return;
          setMessages(data.messages.map((message, index) => ({
            id: `${data.id}:${index}`,
            role: message.role === 'user' ? 'user' : 'ai',
            text: message.text || '',
            createdAt: message.createdAt,
          })));
          setConversationId(data.id);
          setConversationTitle(data.title || data.messages[0]?.text || 'Cuộc trò chuyện');
          setTool('ask'); setActiveMode('ask');
          setOptions(current => ({ ...current, subject: '', topic: '', context: '' }));
          setError(''); setHistoryOpen(false);
        }}
      />
      <AITutorChat
        messages={messages}
        input={input}
        setInput={setInput}
        onSend={send}
        busy={busy || confirming}
        error={error}
        mode={tool === 'ask' ? activeMode : tool}
        progress={progress}
        reading={reading}
        onCancel={busy ? () => requestController.current?.abort(new Error(tool === 'summarize' ? 'Đã dừng tóm tắt.' : 'Đã dừng yêu cầu AI.')) : undefined}
        onQuick={onQuick}
        onConfirm={(m) =>
          run(async () => {
            const saved = unwrapResponse(await (m.plan.kind === "examPlan"
              ? aiApi.confirmExamPlan({
                  confirmed: true,
                  requestId: String(m.id),
                  phases: m.plan.data.phases,
                  sessions: m.plan.data.sessions || [],
                })
              : aiApi.confirmPlan({
                  confirmed: true,
                  sessions: m.plan.data.sessions || [],
                })));
            if (saved?.persisted !== true) throw new Error('Máy chủ chưa xác nhận đã lưu kế hoạch. Hãy kiểm tra lại.');
            setMessages((rows) =>
              rows.map((x) => (x.id === m.id ? { ...x, confirmed: true } : x)),
            );
            window.dispatchEvent(new Event("workspace-updated"));
          }, "Đã lưu kế hoạch")
        }
      />
    </div>
  );
}

function AIToolOptions({ tool, options, onChange, currentCourses, exams = [], examsState, disabled }) {
  const field = (key) => ({
    value: options[key],
    onChange: (e) => onChange(key, e.target.value),
  });
  return (
    <fieldset disabled={disabled} className="form-grid" style={{ paddingTop: 12, border: 0 }}>
      {tool === "plan" ? (
        <>
          <Field label="Từ ngày" type="date" min={planningNow().date} {...field("startDate")} />
          <Field label="Đến ngày" type="date" min={options.startDate > planningNow().date ? options.startDate : planningNow().date} {...field("endDate")} />
          <Field label="Bắt đầu học" type="time" {...field("freeStartTime")} />
          <Field label="Kết thúc học" type="time" {...field("freeEndTime")} />
          <Field
            label="Mỗi buổi (phút)"
            type="number"
            min="30"
            max="240"
            {...field("durationMinutes")}
          />
          <Field label="Môn ưu tiên (tùy chọn)"><select {...field('subject')}><option value="">Chọn môn kỳ hiện tại</option>{currentCourses.subjects.map(s => <option key={s.subject_id}>{s.subject_name}</option>)}</select></Field>
        </>
      ) : tool === "check" ? (
        <Field label="Câu hỏi cần kiểm tra" {...field("question")} />
      ) : tool === "draftLeave" ? (
        <>
          <Field label="Ngày nghỉ" type="date" {...field("date")} />
          <Field label="Người nhận (tùy chọn)" {...field("recipient")} />
          <Field label="Môn học (tùy chọn)"><select {...field('subject')}><option value="">Chọn môn kỳ hiện tại</option>{currentCourses.subjects.map(s => <option key={s.subject_id}>{s.subject_name}</option>)}</select></Field>
        </>
      ) : tool === "examPlan" ? (
        <><Field label="Kỳ thi sắp tới"><select {...field('examId')}><option value="">Tất cả kỳ thi sắp tới</option>{exams.map(e => <option key={e.id} value={e.id}>{e.subjectName} · {e.examName} · {String(e.examDate).slice(0, 10)} {e.startTime}</option>)}</select></Field>{examsState?.loading ? <p role="status">Đang tải kỳ thi…</p> : (examsState?.error || !exams.length) && <p role="status">{examsState?.error ? 'Chưa tải được kỳ thi.' : 'Chưa có kỳ thi sắp tới.'} <button type="button" onClick={examsState?.refetch}>Tải lại kỳ thi</button></p>}</>
      ) : (
        <p className="hint">
          Phân tích dựa trên dữ liệu thực đã lưu trong hệ thống.
        </p>
      )}
    </fieldset>
  );
}
