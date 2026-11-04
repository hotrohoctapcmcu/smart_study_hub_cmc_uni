import { useEffect, useRef, useState } from "react";
import { aiApi } from "../../api";
import { unwrapResponse } from "../../api/apiClient";
import { Button } from "../common/ui";

export default function PomodoroGoalSuggestions({ goal, subjectId, taskId, taskSource, durationMinutes, disabled, autoAnalyze, hasPlan, onApply }) {
  const [state, setState] = useState({ loading: false, data: null, error: "" });
  const [retry, setRetry] = useState(0);
  const cache = useRef(new Map());
  const text = String(goal || "").trim();
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setState({ loading: false, data: null, error: "" });
    if (disabled || hasPlan || text.length < 5 || (!autoAnalyze && !retry)) return () => { active = false; controller.abort(); };
    const body = { goal: text, subjectId: subjectId ? Number(subjectId) : null, durationMinutes, ...(taskId ? { taskId: String(taskId), taskSource } : {}) };
    const key = JSON.stringify(body);
    const timer = setTimeout(async () => {
      const hit = cache.current.get(key);
      if (hit && Date.now() - hit.at < 300000) { if (active) setState({ loading: false, data: hit.data, error: "" }); return; }
      setState({ loading: true, data: null, error: "" });
      try {
        const data = unwrapResponse(await aiApi.pomodoroGoals(body, { signal: controller.signal }));
        if (!Array.isArray(data?.steps) || data.steps.length < 2) throw new Error("AI chưa trả được các bước phù hợp.");
        if (!active) return;
        if (cache.current.size >= 20) cache.current.delete(cache.current.keys().next().value);
        cache.current.set(key, { at: Date.now(), data });
        setState({ loading: false, data, error: "" });
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        const message = Number(error.response?.status) >= 500 || error.code === 'ERR_NETWORK'
          ? "AI đang chưa sẵn sàng. Bạn vẫn có thể tự viết mục tiêu và bắt đầu phiên."
          : error.response?.data?.message || error.message || "Chưa phân tích được mục tiêu. Hãy thử lại.";
        setState({ loading: false, data: null, error: message });
      }
    }, 1200);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [text, subjectId, taskId, taskSource, durationMinutes, disabled, autoAnalyze, hasPlan, retry]);

  if (disabled || hasPlan || text.length < 5) return null;
  return <section className="pomodoro-ai-goals" aria-label="Gợi ý chia nhỏ từ AI">
    {state.loading ? <p role="status">AI đang chia nhỏ mục tiêu cho phiên {durationMinutes} phút…</p>
      : state.error ? <><p role="alert">{state.error}</p><Button size="sm" variant="outline" onClick={() => setRetry(value => value + 1)}>Thử phân tích lại</Button></>
        : state.data ? <><strong>Các bước gợi ý · thời gian ước tính</strong><ol>{state.data.steps.map(step => <li key={step.id || step.title}><strong>{step.title}</strong> · {step.minutes} phút<small>Xong khi: {step.doneWhen}</small></li>)}</ol>{state.data.note && <p>{state.data.note}</p>}<Button size="sm" variant="outline" onClick={() => onApply(state.data.steps)}>Dùng các bước này</Button></>
          : <><p>AI sẽ gợi ý các bước nhỏ, có đầu ra cụ thể và vừa với thời lượng phiên.</p><Button size="sm" variant="outline" onClick={() => setRetry(value => value + 1)}>AI chia nhỏ mục tiêu</Button></>}
  </section>;
}
