import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { BookOpen, RefreshCw, Sparkles, ArrowUpRight } from "lucide-react";
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
import FlashcardReview from "../../components/learning/FlashcardReview";
import { sameLearningSubject } from "../../utils/learningFlow";
import { useLearningCatalog, learningJobActive } from '../../hooks/useLearningCatalog';
import LearningQueue from '../../components/learning/LearningQueue';
import { textContent } from "../../utils/files";
import foxAssets from "../../assets/foxAssets";
import AIContent, { EditableAIContent } from '../../components/common/AIContent';

export function CourseCard({ course, onSelect, onSync }) {
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
        <span>{course.pending ? 'Chưa có slide đã quét' : `${course.chapterCount ?? chapters.length} chương${course.sourceCount != null ? ` · ${course.sourceCount} slide` : ''}`}</span>
        <span>{course.cardCount ?? cards.length} flashcard</span>
      </div>
      {!course.pending && <ProgressBar value={course.progress ?? course.summary?.progress ?? 0} />}
      {course.pending && <p className="hint">{course.failures?.[0]?.message || 'Đồng bộ slide từ EDUX để tải nội dung. AI chỉ tóm tắt khi bạn bấm yêu cầu.'}</p>}
      {!course.pending && course.summary && !course.summary.stale && <p className="hint">Đã lưu bản tóm tắt{course.summary.format === 'sections' ? ' theo phần' : course.summary.format === 'expanded' ? ' dạng dài' : ''}.</p>}
      {!course.pending && course.failures?.length > 0 && <p className="hint">{course.failures[0].stage === 'cards' ? 'Tạo Flashcard: ' : ''}{course.failures[0].message}</p>}
      {!course.pending && course.summary?.cardsState?.status === 'partial' && <p className="hint">Flashcard đã lưu {course.summary.cardsState.completedBatches}/{course.summary.cardsState.totalBatches} lô. Có thể ôn thẻ đã có và tạo tiếp phần còn lại.</p>}
      <div className="summary-line">
        <small>
          {course.progress != null ? course.progress + '% hoàn thành' : 'Học theo nhịp của bạn'}
        </small>
        <Button size="sm" variant="outline" onClick={() => onSelect(course)}>
          {course.pending ? 'Xem trạng thái' : 'Vào học ↗'}
        </Button>
      </div>
      {onSync && !course.pending && <Button size="sm" variant="ghost" onClick={onSync}>Đồng bộ slide môn này</Button>}
    </article>
  );
}
export default function Learning() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const reviewSubject = params.get("subject") || "", reviewTopic = params.get("topic") || "";
  const tabAliases = { subjects: "courses", courses: "courses", flashcards: "flashcard", flashcard: "flashcard", quiz: "quiz", weaknesses: "weakness", weakness: "weakness", pomodoro: "pomodoro" };
  const tab = tabAliases[params.get("tab")] || "courses";
  function setTab(value) {
    const next = new URLSearchParams(params);
    next.set("tab", { courses: "subjects", flashcard: "flashcards", weakness: "weaknesses" }[value] || value);
    setParams(next);
  }
  const state = useLearningCatalog({
    onChange: catalog => {
      if (!selected) return;
      const next = catalog.courses.find(c => c.id === selected.id || sameLearningSubject(c.subject || c.subject_name, selected.subject || selected.subject_name));
      if (next) { setSelected(next); detail.execute(next.id); if (next.summary && !next.summary.stale) summary.execute(next.id); }
    },
    onSettled: entry => {
      notify(entry.message || entry.error, ["completed", "done", "succeeded"].includes(String(entry.status).toLowerCase()) ? "success" : "error");
      if (selected && entry.courseId === selected.id) { detail.execute(selected.id); summary.execute(selected.id); }
    },
  });
  const weakness = useApi(weaknessApi.list, { immediate: false });
  const [selected, setSelected] = useState(null),
    [detailTab, setDetailTab] = useState("summary");
  const detail = useApi(courseApi.detail, { immediate: false }),
    source = useApi(courseApi.source, { immediate: false }),
    summary = useApi(courseApi.summary, { immediate: false });
  const { run, busy, notify } = useAction();
  const courses = responseList(state.data, "courses");
  const weaknessTopics = responseList(weakness.data, "topics").map((topic) => ({
    ...topic,
    ...(Array.isArray(weakness.data?.advice)
      ? weakness.data.advice.find((advice) => advice.key === topic.key)
      : null),
  }));
  useEffect(() => {
    if (tab === "weakness") weakness.execute();
  }, [tab, state.data, state.loading, state.error, weakness.execute]);
  function open(c) {
    setSelected(c);
    setDetailTab(c.summary && !c.summary.stale ? "summary" : "chapters");
    detail.execute(c.id);
    if (c.summary && !c.summary.stale) summary.execute(c.id);
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
              if (!result?.jobId) throw new Error('Máy chủ chưa trả yêu cầu đồng bộ hợp lệ.');
              state.watch(result, { kind: "sync" });
            }, "Đã yêu cầu đồng bộ học liệu")
          }
        >
          <RefreshCw size={14} />
          Đồng bộ học liệu
        </Button>
      </PageHeader>
      <LearningQueue queue={state} />
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
      {reviewSubject && ["flashcard", "quiz"].includes(tab) && <div className="filter-bar"><p className="hint">Ôn lại môn {reviewSubject}{reviewTopic ? ` · ${reviewTopic}` : ""}</p><Button size="sm" variant="ghost" onClick={() => { const next = new URLSearchParams(params); next.delete("subject"); next.delete("topic"); setParams(next); }}>Xem tất cả môn</Button></div>}
      {tab === "courses" ? (
        <ApiContent state={state}>
          {courses.length ? (
            <div className="course-grid" data-region="C" aria-label="C. Danh sách môn học">
              {courses.map((c) => (
                <CourseCard course={c} key={c.id} onSelect={open} onSync={() => run(async () => { const result = unwrapResponse(await courseApi.sync({ subjectId: c.id })); if (!result?.jobId) throw new Error('Máy chủ chưa trả yêu cầu đồng bộ hợp lệ.'); state.watch(result, { kind: "sync", courseId: c.id, subject: c.subject }); }, 'Đã thêm yêu cầu đồng bộ slide vào hàng đợi')} />
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
        <ApiContent state={state}><FlashcardReview key={`${reviewSubject}:${reviewTopic}:${courses.map(c => `${c.id}:${c.cardCount ?? ''}:${c.summary?.summaryHash || ''}`).join()}`} courses={courses} subject={reviewSubject} topic={reviewTopic} /></ApiContent>
      ) : tab === "quiz" ? (
        <QuizPanel key={`${reviewSubject}:${reviewTopic}`} initialSubject={reviewSubject} initialTopic={reviewTopic} initialCount={Number(params.get('count')) || 10} initialCreate={params.get('create') === '1'} />
      ) : tab === "pomodoro" ? (
        <PomodoroTimer initialMinutes={params.get('minutes') || 25} initialContext={{ subjectId: params.get('subjectId') || '', subjectName: reviewSubject, taskId: params.get('taskId') || '', taskSource: params.get('taskSource') || null, goal: params.get('goal') || reviewTopic, topic: reviewTopic.slice(0, 200) }} onReview={(target, context) => { const next = new URLSearchParams(); next.set("tab", target === "flashcard" ? "flashcards" : "quiz"); next.set("subject", context.subjectName || ""); next.set("topic", context.topic || context.goal || ""); setParams(next); }} />
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
                  <p className="hint">Trước luyện: {w.previousScore == null ? 'Chưa có lần đo trước' : `${w.previousScore}%`} · Sau luyện: {w.latestScore == null ? 'Chưa có dữ liệu' : `${w.latestScore}%`}{w.improvement != null ? ` · Thay đổi ${w.improvement > 0 ? '+' : ''}${w.improvement} điểm %` : ''}</p>
                  <div className="actions"><Button size="sm" onClick={() => setParams(new URLSearchParams({ tab: 'quiz', subject: w.subject || '', topic: w.topic || '', count: '5', create: '1' }))}>Luyện 5 câu</Button><Button size="sm" variant="outline" onClick={() => setParams(new URLSearchParams({ tab: 'pomodoro', subject: w.subject || '', topic: w.topic || '', minutes: '15', subjectId: String(state.data?.scope?.courses?.find(c => sameLearningSubject(c.subjectName, w.subject))?.subjectId || '') }))}>Học lại 15 phút</Button><Button size="sm" variant="outline" onClick={() => navigate(`/documents?${new URLSearchParams({ tab: 'files', q: w.subject || '' })}`)}>Mở tài liệu</Button></div>
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
              if (v === 'summary') summary.execute(selected.id);
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
                <EmptyState title="Chưa có chương học" description={selected?.failures?.[0]?.message || 'Chưa có slide đã quét. Hãy đồng bộ học liệu từ EDUX.'} />
              )}
            </ApiContent>
          ) : (
            <ApiContent state={detailTab === "summary" ? summary : source}>
              {detailTab === 'summary' ? <>{(detail.data?.summary?.notice || selected?.summary?.notice) && <p className="hint" role="status">{detail.data?.summary?.notice || selected?.summary?.notice}</p>}<EditableAIContent text={summary.data?.summary?.content ?? summary.data?.summary ?? summary.data?.content ?? summary.data ?? 'Chưa có nội dung.'} /></> :
                <div className="pre-wrap">{textContent(source.data?.text ?? source.data?.content ?? source.data ?? 'Chưa có nội dung.')}</div>}
            </ApiContent>
          )}
          <p className="hint">Đồng bộ slide không tự gọi AI. Chỉ bấm nút dưới đây khi muốn tạo tóm tắt và Flashcard cho môn này.</p>
          <Button
            disabled={busy || selected?.pending || selected?.complete === false || state.jobs.some(entry => learningJobActive(entry) && entry.kind === "summary" && entry.courseId === selected?.id)}
            onClick={() =>
              run(async () => {
                const result = unwrapResponse(
                  await courseApi.summarize(selected.id),
                );
                const id = result?.jobId || result?.job_id || result?.job?.id;
                if (!id) throw new Error('Máy chủ chưa trả yêu cầu tóm tắt hợp lệ.');
                state.watch({ ...result, jobId: id }, { kind: "summary", courseId: selected.id, subject: selected.subject });
              }, "Đã gửi yêu cầu tạo tóm tắt")
            }
          >
            {state.jobs.some(entry => learningJobActive(entry) && entry.kind === 'summary' && entry.courseId === selected?.id) ? 'Đã vào hàng đợi tóm tắt' : selected?.summary && !selected.summary.stale && selected.summary.cardsState?.status !== 'complete' && (selected.summary.cardsState?.status || !selected.cardCount) ? 'Tạo tiếp Flashcard' : 'Tạo / cập nhật tóm tắt'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
