import { syncApi } from '../api';
import { useApi } from './useApi';

export function currentSubjects(scope) {
  return scope?.resolved === true ? (scope.courses || []).map(course => ({
    subject_id: course.subjectId ?? course.subject_id,
    subject_name: course.subjectName || course.subject_name,
    subject_code: course.subjectCode || course.subject_code,
  })).filter(course => course.subject_id && course.subject_name) : [];
}

// Preserve only the saved historical selection. An unresolved IU term must
// never silently become the full historical subject list.
export function useCurrentCourses(savedId, savedName) {
  const state = useApi(syncApi.currentCourses);
  const subjects = currentSubjects(state.data);
  if (savedId && !subjects.some(s => String(s.subject_id) === String(savedId))) {
    subjects.push({ subject_id: savedId, subject_name: savedName || `Môn đã lưu (#${savedId})` });
  }
  return { ...state, subjects, message: state.loading ? 'Đang tải môn kỳ hiện tại…'
    : state.error ? 'Chưa tải được môn kỳ hiện tại. Hãy thử lại hoặc đồng bộ thời khóa biểu IU.'
      : !state.data?.resolved || !currentSubjects(state.data).length
        ? state.data?.message || 'Chưa xác định được kỳ hiện tại. Hãy đồng bộ thời khóa biểu IU.' : '' };
}
