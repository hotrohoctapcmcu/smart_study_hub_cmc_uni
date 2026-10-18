/**
 * UniStudy CMC - Tasks Service
 * Interface dịch vụ theo API_FUNCTION_MAP.md & API_CONTRACT.md.
 */
import { ENDPOINTS } from "../../shared/config/endpoints.js";
import { apiRequest } from "../../shared/services/api-client.js";

export async function getTasks() {
  return await apiRequest(ENDPOINTS.tasks.list);
}

export async function createTask(taskData) {
  return await apiRequest(ENDPOINTS.tasks.create, { body: taskData });
}

export async function updateTask(id, taskData) {
  return await apiRequest(ENDPOINTS.tasks.update, {
    params: { id },
    body: taskData
  });
}

export async function deleteTask(id) {
  return await apiRequest(ENDPOINTS.tasks.delete, {
    params: { id }
  });
}

export async function updateTaskStatus(id, status) {
  return await apiRequest(ENDPOINTS.tasks.updateStatus, {
    params: { id },
    body: { status }
  });
}

export async function getChecklist(taskId) {
  return await apiRequest(ENDPOINTS.tasks.getChecklist, {
    params: { taskId }
  });
}

export async function addChecklistItem(taskId, itemData) {
  return await apiRequest(ENDPOINTS.tasks.addChecklistItem, {
    params: { taskId },
    body: itemData
  });
}

export async function updateChecklistItem(itemId, updates) {
  return await apiRequest(ENDPOINTS.tasks.updateChecklistItem, {
    params: { itemId },
    body: updates
  });
}

export async function deleteChecklistItem(itemId) {
  return await apiRequest(ENDPOINTS.tasks.deleteChecklistItem, {
    params: { itemId }
  });
}
