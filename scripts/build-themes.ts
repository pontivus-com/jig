const THEME_SOURCES = [
  "ui/src/jig-theme.source.ts",
  "ui/src/themes/astryx-neutral.source.ts",
  "ui/src/themes/astryx-butter.source.ts",
  "ui/src/themes/astryx-chocolate.source.ts",
  "ui/src/themes/astryx-matcha.source.ts",
  "ui/src/themes/astryx-stone.source.ts",
  "ui/src/themes/astryx-y2k.source.ts",
  "ui/src/themes/gruvbox.source.ts",
  "ui/src/themes/dracula.source.ts",
  "ui/src/themes/solarized.source.ts",
  "ui/src/themes/nord.source.ts",
  "ui/src/themes/catppuccin.source.ts",
  "ui/src/themes/tokyo-night.source.ts",
] as const;

const checkOnly = process.argv.includes("--check");

for (const source of THEME_SOURCES) {
  const args = [
    "bunx",
    "--bun",
    "astryx",
    "theme",
    "build",
    source,
    ...(checkOnly ? ["--check"] : []),
  ];
  const result = Bun.spawnSync(args, {
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}
