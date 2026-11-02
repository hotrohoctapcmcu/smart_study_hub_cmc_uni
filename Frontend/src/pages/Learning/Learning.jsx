import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, RefreshCw, Layers, Sparkles, ArrowUpRight } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { courseApi, weaknessApi } from "../../api";
import { responseList, unwrapResponse } from "../../api/apiClient";
import {
  PageHeader,
  Card,
  Button,
  Tabs,
  ApiContent,
  EmptyState,
  ProgressBar,
  Modal,
  Badge,
  useAction,
} from "../../components/common/ui";
import PomodoroTimer from "../../components/learning/PomodoroTimer";
import QuizPanel from "../../components/learning/QuizPanel";
import { textContent } from "../../utils/files";
import foxAssets from "../../assets/foxAssets";
import AIContent, { EditableAIContent } from '../../components/common/AIContent';

export function CourseCard({ course, onSelect }) {
  const cards = Array.isArray(course.cards) ? course.cards : [],
    chapters = Array.isArray(course.chapters) ? course.chapters : [];
  return (
    <article className="card course-card">
      <div className="course-symbol">
        <BookOpen size={23} />
      </div>
      <h3>{course.subject || course.subject_name || "Môn học"}</h3>
      <p>{course.subjectCode || course.subject_code}</p>
      <div className="summary-line">
        <span>{course.chapterCount ?? chapters.length} chương</span>
        <span>{course.cardCount ?? cards.length} flashcard</span>
      </div>
      <ProgressBar value={course.progress ?? course.summary?.progress ?? 0} />
      <div className="summary-line">
        <small>
          {course.progress != null ? course.progress + '% hoàn thành' : 'Học theo nhịp của bạn'}
        </small>
        <Button size="sm" variant="outline" onClick={() => onSelect(course)}>
          Vào học ↗
        </Button>
      </div>
    </article>
  );
}
export default function Learning() {
  const [params, setParams] = useSearchParams();
  const tabAliases = { subjects: "courses", courses: "courses", flashcards: "flashcard", flashcard: "flashcard", quiz: "quiz", weaknesses: "weakness", weakness: "weakness", pomodoro: "pomodoro" };
  const tab = tabAliases[params.get("tab")] || "courses";
  function setTab(value) {
    const next = new URLSearchParams(params);
    next.set("tab", { courses: "subjects", flashcard: "flashcards", weakness: "weaknesses" }[value] || value);
    setParams(next);
  }
  const state = useApi(courseApi.list),
    weakness = useApi(weaknessApi.list, { immediate: false });
  const [selected, setSelected] = useState(null),
    [deckId, setDeckId] = useState(""),
    [detailTab, setDetailTab] = useState("summary"),
    [index, setIndex] = useState(0),
    [flipped, setFlipped] = useState(false),
    [job, setJob] = useState(null);
  const detail = useApi(courseApi.detail, { immediate: false }),
    source = useApi(courseApi.source, { immediate: false }),
    summary = useApi(courseApi.summary, { immediate: false });
  const { run, busy, notify } = useAction();
  const courses = responseList(state.data, "courses");
  const flashcards = useApi(async () => {
    const available = courses.filter(c => !c.pending);
    const details = await Promise.all(available.map(c => courseApi.detail(c.id)));
    return details.flatMap((response, i) => responseList(unwrapResponse(response)?.cards).map(card => ({ ...card, deckId: String(available[i].id), deckTitle: available[i].subject || available[i].subject_name || "Môn học" })));
  }, { immediate: false });
  const allCards = Array.isArray(flashcards.data) ? flashcards.data : [];
  const cards = allCards.filter(card => !deckId || card.deckId === deckId),
    card = cards[index % Math.max(cards.length, 1)];
  const weaknessTopics = responseList(weakness.data, "topics").map((topic) => ({
    ...topic,
    ...(Array.isArray(weakness.data?.advice)
      ? weakness.data.advice.find((advice) => advice.key === topic.key)
      : null),
  }));
  useEffect(() => {
    if (tab === "weakness") weakness.execute();
    if (tab === "flashcard" && !state.loading && !state.error) flashcards.execute();
  }, [tab, state.data, state.loading, state.error, weakness.execute, flashcards.execute]);
  useEffect(() => {
    if (!job) return;
    let canceled = false;
    let timer;
    const poll = async () => {
      try {
        const result = unwrapResponse(await courseApi.getJob(job));
        if (canceled) return;
        if (
          [
            "COMPLETED",
            "completed",
            "DONE",
            "done",
            "SUCCEEDED",
            "succeeded",
          ].includes(result?.status)
        ) {
          setJob(null);
          await state.refetch();
          if (selected) await summary.execute(selected.id);
          notify("Đã tạo tóm tắt");
          return;
        } else if (
          ["FAILED", "failed", "ERROR", "error"].includes(result?.status)
        ) {
          setJob(null);
          if (selected) await summary.execute(selected.id);
          notify(result.error || "Tạo tóm tắt thất bại", "error");
          return;
        }
      } catch (e) {
        if (!canceled) {
          setJob(null);
          notify(e.message, "error");
          return;
        }
      }
      if (!canceled) timer = setTimeout(poll, 3000);
    };
    timer = setTimeout(poll, 3000);
    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [job, selected, summary.execute, state.execute, notify]);
  function open(c) {
    setSelected(c);
    setDetailTab("summary");
    detail.execute(c.id);
    summary.execute(c.id);
  }
  function next() {
    setIndex((i) => (i + 1) % Math.max(cards.length, 1));
    setFlipped(false);
  }
  return (
    <div className="page learning-page">
      <PageHeader
        eyebrow="KHÔNG GIAN KIẾN THỨC"
        title="Học tập"
        description="Hiểu sâu hơn, nhớ lâu hơn, mỗi ngày một chút."
      >
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const result = unwrapResponse(await courseApi.sync());
              if (result?.jobId) setJob(result.jobId);
              await state.refetch();
            }, "Đã yêu cầu đồng bộ học liệu")
          }
        >
          <RefreshCw size={14} />
          Đồng bộ học liệu
        </Button>
      </PageHeader>
      {tab === "courses" && <section className="learning-intro" data-region="B" aria-label="B. Giới thiệu môn học">
        <div>
          <span className="workspace-eyebrow"><Sparkles size={13} /> KHÁM PHÁ · THỰC HÀNH · GHI NHỚ</span>
          <h2>Mỗi điều bạn học,<br />mở ra một khả năng mới.</h2>
          <p>Môn học, flashcard và những phiên tập trung — tất cả trong một góc học tập.</p>
          <button className="learning-intro-link" onClick={() => setTab("pomodoro")}>Bắt đầu phiên tập trung <ArrowUpRight size={16} /></button>
        </div>
        <img src={foxAssets["fox-study.png"]} alt="" />
      </section>}
      <Tabs
        value={tab}
        items={[
          ["courses", "Môn học"],
          ["flashcard", "Flashcard"],
          ["quiz", "Quiz"],
          ["weakness", "Điểm cần cải thiện"],
          ["pomodoro", "Pomodoro"],
        ]}
        onChange={setTab}
      />
      {tab === "flashcard" && <section className="filter-bar" aria-label="B. Bộ thẻ ôn tập">
        <div><strong>Chọn bộ thẻ của bạn</strong><p className="hint">{allCards.length} thẻ từ {new Set(allCards.map(card => card.deckId)).size} môn học · Ôn đều đặn để nhớ lâu hơn.</p></div>
        <select aria-label="Bộ flashcard" value={deckId} onChange={e => { setDeckId(e.target.value); setIndex(0); setFlipped(false); }}>
          <option value="">Tất cả môn học</option>
          {[...new Map(allCards.map(card => [card.deckId, card.deckTitle]))].map(([id, title]) => <option key={id} value={id}>{title} ({allCards.filter(card => card.deckId === id).length})</option>)}
        </select>
      </section>}
      {tab === "courses" ? (
        <ApiContent state={state}>
          {courses.length ? (
            <div className="course-grid" data-region="C" aria-label="C. Danh sách môn học">
              {courses.map((c) => (
                <CourseCard course={c} key={c.id} onSelect={open} />
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState
                title="Chưa có môn học"
                description="Đồng bộ học liệu từ EDUX để bắt đầu."
              />
            </Card>
          )}
        </ApiContent>
      ) : tab === "flashcard" ? (
        <ApiContent state={flashcards}>
          <Card title="Ôn tập flashcard" region="C">
            {card ? (
              <div className="stack">
                <p className="hint">
                  Thẻ {(index % cards.length) + 1}/{cards.length}
                </p>
                <button
                  className="flashcard"
                  onClick={() => setFlipped((v) => !v)}
                >
                  <small>{flipped ? "ĐÁP ÁN" : "CÂU HỎI"}</small>
                  <AIContent text={flipped
                      ? card.back || card.answer
                      : card.front || card.question} />
                  <small>Chạm để lật thẻ</small>
                </button>
                <div className="actions">
                  <Button variant="outline" onClick={next}>
                    Bỏ qua
                  </Button>
                  {flipped &&
                    [
                      ["again", "Học lại"],
                      ["good", "Đã nhớ"],
                      ["easy", "Rất dễ"],
                    ].map(([rating, label]) => (
                      <Button
                        key={rating}
                        variant={rating === "good" ? "primary" : "outline"}
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await courseApi.review(card.id, {
                              rating,
                              requestId: crypto.randomUUID(),
                            });
                            next();
                            await state.refetch();
                          }, "Đã lưu kết quả ôn tập")
                        }
                      >
                        {label}
                      </Button>
                    ))}
                </div>
              </div>
            ) : (
              <EmptyState
                title="Chưa có flashcard"
                description="Flashcard sẽ xuất hiện khi học liệu được xử lý."
                mascot="fox-flashcard.png"
              />
            )}
          </Card>
        </ApiContent>
      ) : tab === "quiz" ? (
        <QuizPanel />
      ) : tab === "pomodoro" ? (
        <PomodoroTimer />
      ) : (
        <Card
          title="Điểm cần cải thiện"
          action={
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await weaknessApi.analyze({});
                  await weakness.refetch();
                }, "Đã phân tích điểm yếu")
              }
            >
              Phân tích
            </Button>
          }
        >
          <ApiContent
            state={weakness}
            empty={!weaknessTopics.length}
          >
            {weaknessTopics.map((w, i) => (
              <div key={w.key || w.id || i} className="task-row">
                <div>
                  <h3>
                    {w.subject || w.subject_name} · {w.topic || w.title}
                  </h3>
                  <AIContent className="hint" text={w.recommendation || w.advice} />
                  {w.exercise && <AIContent className="hint" text={'Bài luyện tập: ' + w.exercise} />}
                  {w.latestScore != null && (
                    <p className="hint">Kết quả gần nhất: {w.latestScore}%</p>
                  )}
                  <Badge
                    label={w.level || w.severity || ({ high: "Ưu tiên cao", medium: "Cần ôn tập", low: "Tiếp tục củng cố" }[w.priority]) || "Cần ôn tập"}
                    variant={w.priority === "high" ? "danger" : w.priority === "low" ? "success" : "warning"}
                  />
                </div>
              </div>
            ))}
          </ApiContent>
        </Card>
      )}
      <Modal
        size="lg"
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.subject || "Môn học"}
      >
        <div className="stack">
          <Tabs
            items={[
              ["summary", "Tóm tắt"],
              ["source", "Học liệu"],
              ["chapters", "Các chương"],
            ]}
            value={detailTab}
            onChange={(v) => {
              setDetailTab(v);
              if (v === "source") source.execute(selected.id);
            }}
          />
          {detailTab === "chapters" ? (
            <ApiContent state={detail}>
              {(detail.data?.chapters || []).length ? (
                detail.data.chapters.map((c, i) => (
                  <div className="schedule-note" key={c.id || i}>
                    {typeof c === "string"
                      ? c
                      : c.title || c.name || "Chương " + (i + 1)}
                  </div>
                ))
              ) : (
                <EmptyState title="Chưa có chương học" />
              )}
            </ApiContent>
          ) : (
            <ApiContent state={detailTab === "summary" ? summary : source}>
              {detailTab === 'summary' ? <EditableAIContent text={summary.data?.summary?.content ?? summary.data?.summary ?? summary.data?.content ?? summary.data ?? 'Chưa có nội dung.'} /> :
                <div className="pre-wrap">{textContent(source.data?.text ?? source.data?.content ?? source.data ?? 'Chưa có nội dung.')}</div>}
            </ApiContent>
          )}
          <Button
            disabled={busy || !!job}
            onClick={() =>
              run(async () => {
                const result = unwrapResponse(
                  await courseApi.summarize(selected.id),
                );
                const id = result?.jobId || result?.job_id || result?.job?.id;
                if (id) setJob(id);
                else await summary.execute(selected.id);
              }, "Đã gửi yêu cầu tạo tóm tắt")
            }
          >
            {job ? "Đang tạo tóm tắt..." : "Tạo / cập nhật tóm tắt"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
