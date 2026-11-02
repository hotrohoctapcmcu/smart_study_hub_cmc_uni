export function mapNotification(row) {
  return {
    ...row,
    id: row.notification_id ?? row.reminder_id ?? row.id,
    title: row.title || "Thông báo",
    content: row.content || row.message || "",
    isRead: !!Number(row.is_sent ?? row.is_read ?? row.read ?? 0),
    createdAt: row.remind_time || row.created_at || row.createdAt,
    link: row.link || null,
  };
}
