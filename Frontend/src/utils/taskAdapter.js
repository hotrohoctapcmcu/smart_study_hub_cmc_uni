export function mapStatusLabel(status) {
  const map = {
    PENDING: "Chưa làm",
    IN_PROGRESS: "Đang làm",
    COMPLETED: "Hoàn thành",
    OVERDUE: "Quá hạn",
  };
  return map[status] || status || "—";
}

export function mapPriorityLabel(priority) {
  const map = {
    LOW: "Thấp",
    MEDIUM: "Trung bình",
    HIGH: "Cao",
    URGENT: "Khẩn cấp",
  };
  return map[priority] || priority || "—";
}

export function mapStatusColor(status) {
  const map = {
    PENDING: "var(--text-light)",
    IN_PROGRESS: "var(--info)",
    COMPLETED: "var(--success)",
    OVERDUE: "var(--danger)",
  };
  return map[status] || "var(--text-light)";
}

export function mapPriorityColor(priority) {
  const map = {
    LOW: "var(--text-light)",
    MEDIUM: "var(--info)",
    HIGH: "var(--warning)",
    URGENT: "var(--danger)",
  };
  return map[priority] || "var(--text-light)";
}

export function mapTask(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.assignment_id ?? row.id,
    title: row.title || "",
    subject: row.subject_name || row.subject_code || "Chưa phân loại",
    subjectCode: row.subject_code || "",
    subjectId: row.subject_id,
    description: row.description || "",
    deadline: row.deadline,
    priority: row.priority,
    status: row.status,
    completedAt: row.completed_at,
    statusLabel: mapStatusLabel(row.status),
    priorityLabel: mapPriorityLabel(row.priority),
    statusColor: mapStatusColor(row.status),
    priorityColor: mapPriorityColor(row.priority),
  };
}

export function mapTasks(rows = []) {
  return rows.map(mapTask).filter(Boolean);
}
