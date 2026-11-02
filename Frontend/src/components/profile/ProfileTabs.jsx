import {
  BarChart3,
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  Layers3,
  Settings,
  Trophy,
} from "lucide-react";

const tabs = [
  ["info", "Thông tin cá nhân", LayoutDashboard],
  ["grades", "Bảng điểm", BarChart3],
  ["subjects", "Môn học", BookOpen],
  ["schedule", "Lịch học", CalendarDays],
  ["semesters", "Kỳ học", Layers3],
  ["achievements", "Thành tích", Trophy],
  ["settings", "Cài đặt", Settings],
];

export default function ProfileTabs({ value, onChange }) {
  return (
    <div className="profile-tabs-wrap">
      <div className="profile-tabs" role="tablist" aria-label="Điều hướng hồ sơ">
        {tabs.map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`profile-tab-${key}`}
            aria-controls={`profile-panel-${key}`}
            tabIndex={value === key ? 0 : -1}
            aria-selected={value === key}
            className={value === key ? "active" : ""}
            onClick={() => onChange(key)}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const index = tabs.findIndex(([tab]) => tab === key);
              const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
              onChange(tabs[next][0]);
              document.getElementById(`profile-tab-${tabs[next][0]}`)?.focus();
            }}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
