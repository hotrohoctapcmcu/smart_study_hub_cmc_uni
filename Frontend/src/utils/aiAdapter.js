import { formatDateISO, addDays } from "./date";
export function defaultAIOptions() {
  return {
    startDate: formatDateISO(),
    endDate: formatDateISO(addDays(new Date(), 6)),
    freeStartTime: "19:00",
    freeEndTime: "22:00",
    durationMinutes: 60,
    subject: "",
    question: "",
    date: formatDateISO(),
    recipient: "",
    examId: "",
  };
}
export function buildAIRequest(
  tool,
  text,
  options = {},
  conversationId = null,
  progress = {},
) {
  if (tool === "ask") return { question: text, conversationId };
  if (tool === "summarize") return { text };
  if (tool === "plan")
    return {
      startDate: options.startDate,
      endDate: options.endDate,
      freeStartTime: options.freeStartTime,
      freeEndTime: options.freeEndTime,
      durationMinutes: Number(options.durationMinutes),
      ...(options.subject ? { subject: options.subject } : {}),
    };
  if (tool === "examPlan")
    return options.examId ? { examId: options.examId } : {};
  if (tool === "check") return { question: options.question, answer: text };
  if (tool === "draftLeave")
    return {
      date: options.date,
      reason: text,
      ...(options.subject ? { subject: options.subject } : {}),
      ...(options.recipient ? { recipient: options.recipient } : {}),
    };
  if (tool === "progressAdvice")
    return { progress: progress.metrics ?? progress };
  return {};
}
function displayValue(value) {
  if (value == null) return '';
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of ['content', 'text', 'answer', 'summary', 'message']) if (typeof value[key] === 'string') return value[key];
  }
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
}
export function formatAIResult(data) {
  if (data == null) return "Máy chủ chưa trả nội dung.";
  if (typeof data !== 'object') return displayValue(data) || "Máy chủ chưa trả nội dung.";
  if (Array.isArray(data)) return data.filter(v => v != null).map(formatAIResult).join('\n\n');
  const sections = [];
  for (const key of [
    "answer",
    "draft",
    "summary",
    "feedback",
    "overview",
    "text",
    "content",
    "message",
  ])
    if (data[key] != null && displayValue(data[key]).trim()) { sections.push(displayValue(data[key])); break; }
  for (const key of ['comments', 'corrections', 'revisionSuggestions']) if (Array.isArray(data[key])) sections.push(...data[key].filter(v => v != null).map(displayValue));
  if (Array.isArray(data.phases))
    sections.push(
      ...data.phases.filter(p => p && typeof p === 'object').map(
        (p) =>
          (p.title || '') +
          "\n" +
          (p.startDate || '') +
          " → " +
          (p.endDate || '') +
          "\n" +
          (p.target || ""),
      ),
    );
  if (Array.isArray(data.sessions))
    sections.push(
      ...data.sessions.filter(s => s && typeof s === 'object').map(
        (s) =>
          (s.title || '') +
          "\n" +
          (s.date || '') +
          " · " +
          (s.start || s.startTime || '') +
          " – " +
          (s.end || s.endTime || '') +
          "\n" +
          (s.reason || ""),
      ),
    );
  if (Array.isArray(data.topics))
    sections.push(
      ...data.topics.filter(t => t != null).map((t) =>
        typeof t === "string"
          ? t
          : [t.topic, t.explanation, t.recommendation]
              .filter(Boolean)
              .map(displayValue).join("\n"),
      ),
    );
  if (Array.isArray(data.suggestions))
    sections.push(
      ...data.suggestions.map((s) =>
        typeof s === "string" ? s : JSON.stringify(s),
      ),
    );
  return sections.join("\n\n") || JSON.stringify(data, null, 2);
}
