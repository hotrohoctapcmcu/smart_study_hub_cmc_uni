/**
 * UniStudy CMC - Tasks Service
 * Kết nối dữ liệu bài tập / deadline & checklist với Backend API
 */
import { ENDPOINTS } from "../../shared/config/endpoints.js";
import { apiRequest } from "../../shared/services/api-client.js";
import { state, notifyStateChange } from "../../app/state.js";

/**
 * Lấy danh sách môn học của sinh viên từ backend
 */
export async function getStudentSubjects() {
  const res = await apiRequest(ENDPOINTS.student.getSubjects);
  if (res.success) {
    const list = res.data?.data ?? res.data ?? [];
    return Array.isArray(list) ? list : [];
  }
  return [];
}

/**
 * Chuẩn hóa 1 bản ghi Assignment từ backend thành task object cho Frontend UI
 */
export function mapTaskFromBackend(row, allChecklists = []) {
  const rawId = row.assignment_id ?? row.id;
  const assignmentId = Number(rawId);

  const taskChecklist = allChecklists
    .filter((c) => Number(c.assignment_id) === assignmentId)
    .map((c) => ({
      id: `chk-${c.checklist_id}`,
      backendId: c.checklist_id,
      text: c.title,
      done: Boolean(c.is_completed)
    }));

  let uiStatus = "Chưa làm";
  if (row.status === "COMPLETED") uiStatus = "Hoàn thành";
  else if (row.status === "IN_PROGRESS") uiStatus = "Đang làm";

  const rawDeadline = row.deadline || "";
  const due = rawDeadline ? String(rawDeadline).replace(" ", "T").slice(0, 16) : "";

  return {
    id: `task-${assignmentId}`,
    assignmentId,
    title: row.title || "Công việc học tập",
    subject: row.subject_name || row.subject_code || "Chưa phân loại",
    subjectId: row.subject_id,
    due,
    priority: "Trung bình",
    status: uiStatus,
    checklist: taskChecklist,
    note: row.description || "",
    description: row.description || "",
    completedAt: row.completed_at || null,
    isLocalDraft: false
  };
}

/**
 * Tải danh sách bài tập & checklist từ backend và nạp vào state.tasks
 */
export async function fetchTasksFromApi() {
  const [tasksRes, checklistRes] = await Promise.all([
    apiRequest(ENDPOINTS.tasks.list),
    apiRequest(ENDPOINTS.tasks.getAllChecklist)
  ]);

  if (!tasksRes.success) {
    if (tasksRes.unavailable) return state.tasks;
    throw new Error(tasksRes.error || "Không thể tải danh sách công việc từ máy chủ.");
  }

  const rawTasks = tasksRes.data?.data ?? tasksRes.data ?? [];
  const rawChecklists = checklistRes.success ? (checklistRes.data?.data ?? checklistRes.data ?? []) : [];

  if (!Array.isArray(rawTasks)) return state.tasks;

  const mapped = rawTasks.map((t) => mapTaskFromBackend(t, rawChecklists));
  state.tasks = mapped;
  notifyStateChange();
  return mapped;
}

/**
 * Tạo công việc mới trên Backend API và đồng bộ checklist con
 */
export async function createTaskApi(taskData) {
  // Tìm subjectId hợp lệ từ danh sách môn học
  let subjectId = taskData.subjectId;
  if (!subjectId) {
    try {
      const subjects = await getStudentSubjects();
      if (subjects.length > 0) {
        const query = (taskData.subject || "").toLowerCase();
        const found = subjects.find(
          (s) =>
            (s.subject_name && s.subject_name.toLowerCase().includes(query)) ||
            (s.subject_code && s.subject_code.toLowerCase().includes(query))
        );
        subjectId = found ? found.subject_id : subjects[0].subject_id;
      }
    } catch {
      subjectId = 1;
    }
  }

  const backendBody = {
    subjectId: Number(subjectId) || 1,
    title: taskData.title,
    deadline: taskData.due,
    description: taskData.note || taskData.description || ""
  };

  const res = await apiRequest(ENDPOINTS.tasks.create, { body: backendBody });
  if (!res.success) {
    throw new Error(res.error || "Lỗi khi tạo công việc trên máy chủ.");
  }

  const newId = res.data?.data?.assignment_id ?? res.data?.assignment_id;

  // Nếu có checklist con, lưu từng mục lên server
  if (newId && Array.isArray(taskData.checklist) && taskData.checklist.length > 0) {
    for (const item of taskData.checklist) {
      if (item.text && item.text.trim()) {
        try {
          await apiRequest(ENDPOINTS.tasks.addChecklistItem, {
            params: { taskId: newId },
            body: { title: item.text.trim() }
          });
        } catch (e) {
          console.warn("[Tasks] Lỗi thêm checklist item:", e);
        }
      }
    }
  }

  // Tải lại toàn bộ danh sách để có dữ liệu chính xác nhất
  await fetchTasksFromApi();
  return res.data;
}

/**
 * Cập nhật công việc trên Backend API
 */
export async function updateTaskApi(taskId, updates) {
  const numericId = String(taskId).replace(/^task-/, "");

  const updateBody = {};
  if (updates.title !== undefined) updateBody.title = updates.title;
  if (updates.due !== undefined) updateBody.deadline = updates.due;
  if (updates.note !== undefined || updates.description !== undefined) {
    updateBody.description = updates.note || updates.description || "";
  }

  if (Object.keys(updateBody).length > 0) {
    await apiRequest(ENDPOINTS.tasks.update, {
      params: { id: numericId },
      body: updateBody
    });
  }

  if (updates.status !== undefined) {
    const backendStatus =
      updates.status === "Hoàn thành"
        ? "COMPLETED"
        : updates.status === "Đang làm"
        ? "IN_PROGRESS"
        : "PENDING";

    await apiRequest(ENDPOINTS.tasks.updateStatus, {
      params: { id: numericId },
      body: { status: backendStatus }
    });
  }

  await fetchTasksFromApi();
}

/**
 * Xóa công việc trên Backend API
 */
export async function deleteTaskApi(taskId) {
  const numericId = String(taskId).replace(/^task-/, "");
  const res = await apiRequest(ENDPOINTS.tasks.delete, {
    params: { id: numericId }
  });
  if (!res.success) {
    throw new Error(res.error || "Lỗi xóa công việc trên máy chủ.");
  }
  await fetchTasksFromApi();
  return true;
}

/**
 * Đổi trạng thái checklist item trên server
 */
export async function toggleChecklistItemApi(checklistId, isDone) {
  const numericId = String(checklistId).replace(/^chk-/, "");
  return await apiRequest(ENDPOINTS.tasks.toggleChecklistItem, {
    params: { itemId: numericId },
    body: { isCompleted: isDone }
  });
}
