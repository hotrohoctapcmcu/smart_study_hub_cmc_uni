export default function CurrentCourseHint({ state }) {
  return state.message ? <p className="hint" aria-live="polite">{state.message} {!state.loading && <button type="button" onClick={state.refetch}>Tải lại môn học</button>}</p> : null;
}
