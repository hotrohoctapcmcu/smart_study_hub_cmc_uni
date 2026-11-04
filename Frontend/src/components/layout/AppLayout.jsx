import { useState, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar, { navigation } from "./Sidebar";
import Topbar from "./Topbar";
import MobileNavigation from "./MobileNavigation";
import { AppProvider } from "../common/ui";
import { applyPreferences, readPreferences } from "../../utils/preferences";

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(() => window.matchMedia("(max-width: 1199px)").matches);
  const sidebarRef = useRef(null);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
    document.querySelector(".main-content")?.scrollTo(0, 0);
  }, [location.pathname, location.search]);
  useEffect(() => applyPreferences(readPreferences()), []);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1199px)");
    const update = () => { setCompact(media.matches); if (!media.matches) setOpen(false); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const title = navigation.find(([path]) => path === location.pathname || (path !== "/" && location.pathname.startsWith(path + "/")))?.[1]
      || (location.pathname === "/profile" ? "Hồ sơ sinh viên" : "Không tìm thấy trang");
    document.title = title + " · Smart Study Hub";
  }, [location.pathname]);
  useEffect(() => {
    if (!open || !compact) return;
    const previous = document.activeElement;
    const sidebar = sidebarRef.current;
    sidebar.querySelector(".drawer-close")?.focus();
    const trap = (e) => {
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
      if (e.key !== "Tab") return;
      const items = [...sidebar.querySelectorAll("a[href], button:not(:disabled)")];
      const first = items[0], last = items.at(-1);
      if (!sidebar.contains(document.activeElement) || (!e.shiftKey && document.activeElement === last)) {
        e.preventDefault(); first?.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); previous?.focus(); };
  }, [open, compact]);
  return (
    <AppProvider>
      <div className="app-layout">
        <a className="skip-link" href="#main-content">
          Đến nội dung chính
        </a>
        <Sidebar isOpen={open} compact={compact} sidebarRef={sidebarRef} onClose={() => setOpen(false)} />
        {open && (
          <button
            className="sidebar-backdrop"
            aria-label="Đóng menu"
            onClick={() => setOpen(false)}
          />
        )}
        <div className="app-workspace" inert={open && compact ? "" : undefined}>
          <Topbar menuOpen={open} onMenuToggle={() => setOpen((v) => !v)} />
          <main className={"main-content" + (location.pathname === "/tasks" ? " main-content--tasks" : "")} id="main-content" tabIndex={-1}>
            <div key={location.pathname} className="route-view"><Outlet /></div>
          </main>
        </div>
        <MobileNavigation disabled={open && compact} />
      </div>
    </AppProvider>
  );
}
