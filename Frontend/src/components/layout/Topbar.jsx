import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Menu,
  Search,
  Bell,
  RefreshCw,
  GraduationCap,
  Trash2,
  ChevronRight,
  Sparkles,
  ChevronDown,
  UserRound,
  Settings,
} from "lucide-react";
import { studentApi, notificationApi, syncApi } from "../../api";
import { responseList } from "../../api/apiClient";
import { useApi } from "../../hooks/useApi";
import { mapNotification } from "../../utils/notificationAdapter";
import { mapStudent } from "../../utils/studentAdapter";
import { formatDateTime } from "../../utils/date";
import {
  Button,
  Badge,
  Modal,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  useAction,
} from "../common/ui";
import foxAssets from "../../assets/foxAssets";
import { readPreferences } from "../../utils/preferences";
import WorkspaceSearch from "./WorkspaceSearch";
import { navigation } from "./Sidebar";

export function NotificationPanel({ state, onUpdate }) {
  const { run, busy } = useAction();
  const rows = responseList(state.data, "notifications").map(mapNotification);
  return state.loading ? (
    <LoadingSkeleton />
  ) : state.error ? (
    <ErrorState error={state.error} onRetry={state.refetch} />
  ) : !rows.length ? (
    <EmptyState title="Bạn đã xem hết thông báo" />
  ) : (
    <div className="notification-list">
      {rows.map((n) => (
        <div
          key={n.id}
          className={"notification-row " + (!n.isRead ? "unread" : "")}
        >
          <div>
            <strong>{n.title}</strong>
            <p>{n.content}</p>
            <small>{formatDateTime(n.createdAt)}</small>
          </div>
          <div className="actions">
            {!n.isRead && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await notificationApi.markRead(n.id);
                    await onUpdate();
                  }, "Đã đọc thông báo")
                }
              >
                Đã đọc
              </Button>
            )}
            <Button
              variant="ghost"
              aria-label="Xóa thông báo"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await notificationApi.remove(n.id);
                  await onUpdate();
                }, "Đã xóa thông báo")
              }
            >
              <Trash2 size={15} />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
export default function Topbar({ onMenuToggle, menuOpen = false }) {
  const location = useLocation();
  const currentPage = navigation.find(([path]) => path === location.pathname || (path !== "/" && location.pathname.startsWith(path + "/")))?.[1] || "Không gian học tập";
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);
  useEffect(() => setProfileOpen(false), [location.pathname]);
  useEffect(() => {
    if (!profileOpen) return;
    const dismiss = (event) => {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "pointerdown" && profileMenuRef.current?.contains(event.target)) return;
      setProfileOpen(false);
      if (event.type === "keydown") profileMenuRef.current?.querySelector("button")?.focus();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", dismiss); };
  }, [profileOpen]);
  const [preferences, setPreferences] = useState(readPreferences);
  useEffect(() => { const update = () => setPreferences(readPreferences()); window.addEventListener('preferences-updated', update); return () => window.removeEventListener('preferences-updated', update); }, []);
  const profile = useApi(studentApi.getProfile),
    notifications = useApi(notificationApi.list),
    count = useApi(notificationApi.unreadCount),
    sync = useApi(syncApi.iu.status);
  const [searchOpen, setSearchOpen] = useState(false),
    [notifOpen, setNotifOpen] = useState(false);
  const student = mapStudent(profile.data);
  useEffect(() => {
    const shortcut = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        if (menuOpen || (!searchOpen && document.querySelector('[role="dialog"]'))) return;
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [menuOpen, searchOpen]);
  useEffect(() => {
    const refresh = () => {
      notifications.execute();
      count.execute();
      sync.execute();
      profile.execute();
    };
    window.addEventListener("workspace-updated", refresh);
    const timer = setInterval(() => {
      notifications.execute();
      count.execute();
      sync.execute();
    }, 60000);
    return () => {
      window.removeEventListener("workspace-updated", refresh);
      clearInterval(timer);
    };
  }, [notifications.execute, count.execute, sync.execute, profile.execute]);
  const unread = Number(
    count.data?.count ??
      count.data?.unreadCount ??
      count.data?.unread_count ??
      (typeof count.data === "number" ? count.data : 0),
  );
  return (
    <>
      <header className="topbar">
        <div className="topbar-start">
          <button
            className="menu-button icon-button"
            aria-label="Mở menu"
            aria-expanded={menuOpen}
            aria-controls="main-sidebar"
            onClick={onMenuToggle}
          >
            <Menu size={21} />
          </button>
          <span className="topbar-title">
            <span className="workspace-symbol"><GraduationCap size={17} /></span>
            <span>Workspace</span><ChevronRight size={13} /><strong>{currentPage}</strong>
          </span>
        </div>
        <button className="topbar-search" data-region="A" aria-keyshortcuts="Control+k Meta+k" onClick={() => setSearchOpen(true)}>
          <Search size={17} />
          <span>Tìm môn học, tài liệu, công việc...</span>
          <kbd>Ctrl <span>K</span></kbd>
        </button>
        <div className="topbar-actions">
          <Link to="/ai" className="topbar-ai" title="Mở trợ lý AI"><Sparkles size={16} /><span>Hỏi AI</span></Link>
          <Link
            to="/sync"
            data-region="B"
            className={"sync-indicator " + (sync.error ? "sync-offline" : "")}
            title={
              sync.error
                ? "Không thể kiểm tra đồng bộ"
                : "Xem trạng thái đồng bộ"
            }
          >
            <RefreshCw size={15} className={sync.data?.syncing ? "spinning" : ""} />
            <span>
              {sync.error
                ? "Mất kết nối"
                : sync.loading ? "Đang kiểm tra..."
                : sync.data?.syncing
                  ? "Đang đồng bộ..."
                  : sync.data?.lastSync || sync.data?.last_synced_at || sync.data?.lastSyncAt ? "Đã đồng bộ" : "Chưa đồng bộ"}
            </span>
          </Link>
          <button
            className="icon-button notification-bell"
            data-region="C"
            aria-label={"Thông báo, " + unread + " chưa đọc"}
            onClick={() => setNotifOpen(true)}
          >
            <Bell size={20} />
            {preferences.notifications && unread > 0 && (
              <span className="notification-count">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
          <div className="profile-menu-wrap" ref={profileMenuRef} data-region="D">
          <button className="topbar-profile" aria-label="Tài khoản sinh viên" aria-expanded={profileOpen} aria-controls="profile-dropdown" onClick={() => setProfileOpen((value) => !value)}>
            <img
              src={student.avatar || foxAssets["fox-student-avatar.png"]}
              alt="Hồ sơ"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = foxAssets["fox-student-avatar.png"]; }}
            />
            <span>
              <strong>
                {student.fullName || "Sinh viên"}
              </strong>
              <small>{student.studentCode || "CMC University"}</small>
            </span>
            <ChevronDown size={13} />
          </button>
          {profileOpen && <div id="profile-dropdown" className="profile-dropdown" aria-label="Tài khoản">
            <Link to="/profile"><UserRound size={16} />Hồ sơ sinh viên</Link>
            <Link to="/settings"><Settings size={16} />Cài đặt</Link>
          </div>}
          </div>
        </div>
      </header>
      <Modal
        isOpen={notifOpen}
        onClose={() => setNotifOpen(false)}
        title="Thông báo"
      >
        <NotificationPanel
          state={notifications}
          onUpdate={async () => {
            await notifications.execute();
            await count.execute();
          }}
        />
      </Modal>
      <WorkspaceSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
