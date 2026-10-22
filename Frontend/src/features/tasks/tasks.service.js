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

  // DB lưu enum LOW/MEDIUM/HIGH/URGENT, UI dùng nhãn tiếng Việt.
  const NHAN_UU_TIEN = { LOW: "Thấp", MEDIUM: "Trung bình", HIGH: "Cao", URGENT: "Khẩn cấp" };
  const uiPriority = NHAN_UU_TIEN[row.priority] || "Trung bình";

  const rawDeadline = row.deadline || "";
  const due = rawDeadline ? String(rawDeadline).replace(" ", "T").slice(0, 16) : "";

  return {
    id: `task-${assignmentId}`,
    assignmentId,
    title: row.title || "Công việc học tập",
    subject: row.subject_name || row.subject_code || "Chưa phân loại",
    subjectId: row.subject_id,
    due,
    priority: uiPriority,
    status: uiStatus,
    checklist: taskChecklist,
    note: row.description || "",
    description: row.description || "",
    completedAt: row.completed_at || null,
    isLocalDraft: false
  };
}

/**
 * Chuẩn hoá 1 bài tập EDUX (đọc từ DB) thành task object cho UI.
 * Giữ nguyên các trường đặc thù EDUX để view hiển thị tiến độ/điểm/chương.
 */
export function mapEduxTaskFromBackend(item, idx = 0) {
  return {
    id: item?.id || `edux-${idx}`,
    title: item?.title || "Bài tập EDUX",
    subject: item?.subject || "Học phần EDUX",
    due: null, // EDUX không công bố hạn nộp
    priority: item?.priority || "Trung bình",
    status: item?.status || "Chưa làm",
    checklist: [],
    note: item?.description || "",
    description: item?.description || "",
    completedAt: null,
    source: "EDUX",
    externalId: item?.id || null,
    subjectId: item?.subjectId || null,
    modelId: item?.modelId || null,
    chapter: item?.chapter || null,
    highestScore: item?.highestScore ?? null,
    progress: item?.progress || null,
    isLocalDraft: false
  };
}

/**
 * Tải danh sách bài tập & checklist từ backend và nạp vào state.tasks
 */
export async function fetchTasksFromApi() {
  const [tasksRes, checklistRes, eduxRes] = await Promise.all([
    apiRequest(ENDPOINTS.tasks.list),
    apiRequest(ENDPOINTS.tasks.getAllChecklist),
    // Bài tập EDUX đã lưu trong DB. 401 = chưa từng đồng bộ EDUX (bình thường),
    // không phải lỗi nên chỉ bỏ qua.
    apiRequest(ENDPOINTS.tasks.eduxList, { silent: true }).catch(() => ({ success: false }))
  ]);

  if (!tasksRes.success) {
    if (tasksRes.unavailable) return state.tasks;
    throw new Error(tasksRes.error || "Không thể tải danh sách công việc từ máy chủ.");
  }

  const rawTasks = tasksRes.data?.data ?? tasksRes.data ?? [];
  const rawChecklists = checklistRes.success ? (checklistRes.data?.data ?? checklistRes.data ?? []) : [];

  if (!Array.isArray(rawTasks)) return state.tasks;

  const mapped = rawTasks.map((t) => mapTaskFromBackend(t, rawChecklists));

  // Bài tập EDUX đọc thẳng từ DB — trước đây chỉ nằm trong state sau khi bấm
  // "Đồng bộ EduX", nên mở lại app là mất sạch dù DB vẫn còn dữ liệu.
  const eduxRows = eduxRes.success
    ? (eduxRes.data?.assignments ?? eduxRes.data?.data?.assignments ?? [])
    : [];
  const eduxTasks = Array.isArray(eduxRows)
    ? eduxRows.map((item, idx) => mapEduxTaskFromBackend(item, idx))
    : [];

  // Giữ lại task nháp người dùng vừa tạo khi server chưa kịp trả về.
  const giuLai = (state.tasks || []).filter(
    (t) => t.isLocalDraft && !eduxTasks.some((e) => e.id === t.id)
  );

  state.tasks = [...mapped, ...eduxTasks, ...giuLai];
  notifyStateChange();
  return state.tasks;
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
    description: taskData.note || taskData.description || "",
    ...(taskData.priority ? { priority: taskData.priority } : {})
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
  if (updates.priority !== undefined) updateBody.priority = updates.priority;

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
