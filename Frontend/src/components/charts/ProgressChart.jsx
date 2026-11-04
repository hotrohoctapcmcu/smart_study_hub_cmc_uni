import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { EmptyState } from "../common/ui";
export const chartColors = [
  "var(--primary-ink)",
  "var(--success)",
  "var(--info)",
  "var(--warning)",
  "var(--danger)",
];
export default function ProgressChart({ data = [], kind = "daily", showTasks = false }) {
  if (!data.length)
    return (
      <EmptyState
        title="Chưa có dữ liệu thống kê"
        description="Hoạt động học tập sẽ xuất hiện tại đây."
      />
    );
  return (
    <div
      role="img"
      aria-label={
        kind === "pie" ? "Biểu đồ phân bổ thời gian" : "Biểu đồ tiến độ học tập"
      }
    >
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          {kind === "pie" ? (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={83}
                paddingAngle={4}
              >
                {data.map((r, i) => (
                  <Cell key={i} fill={chartColors[i % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 10 }} />
            </PieChart>
          ) : (
            <BarChart
              data={data}
              layout={kind === "subject" ? "vertical" : "horizontal"}
              margin={{
                top: 10,
                right: 8,
                bottom: 0,
                left: kind === "subject" ? 30 : -20,
              }}
            >
              <CartesianGrid
                stroke="var(--border)"
                vertical={false}
                strokeDasharray="3 3"
              />
              <XAxis
                type={kind === "subject" ? "number" : "category"}
                dataKey={kind === "subject" ? undefined : "name"}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
              />
              <YAxis
                yAxisId="hours"
                type={kind === "subject" ? "category" : "number"}
                dataKey={kind === "subject" ? "name" : undefined}
                width={kind === "subject" ? 75 : 40}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
              />
              {showTasks && <YAxis yAxisId="tasks" orientation="right" allowDecimals={false} axisLine={false} tickLine={false} width={28} tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />}
              <Tooltip
                cursor={{ fill: "var(--primary-soft)" }}
                contentStyle={{ borderRadius: 12, fontSize: 11, padding: "10px 14px", boxShadow: "0 8px 24px #44326418", background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}
              />
              <Bar
                yAxisId="hours"
                dataKey="value"
                name={kind === "subject" ? "Tiến độ (%)" : "Giờ học"}
                fill="var(--primary)"
                radius={kind === "subject" ? [0, 6, 6, 0] : [7, 7, 0, 0]}
                barSize={kind === "subject" ? 12 : 26}
              >
                {data.map((r, i) => (
                  <Cell key={i} fill={chartColors[i % chartColors.length]} />
                ))}
              </Bar>
              {showTasks && <Bar yAxisId="tasks" dataKey="completed" name="Công việc hoàn thành" fill="var(--success)" radius={[5, 5, 0, 0]} barSize={12} />}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {kind === "pie" && (
        <div className="legend">
          {data.map((r, i) => (
            <span key={i}>
              <i style={{ background: chartColors[i % chartColors.length] }} />
              {r.name}: {r.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
