import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateThemeCSS } from "@astryxdesign/core/theme";
import { defineConfig } from "vite";
import { jigThemeSource } from "./ui/src/theme";

const themeOutput = resolve("ui/src/jig-theme.generated.css");
const layerOrder = "@layer reset, astryx-base, astryx-theme;";

function writeBuiltJigTheme(): void {
  const { prose, component } = generateThemeCSS(jigThemeSource);
  const sections = [
    layerOrder,
    prose.length === 0 ? "" : `@layer reset {\n${prose}\n}`,
    component.length === 0
      ? ""
      : `@layer astryx-theme {\n${component}\n}`,
    "",
  ];

  writeFileSync(themeOutput, sections.filter(Boolean).join("\n"), "utf8");
}

// Keep the custom Jig theme on Astryx's built-theme path without introducing
// a second styling compiler. generateThemeCSS() is the same public compiler
// used by <Theme>; Vite materializes its CSS before resolving application CSS.
writeBuiltJigTheme();

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
