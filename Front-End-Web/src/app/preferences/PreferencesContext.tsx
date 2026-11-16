import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadFromStorage, saveToStorage } from "../lib/storage";

export type Theme = "claro" | "escuro" | "sistema";
export type FontScale = "normal" | "grande" | "maior";

type PreferencesContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** O tema em vigor depois de resolver "sistema". */
  resolvedTheme: Exclude<Theme, "sistema">;
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
};

const themeKey = "escort-theme";
const fontScaleKey = "escort-font-scale";

export const themeOptions: { id: Theme; label: string; description: string }[] = [
  { id: "claro", label: "Claro", description: "Fundo claro em qualquer horário." },
  { id: "escuro", label: "Escuro", description: "Fundo escuro, menos luz à noite." },
  { id: "sistema", label: "Do sistema", description: "Acompanha a configuração do aparelho." },
];

/**
 * Alimenta o token --font-size que theme.css ja aplica em `html`. Como o
 * Tailwind dimensiona em rem, mexer na fonte da raiz escala texto, espacamento
 * e componentes juntos, sem tocar em cada tela.
 */
export const fontScaleOptions: { id: FontScale; label: string; rootSize: string }[] = [
  { id: "normal", label: "Padrão", rootSize: "16px" },
  { id: "grande", label: "Grande", rootSize: "18px" },
  { id: "maior", label: "Maior", rootSize: "20px" },
];

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

function systemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => loadFromStorage<Theme>(themeKey, "sistema"));
  const [fontScale, setFontScaleState] = useState<FontScale>(() =>
    loadFromStorage<FontScale>(fontScaleKey, "normal"),
  );
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Em "sistema", a troca de tema do aparelho precisa refletir na hora.
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return;

    const handleChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  const resolvedTheme: Exclude<Theme, "sistema"> =
    theme === "sistema" ? (systemDark ? "escuro" : "claro") : theme;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "escuro");
    document.documentElement.style.colorScheme = resolvedTheme === "escuro" ? "dark" : "light";
  }, [resolvedTheme]);

  useEffect(() => {
    const option = fontScaleOptions.find((item) => item.id === fontScale) ?? fontScaleOptions[0];
    document.documentElement.style.setProperty("--font-size", option.rootSize);
  }, [fontScale]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    saveToStorage(themeKey, next);
  }, []);

  const setFontScale = useCallback((next: FontScale) => {
    setFontScaleState(next);
    saveToStorage(fontScaleKey, next);
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({ theme, setTheme, resolvedTheme, fontScale, setFontScale }),
    [theme, setTheme, resolvedTheme, fontScale, setFontScale],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used inside PreferencesProvider");
  return context;
}
