/**
 * UniStudy CMC - Pomodoro Feature Entry Point
 */
import { renderPomodoroView } from "./pomodoro.view.js?v=4";
import { attachPomodoroEvents, unmountPomodoroEvents } from "./pomodoro.events.js?v=4";

export async function mountPomodoro(containerEl) {
  containerEl.innerHTML = renderPomodoroView();
  attachPomodoroEvents(containerEl);
  await (await import('./pomodoro.sync.js')).enablePomodoroSync();
  if (containerEl.isConnected !== false) {
    containerEl.innerHTML = renderPomodoroView(); attachPomodoroEvents(containerEl);
  }
}

export function unmountPomodoro() {
  unmountPomodoroEvents();
}
