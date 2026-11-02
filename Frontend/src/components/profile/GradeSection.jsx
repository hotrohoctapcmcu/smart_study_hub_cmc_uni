import { useMemo, useState } from "react";
import { Download, Search, SlidersHorizontal } from "lucide-react";
import { Button, EmptyState, ErrorState, LoadingSkeleton } from "../common/ui";
import { asNumber, getScoreTone, isPassed } from "./profileData";

function downloadGradeCsv(rows) {
  const header = ["STT", "Môn học", "Mã môn", "Tín chỉ", "Điểm", "Xếp loại", "Học kỳ", "Trạng thái"];
  const body = rows.map((row, index) => [
    index + 1,
    row.subject,
    row.subjectCode,
    row.credits ?? "",
    row.score ?? "",
    row.grade || "",
    row.semester,
    row.score === null || row.score === undefined ? "Đang học" : "Đã hoàn thành",
  ]);
  const csv = [header, ...body]
    .map((line) => line.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "bang-diem-smart-study-hub.csv";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function GradeSection({ state, rows, semesters, semester, onSemesterChange, compact = false }) {
  const [query, setQuery] = useState("");
  const [scoreFilter, setScoreFilter] = useState("all");
  const filteredRows = useMemo(() => rows.filter((row) => {
    const haystack = `${row.subject} ${row.subjectCode}`.toLocaleLowerCase("vi");
    const matchesQuery = haystack.includes(query.trim().toLocaleLowerCase("vi"));
    const score = asNumber(row.score);
    const matchesScore = scoreFilter === "all"
      || (scoreFilter === "great" && score >= 8)
      || (scoreFilter === "passed" && score >= 5 && score < 8)
      || (scoreFilter === "risk" && score !== null && score < 5)
      || (scoreFilter === "pending" && (row.score === null || row.score === undefined));
    return matchesQuery && matchesScore;
  }), [query, rows, scoreFilter]);

  return (
    <section className={`profile-panel grade-panel ${compact ? "grade-panel-compact" : ""}`} aria-labelledby="grade-heading">
      <div className="profile-panel-heading">
        <div>
          <span className="profile-panel-kicker">KẾT QUẢ HỌC TẬP</span>
          <h2 id="grade-heading">Bảng điểm</h2>
          <p>Theo dõi điểm số, xếp loại và trạng thái từng môn học.</p>
        </div>
        <Button variant="outline" onClick={() => downloadGradeCsv(filteredRows)} disabled={!filteredRows.length}>
          <Download size={15} /> Tải xuống
        </Button>
      </div>

      <div className="grade-toolbar">
        <label className="grade-select-wrap">
          <span className="sr-only">Lọc học kỳ</span>
          <select aria-label="Lọc học kỳ" value={semester} onChange={(event) => onSemesterChange(event.target.value)}>
            <option value="">Tất cả học kỳ</option>
            {semesters.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="grade-search">
          <Search size={16} />
          <input
            aria-label="Tìm môn học"
            placeholder="Tìm môn học..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="grade-filter">
          <SlidersHorizontal size={16} />
          <select aria-label="Bộ lọc điểm" value={scoreFilter} onChange={(event) => setScoreFilter(event.target.value)}>
            <option value="all">Bộ lọc</option>
            <option value="great">Từ 8.0</option>
            <option value="passed">Đã đạt</option>
            <option value="risk">Cần cải thiện</option>
            <option value="pending">Đang học</option>
          </select>
        </label>
      </div>

      {state.loading ? (
        <div className="grade-loading"><LoadingSkeleton /><LoadingSkeleton /></div>
      ) : state.error ? (
        <div className="grade-state"><ErrorState error={state.error} onRetry={state.refetch} title="Không thể tải bảng điểm" /></div>
      ) : !filteredRows.length ? (
        <EmptyState
          title="Chưa có dữ liệu bảng điểm"
          description={query || scoreFilter !== "all" ? "Hãy thử thay đổi từ khóa hoặc bộ lọc." : "Điểm số sẽ xuất hiện sau khi dữ liệu được đồng bộ."}
        />
      ) : (
        <div className="profile-table-wrap">
          <table className="data-table profile-grade-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Môn học</th>
                <th>Mã môn</th>
                <th>Tín chỉ</th>
                <th>Điểm</th>
                <th>Xếp loại</th>
                <th>Học kỳ</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => {
                const pending = asNumber(row.score) === null;
                const tone = getScoreTone(row.score);
                return (
                  <tr key={row.id || `${row.subjectCode}-${index}`}>
                    <td><span className="grade-index">{String(index + 1).padStart(2, "0")}</span></td>
                    <td><strong className="grade-subject">{row.subject || "Môn học chưa đặt tên"}</strong></td>
                    <td><span className="grade-code">{row.subjectCode || "—"}</span></td>
                    <td>{row.credits ?? "—"}</td>
                    <td><span className={`grade-score grade-score-${tone}`}>{pending ? "—" : row.score}</span></td>
                    <td><span className={`grade-letter grade-letter-${tone}`}>{row.grade || "—"}</span></td>
                    <td>{row.semester || "—"}</td>
                    <td><span className={`grade-status ${pending ? "is-studying" : isPassed(row) ? "is-complete" : "is-failed"}`}><i />{pending ? "Đang học" : isPassed(row) ? "Đã hoàn thành" : "Chưa đạt"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
