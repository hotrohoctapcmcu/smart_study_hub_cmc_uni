import { Award, BarChart3, BookOpenCheck, WalletCards } from "lucide-react";
import { Link } from 'react-router-dom';
import { LoadingSkeleton } from "../common/ui";

export default function StudyStats({ stats, loading, error, onEditCredits, creditSync }) {
  if (loading) return <section className="profile-stats" aria-label="Đang tải tổng quan học tập">{[1, 2, 3, 4].map((key) => <LoadingSkeleton key={key} className="profile-stat-skeleton" />)}</section>;
  const hasCreditTotal = stats.totalCredits > 0;
  const cards = [
    {
      key: "gpa",
      label: "GPA tích lũy",
      value: `${stats.gpa4Text} / 4`,
      detail: error ? "Chưa thể tải dữ liệu điểm" : `Điểm tích lũy hệ 10: ${stats.gpaText} / 10`,
      Icon: BarChart3,
      tone: "pink",
    },
    {
      key: "subjects",
      label: "Số môn đã học",
      value: `${stats.subjectCompleted} / ${stats.subjectTotal} môn`,
      detail: `${stats.subjectPercent}% đã có kết quả`,
      progress: stats.subjectPercent,
      Icon: BookOpenCheck,
      tone: "mint",
    },
    {
      key: "rank",
      label: "Xếp loại tham khảo",
      value: stats.classification,
      detail: stats.gpa >= 7.7
        ? "Dự kiến: Giỏi nếu duy trì kết quả hiện tại"
        : "Giữ nhịp học đều để cải thiện xếp loại",
      Icon: Award,
      tone: "blue",
    },
    {
      key: "credits",
      label: "Tín chỉ tích lũy",
      value: stats.completedCredits == null ? "Chưa có dữ liệu"
        : hasCreditTotal ? `${stats.completedCredits} / ${stats.totalCredits} tín chỉ` : `${stats.completedCredits} tín chỉ`,
      detail: stats.creditPercent === null ? "Chưa có tổng tín chỉ chương trình" : `${stats.creditPercent}% ${stats.creditScope}`,
      progress: stats.creditPercent ?? undefined,
      Icon: WalletCards,
      tone: "violet",
    },
  ];

  const number = value => value == null ? '—' : Number(value).toFixed(2);
  const overall = stats.academicSummary?.overall;
  return <>
    <section className="profile-stats" aria-label="Tổng quan học tập">
      {cards.map(({ key, label, value, detail, progress, Icon, tone }) => (
        <article className={`profile-stat profile-stat-${tone}`} key={key}>
          <div className="profile-stat-top">
            <span className="profile-stat-icon"><Icon size={20} /></span>
            <span className="profile-stat-label">{label}</span>
          </div>
          <strong>{value}</strong>
          {progress !== undefined && (
            <div className="profile-stat-progress" aria-label={`${progress}%`}>
              <span style={{ width: `${progress}%` }} />
            </div>
          )}
          <p>{detail}</p>
          {key === 'credits' && <>
            {stats.requiredCredits != null && <p className="profile-required-credits">Tổng tín chỉ bắt buộc: <b>{stats.requiredCredits}</b></p>}
            {creditSync?.needsUpdate && <div className="profile-credit-sync" aria-busy={creditSync.busy}>
              <button type="button" className="profile-text-link" disabled={creditSync.busy} onClick={() => creditSync.update()}>
                {creditSync.busy ? 'Đang cập nhật tín chỉ…' : 'Đồng bộ tín chỉ IU'}
              </button>
              {creditSync.message && <p role="status">{creditSync.message}</p>}
              {creditSync.needsConnection && !window.__uniStudyIU?.isAvailable && <Link className="profile-text-link" to="/sync">Mở trang Đồng bộ</Link>}
            </div>}
            {!hasCreditTotal && onEditCredits && <button type="button" className="profile-text-link" onClick={onEditCredits}>Cập nhật tổng tín chỉ</button>}
          </>}
        </article>
      ))}
    </section>
  {overall && <section className="profile-academic-summary" aria-label="Đối chiếu điểm IU">
    <div><strong>Đối chiếu điểm IU</strong><p>Tách điểm trung bình và tích lũy theo dữ liệu đã đồng bộ.</p></div>
    <dl>{[
      ['Trung bình hệ 10', overall.average10, 10], ['Trung bình hệ 4', overall.average4, 4],
      ['Tích lũy hệ 10', overall.cumulative10, 10], ['Tích lũy hệ 4', overall.cumulative4, 4],
    ].map(([label, value, scale]) => <div key={label}><dt>{label}</dt><dd>{number(value)} <small>/ {scale}</small></dd></div>)}</dl>
    <p>Môn P/NP không tính GPA. Kết quả học lại được giữ trong bảng điểm; chỉ kết quả hoàn tất mới nhất của mỗi môn dùng cho tổng tích lũy.</p>
  </section>}
  {stats.requiredCredits != null && <section className="profile-academic-summary" aria-label="Tín chỉ theo khối IU">
    <div><strong>Tín chỉ theo khối IU</strong><p>Theo mục Khối kiến thức trên trang Tra cứu điểm IU.</p></div>
    <dl>{[
      ['Tổng tín chỉ các khối', stats.availableBlockCredits],
      ['Tổng tín chỉ bắt buộc', stats.requiredCredits],
      ['Tín chỉ tích lũy theo khối', stats.blockEarnedCredits],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'} <small>tín chỉ</small></dd></div>)}</dl>
  </section>}</>;
}
