import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  ListTodo,
  Bot,
  BookOpen,
} from "lucide-react";
export default function MobileNavigation({ disabled = false }) {
  return (
    <nav className="mobile-navigation" aria-label="Điều hướng di động" inert={disabled ? "" : undefined}>
      {[
        ["/", "Tổng quan", LayoutDashboard],
        ["/schedule", "Lịch học", CalendarDays],
        ["/tasks", "Công việc", ListTodo],
        ["/textbook", "Vở ghi", BookOpen],
        ["/ai", "AI Tutor", Bot],
      ].map(([path, name, Icon]) => (
        <NavLink end={path === "/"} to={path} key={path}>
          <Icon size={19} />
          <span>{name}</span>
        </NavLink>
      ))}
    </nav>
  );
}
