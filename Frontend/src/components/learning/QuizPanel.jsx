import { useState, useRef, useEffect } from "react";
import { quizApi } from "../../api";
import AIContent from '../common/AIContent';
import { useApi } from "../../hooks/useApi";
import { responseList, unwrapResponse } from "../../api/apiClient";
import {
  Card,
  Button,
  ApiContent,
  Field,
  Modal,
  Badge,
  useAction,
  ErrorState,
} from "../common/ui";
export default function QuizPanel() {
  const list = useApi(quizApi.list),
    detail = useApi(quizApi.detail, { immediate: false });
  const [quiz, setQuiz] = useState(null),
    [answers, setAnswers] = useState({}),
    [result, setResult] = useState(null),
    [create, setCreate] = useState(false),
    [subject, setSubject] = useState(""),
    [topic, setTopic] = useState("");
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
                  if (!questions.length)
                    throw new Error("Quiz chưa có câu hỏi.");
                  const response = await quizApi.submit(quiz.id, { answers });
                  const payload = unwrapResponse(response);
                  setResult(payload.result ?? payload);
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
        onClose={() => setCreate(false)}
        title="Tạo quiz ôn tập"
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await quizApi.create({
                subject,
                topic,
                count: 10,
                difficulty: "medium",
              });
              setCreate(false);
              await list.refetch();
            }, "Đã tạo quiz");
          }}
        >
          <Field
            label="Môn học / chủ đề"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <Field label="Chủ đề ôn tập" required value={topic} onChange={(e) => setTopic(e.target.value)} />
          <p className="hint">Tạo 10 câu hỏi ôn tập cho chủ đề bạn chọn.</p>
          <Button type="submit" disabled={busy}>
            Tạo quiz
          </Button>
        </form>
      </Modal>
    </div>
  );
}
