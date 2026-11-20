// Day/night choice: localStorage("theme") + <html data-theme>. The inline script in
// layout.tsx applies the stored choice before first paint; without one the OS setting wins.
export type Theme = "light" | "dark";

export function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem("theme", t);
  } catch {}
}
