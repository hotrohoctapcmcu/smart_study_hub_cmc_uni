/**
 * UniStudy CMC - Mini Chat / Floating Actions Wrapper
 * Re-exports floating actions to maintain architectural consistency.
 */
export {
  renderFloatingActions,
  renderFloatingActions as renderMiniChat,
  attachFloatingActionsEvents,
  attachFloatingActionsEvents as attachMiniChatEvents
} from "./floating-actions.js";
