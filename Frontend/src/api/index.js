import apiClient, { backendOrigin, unwrapResponse } from "./apiClient";
import { ENDPOINTS } from "./endpoints";
import { formatDateISO, startOfWeek, addDays } from "../utils/date";

export const workspaceApi = Object.fromEntries(
  ["notes", "notebooks"].map((kind) => [
    kind,
    {
      list: () => apiClient.get(ENDPOINTS[kind].list),
      create: (data) => apiClient.post(ENDPOINTS[kind].list, data),
      update: (id, data) =>
        apiClient.put(`${ENDPOINTS[kind].detail}/${id}`, data),
      remove: (id) => apiClient.delete(`${ENDPOINTS[kind].detail}/${id}`),
      export: (id) =>
        apiClient.get(`${ENDPOINTS[kind].export}/${id}/export`, {
          responseType: "blob",
        }),
    },
  ]),
);

export const dashboardApi = {
  getDashboard() {
    return apiClient.get(ENDPOINTS.dashboard);
  },
};

export const scheduleApi = {
  study(params) {
    return apiClient.get(ENDPOINTS.schedules.study, { params });
  },
  createClass(data) {
    return apiClient.post(ENDPOINTS.schedules.list, data);
  },
  removeClass(id) {
    return apiClient.delete(`${ENDPOINTS.schedules.list}/${id}`);
  },
  list() {
    return apiClient.get(ENDPOINTS.schedules.list);
  },
  today() {
    return apiClient.get(ENDPOINTS.schedules.today);
  },
  byDate(date) {
    return apiClient.get(ENDPOINTS.schedules.byDate, { params: { date } });
  },
  byWeek(from, to) {
    return apiClient.get(ENDPOINTS.schedules.byWeek, { params: { from, to } });
  },
  create(data) {
    return apiClient.post(ENDPOINTS.schedules.study, data);
  },
  update(id, data) {
    return apiClient.put(`${ENDPOINTS.schedules.study}/${id}`, data);
  },
  changeStatus(id, status) {
    return apiClient.patch(`${ENDPOINTS.schedules.study}/${id}/status`, {
      status,
    });
  },
  remove(id) {
    return apiClient.delete(`${ENDPOINTS.schedules.study}/${id}`);
  },
  checkConflicts(data) {
    return apiClient.post(ENDPOINTS.schedules.conflicts, data);
  },
  getFreeSlots(date, duration) {
    return apiClient.get(`${ENDPOINTS.schedules.study}/free-slots`, {
      params: { date, duration },
    });
  },
};

export const taskApi = {
  eduxDetail(id) {
    return apiClient.get(`${ENDPOINTS.tasks.edux}/${id}`);
  },
  eduxStatus(id, status) {
    return apiClient.patch(`${ENDPOINTS.tasks.edux}/${id}/status`, { status });
  },
  list(params) {
    return apiClient.get(ENDPOINTS.tasks.list, { params });
  },
  upcoming(days = 3) {
    return apiClient.get(ENDPOINTS.tasks.upcoming, { params: { days } });
  },
  edux(params) {
    return apiClient.get(ENDPOINTS.tasks.edux, { params });
  },
  detail(id) {
    return apiClient.get(`${ENDPOINTS.tasks.list}/${id}`);
  },
  create(data) {
    return apiClient.post(ENDPOINTS.tasks.list, data);
  },
  update(id, data) {
    return apiClient.put(`${ENDPOINTS.tasks.list}/${id}`, data);
  },
  changeStatus(id, status) {
    return apiClient.patch(`${ENDPOINTS.tasks.list}/${id}/status`, { status });
  },
  remove(id) {
    return apiClient.delete(`${ENDPOINTS.tasks.list}/${id}`);
  },
  checklist(taskId) {
    return apiClient.get(`${ENDPOINTS.tasks.checklist}`);
  },
  taskChecklist(taskId) {
    return apiClient.get(`${ENDPOINTS.tasks.list}/${taskId}/checklist`);
  },
  createChecklist(taskId, data) {
    return apiClient.post(`${ENDPOINTS.tasks.list}/${taskId}/checklist`, data);
  },
  updateChecklist(id, data) {
    return apiClient.put(`${ENDPOINTS.tasks.checklist}/${id}`, data);
  },
  toggleChecklist(id, done) {
    return apiClient.patch(`${ENDPOINTS.tasks.checklist}/${id}/done`, {
      isCompleted: done,
    });
  },
  removeChecklist(id) {
    return apiClient.delete(`${ENDPOINTS.tasks.checklist}/${id}`);
  },
};

export const studentApi = {
  getProfile() {
    return apiClient.get(ENDPOINTS.student.profile);
  },
  updateProfile(data) {
    return apiClient.put(ENDPOINTS.student.profile, data);
  },
  getGrades(params) {
    return apiClient.get(ENDPOINTS.student.grades, { params });
  },
  getSubjects() {
    return apiClient.get(ENDPOINTS.student.subjects);
  },
};

export const courseApi = {
  list() {
    return apiClient.get(ENDPOINTS.courses.list);
  },
  detail(id) {
    return apiClient.get(`${ENDPOINTS.courses.detail}/${id}`);
  },
  source(id) {
    return apiClient.get(`${ENDPOINTS.courses.source}/${id}/source`);
  },
  summary(id) {
    return apiClient.get(`${ENDPOINTS.courses.summary}/${id}/summary`);
  },
  sync() {
    return apiClient.post(ENDPOINTS.courses.sync);
  },
  summarize(id) {
    return apiClient.post(`${ENDPOINTS.courses.summarize}/${id}/summarize`);
  },
  review(cardId, data) {
    return apiClient.post(`${ENDPOINTS.courses.review}/${cardId}/review`, data);
  },
  getJob(id) {
    return apiClient.get(`${ENDPOINTS.courses.jobs}/${id}`);
  },
};

export const documentApi = {
  list() {
    return apiClient.get(ENDPOINTS.documents.list);
  },
  detail(id) {
    return apiClient.get(`${ENDPOINTS.documents.detail}/${id}`);
  },
  upload(file, meta) {
    const headers = { "Content-Type": "application/octet-stream" };
    if (meta)
      headers["X-Document-Meta"] = encodeURIComponent(JSON.stringify(meta));
    return apiClient.post(ENDPOINTS.documents.list, file, { headers });
  },
  updateTags(id, tags) {
    return apiClient.patch(`${ENDPOINTS.documents.tags}/${id}/tags`, { tags });
  },
  remove(id) {
    return apiClient.delete(`${ENDPOINTS.documents.detail}/${id}`);
  },
  download(id, force = false) {
    return apiClient.get(`${ENDPOINTS.documents.file}/${id}/file`, {
      params: force ? { download: 1 } : {},
      responseType: "blob",
    });
  },
};

export const notificationApi = {
  list() {
    return apiClient.get(ENDPOINTS.notifications.list);
  },
  unreadCount() {
    return apiClient.get(ENDPOINTS.notifications.unreadCount);
  },
  due() {
    return apiClient.get(ENDPOINTS.notifications.due);
  },
  create(data) {
    return apiClient.post(ENDPOINTS.notifications.list, data);
  },
  markRead(id) {
    return apiClient.patch(`${ENDPOINTS.notifications.detail}/${id}/read`);
  },
  remove(id) {
    return apiClient.delete(`${ENDPOINTS.notifications.detail}/${id}`);
  },
};

export const examApi = {
  list() {
    return apiClient.get(ENDPOINTS.exams.list);
  },
  upcoming() {
    return apiClient.get(ENDPOINTS.exams.upcoming);
  },
  detail(id) {
    return apiClient.get(`${ENDPOINTS.exams.detail}/${id}`);
  },
  create(data) {
    return apiClient.post(ENDPOINTS.exams.list, data);
  },
  update(id, data) {
    return apiClient.put(`${ENDPOINTS.exams.detail}/${id}`, data);
  },
  remove(id) {
    return apiClient.delete(`${ENDPOINTS.exams.detail}/${id}`);
  },
  getStudyPlans() {
    return apiClient.get(ENDPOINTS.exams.studyPlans);
  },
  createStudyPlan(data) {
    return apiClient.post(ENDPOINTS.exams.studyPlans, data);
  },
  getExamStudyPlans(examId) {
    return apiClient.get(`${ENDPOINTS.exams.detail}/${examId}/study-plans`);
  },
  changeStudyPlanStatus(id, status) {
    return apiClient.patch(`${ENDPOINTS.exams.studyPlans}/${id}/status`, {
      status,
    });
  },
  removeStudyPlan(id) {
    return apiClient.delete(`${ENDPOINTS.exams.studyPlans}/${id}`);
  },
};

export const progressApi = {
  getProgress() {
    return apiClient.get(ENDPOINTS.progress, { params: { advice: false } });
  },
};

export const timemapApi = {
  getTimemap() {
    return apiClient.get(ENDPOINTS.timemap, {
      params: {
        from: formatDateISO(startOfWeek()),
        to: formatDateISO(addDays(startOfWeek(), 6)),
      },
    });
  },
};

export const pomodoroApi = {
  list() {
    return apiClient.get(ENDPOINTS.pomodoro);
  },
  create(data) {
    return apiClient.post(ENDPOINTS.pomodoro, data);
  },
  remove(id) {
    return apiClient.delete(ENDPOINTS.pomodoro);
  },
};

export const emailApi = {
  list() {
    return apiClient.get(ENDPOINTS.email.list);
  },
  status() {
    return apiClient.get(ENDPOINTS.email.status);
  },
  async sync() {
    const bridge = window.__uniStudyOutlook;
    if (bridge?.connect) {
      const status = unwrapResponse(await emailApi.status());
      if (!status?.connected) await bridge.connect();
    }
    return apiClient.post(ENDPOINTS.email.sync);
  },
  deleteSession() {
    return apiClient.delete(ENDPOINTS.email.session);
  },
  readAll() {
    return apiClient.patch(ENDPOINTS.email.read);
  },
  readOne(id) {
    return apiClient.patch(`${ENDPOINTS.email.detail}/${id}/read`);
  },
  refresh(id) {
    return apiClient.post(`${ENDPOINTS.email.refresh}/${id}/refresh`);
  },
  toTask(id) {
    return apiClient.post(`${ENDPOINTS.email.task}/${id}/task`);
  },
  toExam(id) {
    return apiClient.post(`${ENDPOINTS.email.exam}/${id}/exam`);
  },
};

let allSyncInFlight = null;
const portalKeys = ["iu", "edux", "outlook"];
const connectionBudget = (value, fallback, maximum = fallback) => {
  const milliseconds = Number(value);
  return Number.isFinite(milliseconds) && milliseconds > 0 ? Math.min(milliseconds, maximum) : fallback;
};
const connectedStatus = (value) => {
  const status = unwrapResponse(value);
  return Boolean(status?.connected ?? status?.hasSession ?? status?.has_session);
};
const portalFailure = (error) => ({
  ok: false,
  connected: false,
  status: "FAILED",
  message: error.response?.data?.message || error.message || "Không kết nối được nguồn dữ liệu.",
});
const terminalSyncStates = ["COMPLETED", "PARTIAL", "FAILED"];
const validSyncStates = ["PENDING", "RUNNING", ...terminalSyncStates];
function combinePortalJob(snapshot, connections) {
  const results = { ...connections, ...snapshot.results };
  const done = portalKeys.filter(key => terminalSyncStates.includes(results[key]?.status) || terminalSyncStates.includes(snapshot.status) && results[key]?.ok || results[key]?.partial || results[key]?.connected === false).length;
  const combined = { ...snapshot, results, progress: { completed: done, total: 3, percent: Math.round(done / 3 * 100) } };
  if (terminalSyncStates.includes(snapshot.status)) {
    combined.backendStatus = snapshot.status;
    combined.ok = portalKeys.every(key => results[key]?.ok);
    combined.status = combined.ok ? "COMPLETED" : portalKeys.some(key => results[key]?.ok || results[key]?.synced) ? "PARTIAL" : "FAILED";
    combined.message = combined.ok ? "Đã đồng bộ IU, EDUX và Outlook."
      : combined.status === "PARTIAL" ? "Đã hoàn tất; một số nguồn chưa đồng bộ đầy đủ. Xem kết quả từng nguồn."
        : "Chưa đồng bộ được nguồn nào. Kiểm tra kết nối và đăng nhập lại.";
  }
  return combined;
}

async function watchSyncJob(initial, options = {}) {
  let job = typeof initial === "string" ? unwrapResponse(await syncApi.status(initial)) : initial;
  const deadline = Date.now() + (Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 600000);
  const interval = Number.isFinite(options.pollIntervalMs) ? Math.max(0, options.pollIntervalMs) : 500;
  try {
    if (!job?.jobId || !validSyncStates.includes(job.status)) throw new Error("Máy chủ chưa trả tiến trình đồng bộ hợp lệ.");
    options.onProgress?.(job);
    while (!terminalSyncStates.includes(job.status)) {
      if (options.signal?.aborted) throw Object.assign(new Error("Đã dừng theo dõi đồng bộ."), { name: "AbortError" });
      if (Date.now() >= deadline) throw new Error("Đã hết thời gian theo dõi. Dữ liệu vẫn có thể đang được đồng bộ; hãy kiểm tra lại tiến trình.");
      await new Promise((resolve) => setTimeout(resolve, Math.min(interval, Math.max(0, deadline - Date.now()))));
      if (options.signal?.aborted) throw Object.assign(new Error("Đã dừng theo dõi đồng bộ."), { name: "AbortError" });
      const next = unwrapResponse(await syncApi.status(job.jobId));
      if (next?.jobId !== job.jobId || !validSyncStates.includes(next.status)) throw new Error("Không nhận được tiến trình đồng bộ hợp lệ.");
      job = next;
      options.onProgress?.(job);
    }
    return job;
  } catch (error) { error.lastJob = job; throw error; }
}

export const syncApi = {
  watch: watchSyncJob,
  async connectAll(options = {}) {
    const auth = Object.fromEntries(portalKeys.filter((key) => options[key]).map((key) => {
      const settings = { ...options[key] };
      if (Object.prototype.hasOwnProperty.call(settings, "timeoutMs")) settings.timeoutMs = connectionBudget(settings.timeoutMs, key === "edux" ? 45000 : 180000);
      return [key, settings];
    }));
    const results = Object.fromEntries(portalKeys.map(key => [key, { status: "CHECKING", message: "Đang kiểm tra phiên đăng nhập." }]));
    let active = true;
    const publish = (snapshot) => {
      if (!active) return;
      for (const key of portalKeys) if (snapshot?.results?.[key]) results[key] = { ...snapshot.results[key] };
      options.onConnectionProgress?.({ status: "CONNECTING", results: { ...results } });
    };
    const timeout = (operation, milliseconds, message) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), milliseconds);
      Promise.resolve().then(operation).then(resolve, reject).finally(() => clearTimeout(timer));
    });
    const bridge = window.__uniStudySync;
    let unsubscribe;
    try {
      publish();
      if (bridge?.connectAll) {
        const subscribe = bridge.onConnectionProgress || bridge.onProgress;
        if (subscribe) unsubscribe = subscribe(publish);
        try {
          return await timeout(() => bridge.connectAll(auth), connectionBudget(options.connectionTimeoutMs, 195000),
            "Kết nối quá thời gian chờ. Hoàn tất đăng nhập Microsoft hoặc thử lại.");
        } catch (error) {
          for (const key of portalKeys) if (!results[key]?.connected && !results[key]?.ok) results[key] = portalFailure(error);
          publish();
          return { ok: false, results };
        }
      }
      await Promise.all(portalKeys.map(async key => {
        try {
          const status = await timeout(() => key === "outlook" ? emailApi.status() : syncApi[key].status(), 8000,
            key.toUpperCase() + ": máy chủ không phản hồi kiểm tra phiên trong 8 giây.");
          if (!connectedStatus(status)) {
            results[key] = { status: "CONNECTING", message: key === "edux" ? "Đang đăng nhập EDUX." : "Hoàn tất đăng nhập Microsoft trong cửa sổ đăng nhập." };
            publish();
            await timeout(async () => {
              if (key === "iu") {
                if (options.iu?.session && options.iu?.cookie) await syncApi.iu.createSession(options.iu);
                else if (!await syncApi.iu.connect()) throw new Error("IU: mở ứng dụng Electron để đăng nhập Microsoft hoặc cung cấp dữ liệu phiên IU.");
              } else if (key === "edux") {
                if (!options.edux?.email || !options.edux?.password) throw new Error("EDUX: cần email và mật khẩu để đăng nhập.");
                await syncApi.edux.createSession(options.edux);
              } else if (window.__uniStudyOutlook?.connect) {
                const result = await window.__uniStudyOutlook.connect();
                if (result?.connected === false) throw new Error(result.message || "Chưa kết nối được Outlook.");
              } else throw new Error("Outlook: mở ứng dụng Electron để đăng nhập Microsoft hoặc cấu hình phiên Outlook trên máy chủ.");
            }, key === "edux" ? 45000 : 180000, key.toUpperCase() + ": đăng nhập quá thời gian chờ. Vui lòng thử lại.");
          }
          results[key] = { ok: true, connected: true, status: "CONNECTED", message: "Đã kết nối, chờ đồng bộ dữ liệu." };
        } catch (error) { results[key] = portalFailure(error); }
        publish();
      }));
      return { ok: portalKeys.every(key => results[key].ok), results };
    } finally { active = false; if (typeof unsubscribe === "function") unsubscribe(); }
  },
  all(options = {}) {
    if (allSyncInFlight) return allSyncInFlight;
    allSyncInFlight = (async () => {
      const publish = (job) => {
        if (typeof options.onProgress === "function") options.onProgress(job);
      };
      publish({ status: "CONNECTING", results: Object.fromEntries(portalKeys.map((key) => [key, { status: "CONNECTING", message: "Đang kiểm tra đăng nhập." }])) });
      let connections;
      try { connections = await syncApi.connectAll({ ...options, onConnectionProgress: publish }); }
      catch (error) { connections = { results: Object.fromEntries(portalKeys.map(key => [key, portalFailure(error)])) }; }
      const results = Object.fromEntries(portalKeys.map((key) => {
        const item = connections.results?.[key] || { ok: false, message: "Chưa kết nối được " + key.toUpperCase() + "." };
        return [key, item.ok ? item : { ...item, status: "FAILED", connected: false }];
      }));
      const sources = portalKeys.filter((key) => results[key]?.ok).map((key) => key.toUpperCase());
      let job = null;
      const merge = (snapshot) => combinePortalJob(snapshot, results);
      if (sources.length) {
        try {
          job = unwrapResponse(await syncApi.start({ sources }));
          job = await syncApi.watch(job, { ...options, onProgress: (snapshot) => publish(merge(snapshot)) });
          for (const source of sources) {
            const key = source.toLowerCase();
            results[key] = job.results?.[key] || { ok: false, status: "UNKNOWN", message: "Máy chủ chưa trả kết quả đồng bộ " + source + "." };
          }
        } catch (error) {
          job = error.lastJob || job;
          for (const source of sources) {
            const key = source.toLowerCase();
            const last = job?.results?.[key];
            results[key] = ["COMPLETED", "PARTIAL", "FAILED"].includes(last?.status) ? last : {
              ...last, ok: false, status: job?.jobId ? "UNKNOWN" : "FAILED", monitoringLost: Boolean(job?.jobId),
              message: error.response?.data?.message || error.message || "Không theo dõi được tiến trình đồng bộ.",
            };
          }
          job = { ...job, status: job?.jobId ? "UNKNOWN" : "FAILED", monitoringError: true, message: error.message };
        }
      }
      const result = { ...(job ? combinePortalJob(job, results) : { status: "CONNECTION_FAILED", message: "Chưa kết nối được nguồn nào. Hoàn tất đăng nhập rồi thử lại." }), ok: portalKeys.every((key) => results[key]?.ok), results };
      publish(result);
      return result;
    })();
    allSyncInFlight.then(() => { allSyncInFlight = null; }, () => { allSyncInFlight = null; });
    return allSyncInFlight;
  },
  getSources() {
    return apiClient.get(ENDPOINTS.sync.sources);
  },
  start(data) {
    return apiClient.post(ENDPOINTS.sync.start, data);
  },
  status(jobId) {
    return apiClient.get(ENDPOINTS.sync.status, { params: { jobId } });
  },
  currentCourses() {
    return apiClient.get(ENDPOINTS.sync.currentCourses);
  },
  refresh() {
    return apiClient.post(ENDPOINTS.sync.refresh);
  },
  iu: {
    async connect() {
      const bridge = window.__uniStudyIU;
      if (!bridge?.isAvailable || !bridge.loginIU) return false;
      const result = await bridge.loginIU();
      if (result?.ok === false)
        throw new Error(result.message || "Chưa kết nối được IU.");
      return true;
    },
    createSession(data) {
      return apiClient.post(ENDPOINTS.sync.iu.session, data);
    },
    status(options = {}) {
      return apiClient.get(ENDPOINTS.sync.iu.status, options);
    },
    deleteSession() {
      const bridge = window.__uniStudyIU;
      if (bridge?.isAvailable && bridge.logoutIU) return bridge.logoutIU();
      return apiClient.delete(ENDPOINTS.sync.iu.session);
    },
    pull(options = {}) {
      return apiClient.post(ENDPOINTS.sync.iu.pull, { soNgayLichThi: 70, ...options });
    },
    group(data) {
      return apiClient.post(ENDPOINTS.sync.iu.group, data);
    },
  },
  edux: {
    createSession(data) {
      return apiClient.post(ENDPOINTS.sync.edux.session, data);
    },
    status(options = {}) {
      return apiClient.get(ENDPOINTS.sync.edux.status, options);
    },
    pull() {
      return apiClient.post(ENDPOINTS.sync.edux.pull);
    },
    deleteSession() {
      return apiClient.delete(ENDPOINTS.sync.edux.session);
    },
  },
};

export const searchApi = {
  search(query, tag) {
    return apiClient.get(ENDPOINTS.search, { params: { q: query, tag } });
  },
};

export const tagApi = {
  updateTask(id, tags) {
    return apiClient.patch(`${ENDPOINTS.tags.task}/${id}`, { tags });
  },
  updateEdux(id, tags) {
    return apiClient.patch(`${ENDPOINTS.tags.edux}/${id}`, { tags });
  },
};

export const aiApi = {
  status() {
    return apiClient.get(ENDPOINTS.ai.status);
  },
  ask(data) {
    return apiClient.post(ENDPOINTS.ai.ask, data);
  },
  plan(data) {
    return apiClient.post(ENDPOINTS.ai.plan, data);
  },
  confirmPlan(data) {
    return apiClient.post(ENDPOINTS.ai.planConfirm, data);
  },
  examPlan(data) {
    return apiClient.post(ENDPOINTS.ai.examPlan, data);
  },
  confirmExamPlan(data) {
    return apiClient.post(ENDPOINTS.ai.examPlanConfirm, data);
  },
  check(data) {
    return apiClient.post(ENDPOINTS.ai.check, data);
  },
  async summarize(data, options = {}) {
    const { signal, onProgress } = options;
    let response = await apiClient.post(ENDPOINTS.ai.summarize, data, { signal });
    let job = response.data?.data;
    const jobId = job?.jobId;
    if (!jobId) return response;
    const cancel = () => { apiClient.delete('/ai/summary-jobs/' + encodeURIComponent(jobId)).catch(() => {}); };
    signal?.addEventListener('abort', cancel, { once: true });
    const deadline = Date.now() + 12 * 60 * 1000;
    try {
      while (true) {
        if (signal?.aborted) throw new Error('Đã dừng tóm tắt.');
        onProgress?.(job.message || 'Đang tóm tắt từng phần…');
        if (job.status === 'completed') return { ...response, data: { success: true, data: job.result } };
        if (['failed', 'cancelled'].includes(job.status)) throw new Error(job.error?.message || 'Tóm tắt chưa hoàn tất. Hãy thử lại.');
        if (Date.now() > deadline) throw new Error('Tóm tắt chưa hoàn tất trong thời gian chờ. Nội dung được giữ để thử lại.');
        await new Promise((resolve, reject) => {
          const abort = () => { clearTimeout(timer); reject(new Error('Đã dừng tóm tắt.')); };
          const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, 1500);
          signal?.addEventListener('abort', abort, { once: true });
        });
        response = await apiClient.get('/ai/summary-jobs/' + encodeURIComponent(jobId), { signal });
        job = response.data?.data;
        if (!job?.status) throw new Error('Không đọc được tiến trình tóm tắt. Hãy gửi lại nội dung để tiếp tục.');
      }
    } finally { signal?.removeEventListener('abort', cancel); }
  },
  cancelSummary(id) {
    return apiClient.delete('/ai/summary-jobs/' + encodeURIComponent(id));
  },
  draftLeave(data) {
    return apiClient.post(ENDPOINTS.ai.draftLeave, data);
  },
  progressAdvice(data) {
    return apiClient.post(ENDPOINTS.ai.progressAdvice, data);
  },
  difficultNotes(data) {
    return apiClient.post(ENDPOINTS.ai.difficultNotes, data);
  },
};

export const quizApi = {
  list() {
    return aiResourceRequest("get", ENDPOINTS.quizzes.list);
  },
  create(data) {
    return aiResourceRequest("post", ENDPOINTS.quizzes.list, data);
  },
  detail(id) {
    return aiResourceRequest("get", `${ENDPOINTS.quizzes.detail}/${id}`);
  },
  submit(id, data) {
    return aiResourceRequest(
      "post",
      `${ENDPOINTS.quizzes.submit}/${id}/submit`,
      data,
    );
  },
};

export const weaknessApi = {
  list() {
    return aiResourceRequest("get", ENDPOINTS.weaknesses.list);
  },
  analyze(data) {
    return aiResourceRequest("post", ENDPOINTS.weaknesses.analyze, data);
  },
};

export const healthApi = {
  check() {
    return apiClient.get(ENDPOINTS.health, {
      baseURL: backendOrigin,
    });
  },
};
// Both paths exist in published backend contracts; retry only a missing route.
async function aiResourceRequest(method, url, data) {
  try {
    return await apiClient.request({ method, url, data, timeout: 180000 });
  } catch (error) {
    if (error.response?.status !== 404) throw error;
    return apiClient.request({
      method,
      url: ENDPOINTS.aiResourcesPrefix + url,
      data,
      timeout: 180000,
    });
  }
}
