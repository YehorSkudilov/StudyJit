// Light, dark, or whatever the system uses. The choice is kept in this browser and applied as data-theme on <html>
// (globals.css reads it); "system" removes it so the system's setting decides.

export type ThemeChoice = "system" | "light" | "dark";

const storageKey = "studyjit.theme";

export function readTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  try {
    if (choice === "system") localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, choice);
  } catch {
    // No storage: the choice lasts until the page closes.
  }
}

/** Runs before the page paints (inlined in the layout), so a picked theme never flashes the other one first. */
export const themeScript = `try{var t=localStorage.getItem("${storageKey}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
