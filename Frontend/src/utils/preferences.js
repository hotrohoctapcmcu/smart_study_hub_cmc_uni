export const defaultPreferences = {
  theme: "light",
  color: "#7557ff",
  font: "Be Vietnam Pro",
  radius: "medium",
  notifications: true,
};
export function readPreferences() {
  try {
    return {
      ...defaultPreferences,
      ...JSON.parse(localStorage.getItem("ssh-preferences") || "{}"),
    };
  } catch {
    return defaultPreferences;
  }
}
export function applyPreferences(p) {
  const root = document.documentElement;
  root.dataset.theme = p.theme;
  root.style.setProperty("--primary", p.color);
  root.style.setProperty("--primary-hover", "color-mix(in srgb, " + p.color + " 85%, #30205c)");
  root.style.setProperty(
    "--primary-soft",
    "color-mix(in srgb, " + p.color + " 12%, var(--surface))",
  );
  root.style.setProperty("--font", '"' + p.font + '", sans-serif');
  root.style.setProperty("--heading-font", p.font === "Be Vietnam Pro" ? '"Plus Jakarta Sans", "Be Vietnam Pro", sans-serif' : '"' + p.font + '", sans-serif');
  root.style.setProperty(
    "--radius-md",
    p.radius === "small" ? "10px" : p.radius === "large" ? "24px" : "18px",
  );
  try { localStorage.setItem("ssh-preferences", JSON.stringify(p)); } catch { /* Preferences still apply when storage is disabled. */ }
  window.dispatchEvent(new Event("preferences-updated"));
}
