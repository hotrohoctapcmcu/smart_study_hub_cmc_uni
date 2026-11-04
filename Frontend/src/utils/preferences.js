export const defaultPreferences = {
  theme: "light",
  color: "#6340df",
  font: "Be Vietnam Pro",
  radius: "medium",
  notifications: true,
};
export function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem("ssh-preferences") || "{}");
    // Keep existing accent choices in the same hue with the stronger palette.
    const previousColors = {
      "#7557ff": "#6340df",
      "#3b82f6": "#2564c2",
      "#159b72": "#067257",
      "#e07928": "#955107",
      "#d34b98": "#b52b7d",
    };
    return {
      ...defaultPreferences,
      ...saved,
      color: previousColors[saved?.color] || saved?.color || defaultPreferences.color,
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
  root.style.removeProperty("--primary-soft");
  root.style.setProperty("--font", '"' + p.font + '", sans-serif');
  root.style.setProperty("--heading-font", p.font === "Be Vietnam Pro" ? '"Plus Jakarta Sans", "Be Vietnam Pro", sans-serif' : '"' + p.font + '", sans-serif');
  root.style.setProperty(
    "--radius-md",
    p.radius === "small" ? "10px" : p.radius === "large" ? "24px" : "18px",
  );
  try { localStorage.setItem("ssh-preferences", JSON.stringify(p)); } catch { /* Preferences still apply when storage is disabled. */ }
  window.dispatchEvent(new Event("preferences-updated"));
}
