const foxAssets = {
  "fox-student-avatar.png": new URL(
    "./optimized/fox-student-avatar.png",
    import.meta.url,
  ).href,
  "fox-wave.png": new URL("./optimized/fox-wave.png", import.meta.url).href,
  "fox-ai-tutor.png": new URL(
    "./optimized/fox-ai-tutor.png",
    import.meta.url,
  ).href,
  "fox-pomodoro.png": new URL(
    "./optimized/fox-pomodoro.png",
    import.meta.url,
  ).href,
  "fox-deadline-alert.png": new URL(
    "./optimized/fox-deadline-alert.png",
    import.meta.url,
  ).href,
  "fox-flashcard.png": new URL(
    "./optimized/fox-flashcard.png",
    import.meta.url,
  ).href,
  "fox-login-lock.png": new URL(
    "./optimized/fox-login-lock.png",
    import.meta.url,
  ).href,
  "fox-quiz-success.png": new URL(
    "./optimized/fox-quiz-success.png",
    import.meta.url,
  ).href,
  "fox-study.png": new URL("./optimized/fox-study.png", import.meta.url)
    .href,
};

export const FoxStudentAvatar = () => (
  <img src={foxAssets["fox-student-avatar.png"]} alt="Cáo sinh viên" />
);

export default foxAssets;
