/**
 * UniStudy CMC - Dashboard Feature Entry
 */
import { renderDashboardView } from "./dashboard.view.js";
import { attachDashboardEvents } from "./dashboard.events.js";
import { fetchDashboardData } from "./dashboard.service.js";
import { state } from "../../app/state.js";

export async function mountDashboard(containerEl) {
  // Render trước bằng state cache để không bao giờ để pane trắng
  // trong lúc chờ fetch bất đồng bộ (tránh race với renderShell).
  try {
    containerEl.innerHTML = renderDashboardView();
    attachDashboardEvents(containerEl);
  } catch (e) {
    console.error("[Dashboard] Lỗi render:", e);
    containerEl.innerHTML = `
      <div style="max-width:800px;margin:40px auto;background:white;padding:48px 32px;border-radius:16px;border:1px solid var(--ink-200);text-align:center;">
        <h3 style="margin:0 0 8px;">Không tải được Tổng quan</h3>
        <p class="muted">${String(e?.message || e)}</p>
        <button type="button" class="button primary" data-dash-goto="sync">Đi tới Đồng bộ dữ liệu</button>
      </div>`;
    attachDashboardEvents(containerEl);
  }

  if (!state.studentProfile) {
    try {
      await fetchDashboardData();
      // fetchDashboardData tự notify khi có profile thật -> shell re-render.
      // Không ghi innerHTML trực tiếp ở đây vì containerEl có thể đã
      // bị detach sau một renderShell khác (ghi vào DOM chết = vẫn trắng).
    } catch (e) {
      console.warn("[Dashboard] Không thể tải dữ liệu dashboard:", e.message);
    }
  }
}

