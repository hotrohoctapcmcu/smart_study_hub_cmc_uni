import { useState, useRef, useEffect } from "react";
import { quizApi } from "../../api";
import AIContent from '../common/AIContent';
import QuizCreator from './QuizCreator';
import { useApi } from "../../hooks/useApi";
import { responseList, unwrapResponse } from "../../api/apiClient";
import {
  Card,
  Button,
  ApiContent,
  Modal,
  Badge,
  useAction,
} from "../common/ui";
export default function QuizPanel({ initialSubject = "", initialTopic = "", initialCount = 10, initialCreate = false }) {
  const list = useApi(quizApi.list),
    detail = useApi(quizApi.detail, { immediate: false });
  const [quiz, setQuiz] = useState(null),
    [answers, setAnswers] = useState({}),
    [result, setResult] = useState(null),
    [create, setCreate] = useState(initialCreate),
    [subject, setSubject] = useState(initialSubject.slice(0, 120)),
    [topic, setTopic] = useState(initialTopic.slice(0, 180));
  const { run, busy } = useAction();
  const selection = useRef(0);
  useEffect(() => () => { selection.current++; }, []);
  const questions = Array.isArray(detail.data?.questions)
    ? detail.data.questions
    : [];
  return (
    <div className="stack">
      <div className="filter-bar">
        <h2>Kiểm tra kiến thức</h2>
        <Button onClick={() => setCreate(true)}>Tạo quiz</Button>
      </div>
      <ApiContent
        state={list}
        empty={!responseList(list.data, "quizzes").length}
      >
        <div className="course-grid">
          {responseList(list.data, "quizzes").map((q) => (
            <Card key={q.id}>
              <h3>{q.title || q.subject || "Quiz"}</h3>
              <p className="hint">
                {q.questionCount ?? q.questions?.length ?? "—"} câu hỏi
              </p>
              <Button
                disabled={busy}
                onClick={() => {
                  const request = ++selection.current;
                  setQuiz(q);
                  setAnswers({});
                  setResult(null);
                  detail.execute(q.id).then((data) => {
                    if (request === selection.current && data?.result) {
                      setResult(data.result);
                      setAnswers(data.answers || {});
                    }
                  });
                }}
              >
                Làm bài
              </Button>
            </Card>
          ))}
        </div>
      </ApiContent>
      <Modal
        size="lg"
        isOpen={!!quiz}
        onClose={() => { selection.current++; setQuiz(null); }}
        title={quiz?.title || "Làm quiz"}
      >
        <ApiContent state={detail}>
          <p className="hint">Nguồn: {detail.data?.source?.title || 'Bản cũ: chưa ghi nhận nguồn'}{detail.data?.source?.documents?.length ? ` · ${detail.data.source.documents.map(d => `${d.chapter} / ${d.title}`).join('; ')}` : ''}</p>
          {result ? (
            <div className="stack">
              <h2>
                Kết quả: {result.score ?? result.correctCount ?? "Đã nộp"}
              </h2>
              <AIContent>
                {result.feedback ||
                  result.message ||
                  "Bạn đã hoàn thành bài kiểm tra."}
              </AIContent>
              {(result.details ?? result.results ?? []).some(r => !(r.correct || r.isCorrect)) && <Button variant="outline" onClick={() => { setSubject(quiz.subject || initialSubject); setTopic([...new Set((result.details ?? result.results).filter(r => !(r.correct || r.isCorrect)).map(r => r.topic).filter(Boolean))].join(', ').slice(0, 180) || quiz.topic || initialTopic); selection.current++; setQuiz(null); setCreate(true); }}>Luyện lại phần sai</Button>}
              {Array.isArray(result.details ?? result.results) &&
                (result.details ?? result.results).map((r, i) => (
                  <div className="schedule-note" key={i}>
                    <Badge
                      label={r.correct || r.isCorrect ? "Đúng" : "Cần ôn lại"}
                      variant={r.correct || r.isCorrect ? "success" : "warning"}
                    />
                    <AIContent text={r.explanation} />
                  </div>
                ))}
            </div>
          ) : (
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const request = selection.current;
                  if (!questions.length)
                    throw new Error("Quiz chưa có câu hỏi.");
                  const response = await quizApi.submit(quiz.id, { answers });
                  const payload = unwrapResponse(response);
                  const graded = payload?.result ?? payload;
                  if (!Number.isFinite(graded?.score) && !Number.isInteger(graded?.correctCount)) throw new Error('Máy chủ chưa trả kết quả chấm bài hợp lệ. Hãy thử lại hoặc tải lại bài.');
                  if (request === selection.current) setResult(graded);
                  await list.refetch();
                }, "Đã nộp bài");
              }}
            >
              {questions.map((q, i) => (
                <fieldset className="quiz-question" key={q.id || i}>
                  <legend>
                    Câu {i + 1}
                  </legend>
                  <AIContent text={q.question || q.text || q.title} />
                  {(q.options || q.choices || []).map((o, j) => (
                    <label className="quiz-option" key={j}>
                      <input
                        required
                        type="radio"
                        name={"question-" + i}
                        value={j}
                        checked={String(answers[q.id ?? i]) === String(j)}
                        onChange={() =>
                          setAnswers((a) => ({ ...a, [q.id ?? i]: j }))
                        }
                      />
                      <AIContent text={typeof o === "string" ? o : o?.text || o?.label} />
                    </label>
                  ))}
                </fieldset>
              ))}
              {questions.length ? (
                <Button
                  type="submit"
                  disabled={
                    busy || Object.keys(answers).length < questions.length
                  }
                >
                  Nộp bài
                </Button>
              ) : (
                <p className="hint">Quiz này chưa có câu hỏi.</p>
              )}
            </form>
          )}
        </ApiContent>
      </Modal>
      <Modal
        isOpen={create}
        onClose={() => { if (!busy) setCreate(false); }}
        title="Tạo quiz ôn tập"
      >
        {create && <QuizCreator initialSubject={subject} initialTopic={topic} initialCount={initialCount} busy={busy} onCreate={body => run(async () => {
          const data = unwrapResponse(await quizApi.create(body));
          if (!data?.id) throw new Error('Máy chủ chưa trả quiz hợp lệ. Hãy tải lại danh sách trước khi thử lại.');
          setCreate(false); await list.refetch();
        }, 'Đã tạo quiz')} />}
      </Modal>
    </div>
  );
}
