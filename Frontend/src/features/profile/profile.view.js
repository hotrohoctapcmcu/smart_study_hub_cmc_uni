/**
 * UniStudy CMC - Profile View (Hồ sơ học tập cá nhân)
 * Chỉ hiển thị 1 lần Họ tên và Mã sinh viên (bỏ chỉnh sửa thông tin)
 * Hiển thị thêm: GPA tổng, Số tín chỉ tích lũy / tổng số phải học, Xếp loại GPA 4.0, Bảng điểm chi tiết
 */
import { state } from "../../app/state.js";
import { ASSETS } from "../../shared/config/assets.js";
import { getGpaClassification } from "./profile.service.js";
import { escapeHtml } from "../../shared/utils/validation.js";

function formatSemester(sem) {
  if (!sem) return "-";
  const match = String(sem).match(/^(\d+)_(.+)$/);
  if (match) {
    return `HK${match[1]} (${match[2].replace("_", "-")})`;
  }
  return sem;
}

export function renderProfileView() {
  const profile = state.studentProfile || {
    name: "Chưa có dữ liệu",
    studentId: "Chưa có dữ liệu",
    major: "Công nghệ thông tin",
    gpa: 0,
    gpa10: 0,
    credits: 0,
    totalRequiredCredits: 135,
    grades: []
  };

  const isCustomized = Boolean(state.studentProfile && state.studentProfile.name && state.studentProfile.name !== "Chưa có dữ liệu");
  const classification = getGpaClassification(profile.gpa);
  const grades = Array.isArray(profile.grades) ? profile.grades : [];
  const totalPassedCredits = Number(profile.credits || 0);
  const totalRequiredCredits = Number(profile.totalRequiredCredits || 135);
  const creditPercent = Math.min(100, Math.round((totalPassedCredits / (totalRequiredCredits || 1)) * 100));

  return `
    <div class="profile-container">
      <!-- Tiêu đề trang -->
      <div class="profile-header-wrap">
        <div>
          <span class="eyebrow"><svg><use href="#i-user"></use></svg> Thông tin sinh viên</span>
          <h1 style="margin:4px 0 0;font-size:1.8rem;color:var(--ink-950);">Hồ sơ học tập cá nhân</h1>
        </div>
      </div>

      <!-- Thẻ chính Hồ sơ Sinh viên: Chỉ hiện 1 lần Họ tên và Mã sinh viên -->
      <div class="profile-main-card">
        <div style="text-align:center;">
          <div class="profile-avatar-wrap">
            <img src="${ASSETS.fox.studentAvatar}" alt="Linh vật sinh viên CMC" />
          </div>
        </div>

        <div style="flex:1;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
              <h2 style="margin:0;font-size:1.6rem;color:var(--ink-950);">${escapeHtml(profile.name)}</h2>
              <div class="profile-badge-row">
                <span class="profile-code-tag">
                  <svg style="width:14px;height:14px;"><use href="#i-user"></use></svg>
                  MSSV: <strong>${escapeHtml(profile.studentId)}</strong>
                </span>
                <span class="profile-major-tag">
                  <svg style="width:14px;height:14px;"><use href="#i-book"></use></svg>
                  Ngành: <strong>${escapeHtml(profile.major || "Chưa có dữ liệu")}</strong>
                </span>
              </div>
            </div>
            <button type="button" class="button danger small" id="profileLogoutBtn">
              <svg><use href="#i-logout"></use></svg>
              <span>Thoát phiên làm việc</span>
            </button>
          </div>

          <div style="margin-top:16px;">
            ${
              isCustomized
                ? `<span class="badge-draft" style="background:#ecfdf5;color:#047857;border-color:#a7f3d0;"><svg style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"><use href="#i-check"></use></svg> Dữ liệu hồ sơ sinh viên đã đồng bộ từ hệ thống đào tạo CMC</span>`
                : `<span class="muted small">Dữ liệu hồ sơ sẽ được cập nhật tự động khi kết nối với cổng trường CMC.</span>`
            }
          </div>
        </div>
      </div>

      <!-- Thống kê GPA & Tín chỉ tích lũy -->
      <div class="profile-stats-grid">
        <!-- Thẻ GPA -->
        <div class="profile-stat-card">
          <div class="stat-card-top">
            <span class="stat-icon-wrap" style="color:var(--violet-600);background:var(--violet-50);">
              <svg><use href="#i-spark"></use></svg>
            </span>
            <span class="classification-badge badge-${classification.badgeClass}">
              ${classification.rank}
            </span>
          </div>
          <div class="stat-card-value">
            ${Number(profile.gpa || 0).toFixed(2)}
            <small style="font-size:1rem;color:var(--ink-500);font-weight:600;">/ 4.0</small>
          </div>
          <div class="stat-card-label">Điểm trung bình tích lũy (GPA)</div>
          <div class="stat-card-sub">
            ${profile.gpa10 ? `Điểm hệ 10: <strong>${Number(profile.gpa10).toFixed(2)}</strong> · ` : ""}
            Xếp loại: <strong>${classification.rank}</strong>
          </div>
        </div>

        <!-- Thẻ Tín chỉ -->
        <div class="profile-stat-card">
          <div class="stat-card-top">
            <span class="stat-icon-wrap" style="color:var(--emerald-600);background:var(--emerald-50);">
              <svg><use href="#i-check"></use></svg>
            </span>
            <span class="status-pill violet">${creditPercent}%</span>
          </div>
          <div class="stat-card-value">
            ${totalPassedCredits} 
            <small style="font-size:1rem;color:var(--ink-500);font-weight:600;">/ ${totalRequiredCredits} TC</small>
          </div>
          <div class="stat-card-label">Tín chỉ đã tích lũy trên tổng số</div>
          <div class="credit-progress-bar-wrap">
            <div class="credit-progress-fill" style="width:${creditPercent}%;"></div>
          </div>
          <div class="stat-card-sub">
            Còn <strong>${Math.max(0, totalRequiredCredits - totalPassedCredits)}</strong> tín chỉ cần hoàn thành
          </div>
        </div>

        <!-- Thẻ Xếp loại học lực đối chiếu -->
        <div class="profile-stat-card">
          <div class="stat-card-top">
            <span class="stat-icon-wrap" style="color:var(--blue-600);background:var(--blue-50);">
              <svg><use href="#i-clock"></use></svg>
            </span>
            <span class="badge-draft" style="color:${classification.color};">${classification.desc}</span>
          </div>
          <div class="stat-card-value" style="color:${classification.color};">
            ${classification.rank}
          </div>
          <div class="stat-card-label">Xếp loại học lực hiện tại</div>
          <div class="stat-card-sub">
            Căn cứ theo thang điểm GPA 4.0 quy chế đào tạo CMC
          </div>
        </div>
      </div>

      <!-- Thẻ Bảng điểm chi tiết & Thang xếp loại quy định -->
      <div class="profile-grades-card">
        <div class="grades-card-header">
          <div>
            <h3 style="margin:0 0 4px;font-size:1.2rem;color:var(--ink-950);">Bảng điểm học tập chi tiết</h3>
            <p class="muted small" style="margin:0;">Điểm quá trình, điểm thi và xếp loại học phần từ hệ thống đào tạo.</p>
          </div>
          <button type="button" class="button primary small" id="refreshGradesBtn">
            <svg><use href="#i-refresh"></use></svg>
            <span>Cập nhật bảng điểm</span>
          </button>
        </div>

        ${
          grades.length > 0
            ? `
            <div class="grades-table-responsive">
              <table class="grades-table">
                <thead>
                  <tr>
                    <th>Mã học phần</th>
                    <th>Tên học phần</th>
                    <th style="text-align:center;">Học kỳ</th>
                    <th style="text-align:center;">Số TC</th>
                    <th style="text-align:center;">Điểm QT</th>
                    <th style="text-align:center;">Điểm thi</th>
                    <th style="text-align:center;">Tổng kết (10)</th>
                    <th style="text-align:center;">Điểm chữ</th>
                    <th style="text-align:center;">Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  ${grades
                    .map((g) => {
                      const isPass = g.is_passed === 1 || g.isPassed === true;
                      const letter = (g.letter_grade || g.letterGrade || "-").toUpperCase();
                      const finalScore = g.final_score !== null && g.final_score !== undefined ? Number(g.final_score).toFixed(1) : "-";
                      const compScore = g.component_score !== null && g.component_score !== undefined ? Number(g.component_score).toFixed(1) : "-";
                      const examScore = g.exam_score !== null && g.exam_score !== undefined ? Number(g.exam_score).toFixed(1) : "-";
                      const semFormatted = formatSemester(g.semester);

                      return `
                        <tr>
                          <td><span class="code-badge">${escapeHtml(g.subject_code || g.subjectCode || "")}</span></td>
                          <td><strong>${escapeHtml(g.subject_name || g.subjectName || "Học phần")}</strong></td>
                          <td style="text-align:center;"><span class="sem-badge">${escapeHtml(semFormatted)}</span></td>
                          <td style="text-align:center;font-weight:600;">${g.credits ?? 3}</td>
                          <td style="text-align:center;">${compScore}</td>
                          <td style="text-align:center;">${examScore}</td>
                          <td style="text-align:center;font-weight:700;color:var(--ink-950);">${finalScore}</td>
                          <td style="text-align:center;"><span class="grade-letter-pill ${letter.startsWith("A") ? "a" : letter.startsWith("B") ? "b" : letter.startsWith("C") ? "c" : letter.startsWith("D") ? "d" : "f"}">${letter}</span></td>
                          <td style="text-align:center;">
                            <span class="result-pill ${isPass ? "pass" : "fail"}">
                              ${isPass ? "✓ Đạt" : "✗ Chưa đạt"}
                            </span>
                          </td>
                        </tr>
                      `;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>
          `
            : `
            <div class="grades-empty-box">
              <svg style="width:40px;height:40px;color:var(--ink-400);margin-bottom:8px;"><use href="#i-tasks"></use></svg>
              <h4 style="margin:0 0 6px;color:var(--ink-900);">Chưa có dữ liệu bảng điểm</h4>
              <p class="muted small" style="margin:0 0 16px;max-width:480px;">
                Dữ liệu bảng điểm sẽ được lấy từ hệ thống sau khi đồng bộ hoặc bạn có thể bấm "Cập nhật bảng điểm" để làm mới.
              </p>
            </div>
          `
        }

        <!-- Bảng quy đổi & đối chiếu thang điểm GPA 4.0 chuẩn -->
        <div class="gpa-reference-box">
          <div class="gpa-ref-title">
            <svg style="width:16px;height:16px;color:var(--violet-700);"><use href="#i-spark"></use></svg>
            <strong>Thang đối chiếu xếp loại học lực dựa trên GPA hệ 4.0</strong>
          </div>
          <div class="gpa-ref-grid">
            <div class="gpa-ref-item ${classification.rank === "Xuất sắc" ? "current-rank" : ""}">
              <span class="gpa-ref-rank" style="color:#059669;">Xuất sắc</span>
              <span class="gpa-ref-range">3.6 – 4.0</span>
            </div>
            <div class="gpa-ref-item ${classification.rank === "Giỏi" ? "current-rank" : ""}">
              <span class="gpa-ref-rank" style="color:#2563eb;">Giỏi</span>
              <span class="gpa-ref-range">3.2 – cận 3.6</span>
            </div>
            <div class="gpa-ref-item ${classification.rank === "Khá" ? "current-rank" : ""}">
              <span class="gpa-ref-rank" style="color:#7c3aed;">Khá</span>
              <span class="gpa-ref-range">2.5 – cận 3.2</span>
            </div>
            <div class="gpa-ref-item ${classification.rank === "Trung bình" ? "current-rank" : ""}">
              <span class="gpa-ref-rank" style="color:#d97706;">Trung bình</span>
              <span class="gpa-ref-range">2.0 – cận 2.5</span>
            </div>
            <div class="gpa-ref-item ${classification.rank === "Yếu" ? "current-rank" : ""}">
              <span class="gpa-ref-rank" style="color:#ea580c;">Yếu</span>
              <span class="gpa-ref-range">1.0 – cận 2.0</span>
            </div>
            <div class="gpa-ref-item ${classification.rank === "Kém" ? "current-rank" : ""}">
              <span class="gpa-ref-rank" style="color:#dc2626;">Kém</span>
              <span class="gpa-ref-range">Dưới 1.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
