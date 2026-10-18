/**
 * UniStudy CMC - Study Planner Feature Entry
 */
import { renderStudyPlannerView } from "./study-planner.view.js";
import { attachStudyPlannerEvents } from "./study-planner.events.js";

export function mountStudyPlanner(containerEl) {
  containerEl.innerHTML = renderStudyPlannerView();
  attachStudyPlannerEvents(containerEl);
}
