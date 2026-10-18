/**
 * UniStudy CMC - Application Entry Point (ES Modules)
 */
import { bootstrap } from "./app/bootstrap.js?v=5";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
