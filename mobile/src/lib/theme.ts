/**
 * Editorial theme — a 1:1 port of the web app's palette and type system
 * (app/globals.css + app/layout.tsx) into React Native tokens.
 *
 * Light values mirror `:root`, dark values mirror `.dark`. Font family names
 * map to the @expo-google-fonts exports loaded in app/_layout.tsx.
 */
import { useColorScheme } from "react-native";

export interface Palette {
  ink: string;
  bone: string;
  sand: string;
  paper: string;
  brand: string;
  brandSoft: string;
  olive: string;
  inkMuted: string;
  inkMuted2: string;
  /** ~ border-ink/5 — hairline card borders */
  border: string;
  /** ~ border-ink/10 — stronger dividers */
  borderStrong: string;
  chipBorder: string;
  chipBg: string;
  /** translucent fill for inputs/inactive chips (~ bg-ink/[0.04]) */
  fill: string;
  /** overlay scrim for image badges */
  scrim: string;
}

const light: Palette = {
  ink: "#0a0a0a",
  bone: "#f5f1eb",
  sand: "#e8e1d4",
  paper: "#fffdf8",
  brand: "#c8553d",
  brandSoft: "#e4a89b",
  olive: "#5a6b46",
  inkMuted: "#6b6357",
  inkMuted2: "#9c9385",
  border: "rgba(10,10,10,0.06)",
  borderStrong: "rgba(10,10,10,0.10)",
  chipBorder: "rgba(10,10,10,0.08)",
  chipBg: "rgba(255,253,248,0.85)",
  fill: "rgba(10,10,10,0.04)",
  scrim: "rgba(10,10,10,0.55)",
};

const dark: Palette = {
  ink: "#f5f1eb",
  bone: "#14110d",
  sand: "#211c17",
  paper: "#1c1814",
  brand: "#e57a62",
  brandSoft: "#c87560",
  olive: "#8aa067",
  inkMuted: "#a39988",
  inkMuted2: "#6e6558",
  border: "rgba(245,241,235,0.08)",
  borderStrong: "rgba(245,241,235,0.14)",
  chipBorder: "rgba(245,241,235,0.12)",
  chipBg: "rgba(245,241,235,0.08)",
  fill: "rgba(245,241,235,0.06)",
  scrim: "rgba(0,0,0,0.5)",
};

/** Font family names — must match the keys passed to useFonts() in _layout.tsx. */
export const fonts = {
  display: "Fraunces_400Regular",
  displayMedium: "Fraunces_500Medium",
  displaySemiBold: "Fraunces_600SemiBold",
  displayItalic: "Fraunces_500Medium_Italic",
  body: "Geist_400Regular",
  bodyMedium: "Geist_500Medium",
  bodySemiBold: "Geist_600SemiBold",
  mono: "GeistMono_400Regular",
  monoMedium: "GeistMono_500Medium",
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export type Theme = { c: Palette; scheme: "light" | "dark" };

export function useTheme(): Theme {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return { c: scheme === "dark" ? dark : light, scheme };
}

export const palettes = { light, dark };
