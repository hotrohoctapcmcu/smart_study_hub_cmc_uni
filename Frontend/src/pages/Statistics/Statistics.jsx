import { useState } from "react";
import { Clock, BookOpen, ListTodo, FileText, RefreshCw } from "lucide-react";
import { progressApi, timemapApi } from "../../api";
import { useApi } from "../../hooks/useApi";
import { responseList } from "../../api/apiClient";
import {
  mapProgress,
  mapTimeBlocks,
  dailyStudyHours,
} from "../../utils/progressAdapter";
import { formatDateTime, isToday } from "../../utils/date";
import {
  PageHeader,
  Card,
  Button,
  ApiContent,
  Tabs,
} from "../../components/common/ui";
import { StatCard } from "../../components/dashboard/Widgets";
import ProgressChart from "../../components/charts/ProgressChart";
export default function Statistics() {
  const [journalPeriod, setJournalPeriod] = useState("week");
  const state = useApi(progressApi.getProgress),
    timemap = useApi(timemapApi.getTimemap);
  const p = mapProgress(state.data || {});
  const stats = [
    ["Tổng thời gian học", p.totalHours + " giờ", Clock],
    ["Buổi học", p.studySessions, BookOpen],
    ["Hoàn thành công việc", p.completionRate + "%", ListTodo],
    ["Tài liệu đã mở", p.documentsOpened, FileText],
  ];
  const events = mapTimeBlocks(timemap.data).filter(
    (e) => !["free", "free-time"].includes(e.type),
  );
  const journalEvents = events.filter(event => journalPeriod !== "today" || isToday(event.startTime || event.start_time || event.date));
  return (
    <div className="page statistics-page">
      <PageHeader
        eyebrow="HÀNH TRÌNH TIẾN BỘ"
        title="Thống kê học tập"
        description="Nhìn lại hành trình, tìm thêm động lực để tiến lên."
      >
        <Button
          variant="outline"
          onClick={() => {
            state.refetch();
            timemap.refetch();
          }}
        >
          <RefreshCw size={14} />
          Làm mới
        </Button>
      </PageHeader>
      <div className="stats-grid" data-region="B" aria-label="B. Chỉ số học tập">
        {stats.map(([label, value, icon]) => (
          <StatCard
            key={label}
            label={label}
            value={state.loading || state.error ? "—" : value}
            icon={icon}
          />
        ))}
      </div>
      <ApiContent state={state}>
        <div className="two-columns">
          <Card title="Thời gian học theo ngày" region="C">
            <ProgressChart
              data={
                p.dailyHours.length ? p.dailyHours : dailyStudyHours(events)
              }
            />
          </Card>
          <Card title="Tiến độ từng môn" region="D">
            <ProgressChart data={p.subjectProgress} kind="subject" />
          </Card>
          <Card title="Phân bổ thời gian" region="E">
            <ProgressChart data={p.timeAllocation} kind="pie" />
          </Card>
          <Card title="Nhật ký học tập" region="F">
            <Tabs value={journalPeriod} onChange={setJournalPeriod} items={[["week", "Tuần này"], ["today", "Hôm nay"]]} />
            <p className="hint">Các hoạt động trong tuần hiện tại từ lịch học và phiên tập trung.</p>
            <ApiContent state={timemap} empty={!journalEvents.length}>
              {journalEvents.map((e, i) => (
                <div className="history-row" key={e.id || i}>
                  <div>
                    <strong>{e.title || e.subject || e.activity}</strong>
                    <small className="muted" style={{ display: "block" }}>
                      {formatDateTime(
                        e.startTime || e.created_at || e.start_time || e.date,
                      )}
                    </small>
                  </div>
                  <span>{e.duration ? e.duration + " phút" : ""}</span>
                </div>
              ))}
            </ApiContent>
          </Card>
        </div>
      </ApiContent>
    </div>
  );
}
