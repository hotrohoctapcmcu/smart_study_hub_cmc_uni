import { syncApi, taskApi, scheduleApi, examApi } from "../../api";
import { responseList, unwrapResponse } from "../../api/apiClient";
import { useApi } from "../../hooks/useApi";
import { planningNow } from "../../utils/planning";
import { expandClassSchedules } from "../../utils/scheduleAdapter";
import { workspaceTasks, taskDueMeta } from "../../pages/Tasks/taskWorkspace";
import { currentSubjects } from "../../hooks/useCurrentCourses";

export function usePomodoroPlan() {
  const edux = useApi(taskApi.edux);
  const main = useApi(async () => {
    const from = planningNow().date, to = planningNow(new Date(Date.now() + 86400000)).date;
    const results = await Promise.allSettled([syncApi.currentCourses(), taskApi.list(), scheduleApi.byWeek(from, to), examApi.list()]);
    const list = (index, key) => results[index].status === "fulfilled" ? responseList(results[index].value, key) : [];
    const scope = results[0].status === "fulfilled" ? unwrapResponse(results[0].value) : null;
    const subjects = currentSubjects(scope);
    return { subjects, currentCourseMessage: scope?.message || (!scope?.resolved ? 'Chưa xác định được môn kỳ hiện tại. Hãy đồng bộ thời khóa biểu IU.' : ''),
      termLabel: scope?.semester ? `${scope.semester}${scope.academicYear ? ` · ${scope.academicYear}` : ''}` : '',
      localTasks: list(1), classes: expandClassSchedules(list(2), from, to), exams: list(3, "exams"),
      scheduleKnown: results[2].status === "fulfilled" && results[3].status === "fulfilled", checkedAt: Date.now(),
      unavailable: results.map((result, index) => result.status === "rejected" ? ["môn học", "việc cá nhân", "lịch lớp", "lịch thi"][index] : null).filter(Boolean) };
  });
  const tasks = workspaceTasks(main.data?.localTasks || [], responseList(edux.data, "assignments"))
    .filter(task => task.id != null && task.status !== "COMPLETED" && (main.data?.subjects || []).some(subject =>
      task.source === "PERSONAL" && task.subjectId != null ? String(task.subjectId) === String(subject.subject_id)
        : sameCourseName(task.subject, subject.subject_name)))
    .sort((a, b) => String(a.deadline || "9999").localeCompare(String(b.deadline || "9999")))
    .map(task => ({ ...task, dueLabel: taskDueMeta(task).label }));
  return { ...main, data: main.data ? { ...main.data, tasks, eduxLoading: edux.loading, unavailable: [...main.data.unavailable, ...(edux.error ? ["EDUX"] : [])] } : null,
    refetch: () => { edux.refetch(); return main.refetch(); } };
}

function courseName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase()
    .replace(/\s+/g, ' ').trim();
}
function sameCourseName(first, second) {
  const a = courseName(first), b = courseName(second);
  const base = value => value.replace(/\s*(?:[-–—]\s*k(?:hoa)?\s*\d+|\(\s*k(?:hoa)?\s*\d+\s*\))\s*$/, '').trim();
  return a && b && (a === b || base(a) === base(b) && (a === base(a) || b === base(b)));
}
