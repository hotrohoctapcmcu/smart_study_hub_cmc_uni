import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  ListTodo,
  BookOpen,
  Files,
  Bot,
  ChartNoAxesCombined,
  CalendarCheck,
  Mail,
  RefreshCw,
  Settings,
  X,
  Sparkles,
  ArrowUpRight,
  ChevronRight,
  NotebookPen,
  NotebookText,
  UserRound,
} from "lucide-react";
import foxAssets from "../../assets/foxAssets";
export const navigation = [
  ["/", "Tổng quan", LayoutDashboard],
  ["/schedule", "Thời khóa biểu", CalendarDays],
  ["/tasks", "Công việc", ListTodo],
  ["/learning", "Học tập", BookOpen],
  ["/textbook", "Vở ghi", NotebookPen],
  ["/notebooks", "Sổ tay", NotebookText],
  ["/documents", "Tài liệu", Files],
  ["/ai", "AI Tutor", Bot],
  ["/statistics", "Thống kê", ChartNoAxesCombined],
  ["/exams", "Kỳ thi", CalendarCheck],
  ["/email", "Email trường", Mail],
  ["/sync", "Đồng bộ", RefreshCw],
  ["/profile", "Hồ sơ", UserRound],
  ["/settings", "Cài đặt", Settings],
];
const submenus = {
  "/learning": [["subjects", "Môn học"], ["flashcards", "Flashcard"], ["quiz", "Quiz"], ["weaknesses", "Điểm cần cải thiện"], ["pomodoro", "Pomodoro"]],
  "/documents": [["documents", "Tài liệu"], ["notes", "Ghi chú"]],
};
export default function Sidebar({ isOpen, onClose, compact = false, sidebarRef }) {
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState({});
  const currentTab = new URLSearchParams(location.search).get("tab");
  return (
    <aside id="main-sidebar" ref={sidebarRef} className={"sidebar " + (isOpen ? "open" : "")}
      onClick={(event) => { if (event.target.closest?.("a[href]")) onClose?.(); }}
      role={compact && isOpen ? "dialog" : undefined}
      aria-modal={compact && isOpen ? true : undefined}
      aria-label="Menu Smart Study Hub"
      aria-hidden={compact && !isOpen ? true : undefined}
      inert={compact && !isOpen ? "" : undefined}>
      <NavLink className="brand" to="/">
        <span className="brand-icon brand-app-icon">
          <img src="/brand/app-icon.png" width="40" height="40" alt="" />
        </span>
        <div>
          <strong>Smart Study Hub<span className="brand-dot">.</span></strong>
          <small>HUB · CMC UNIVERSITY</small>
        </div>
      </NavLink>
      <button
        className="drawer-close icon-button"
        aria-label="Đóng menu"
        onClick={onClose}
      >
        <X size={19} />
      </button>
      <nav aria-label="Điều hướng chính">
        {navigation.map(([path, name, Icon], i) => (
          <div className="nav-entry" key={path}>
          {(i === 0 || path === "/exams") && <p className="nav-caption">{i === 0 ? "KHÔNG GIAN HỌC TẬP" : "CÁ NHÂN & KẾT NỐI"}</p>}
          {submenus[path] ? (
            <button
              type="button"
              className={"sidebar-item sidebar-group-toggle " + (location.pathname === path || location.pathname.startsWith(path + "/") ? "active" : "")}
              aria-expanded={!!expandedMenus[path]}
              aria-controls={`sidebar-submenu-${path.slice(1)}`}
              onClick={() => setExpandedMenus((menus) => ({ ...menus, [path]: !menus[path] }))}
            >
              <span className="nav-icon"><Icon size={19} strokeWidth={1.8} /></span>
              <span>{name}</span>
              <ChevronRight className="nav-chevron" size={14} />
            </button>
          ) : <NavLink
            end={path === "/"}
            to={path}
            key={path}
            className={({ isActive }) =>
              "sidebar-item " +
              (isActive ? "active" : "") +
              (path === "/ai" ? " nav-ai" : "")
            }
          >
            <span className="nav-icon"><Icon size={19} strokeWidth={1.8} /></span>
            <span>{name}</span>
            {path === "/ai" ? <small className="ai-label"><Sparkles size={10} /> AI</small> : <ChevronRight className="nav-chevron" size={14} />}
          </NavLink>}
          {submenus[path] && expandedMenus[path] && <div id={`sidebar-submenu-${path.slice(1)}`} className="sidebar-submenu" aria-label={name}>
            {submenus[path].map(([tab, label], index) => {
              const active = location.pathname === path && (currentTab === tab || (!currentTab && index === 0));
              return <Link key={tab} to={`${path}?tab=${tab}`} aria-current={active ? "page" : undefined} className={"sidebar-subitem " + (active ? "active" : "")}><span aria-hidden="true" />{label}</Link>;
            })}
          </div>}
          </div>
        ))}
      </nav>
      <div className="sidebar-mascot">
        <span className="sidebar-mascot-label"><Sparkles size={11} /> MỖI NGÀY TỐT HƠN</span>
        <p>
          Học hôm nay,
          <br />
          <strong>tỏa sáng ngày mai.</strong>
        </p>
        <img src={foxAssets["fox-study.png"]} alt="" />
        <NavLink to="/learning">
          Cùng học nào <ArrowUpRight size={14} />
        </NavLink>
      </div>
      <NavLink className="sidebar-profile" to="/profile">
        <img src={foxAssets["fox-student-avatar.png"]} alt="" />
        <div>
          <strong>Hồ sơ sinh viên</strong>
          <small>Không gian của bạn</small>
        </div>
        <ChevronRight size={16} />
      </NavLink>
    </aside>
  );
}
