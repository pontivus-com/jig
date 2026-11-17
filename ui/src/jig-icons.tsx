import type { ReactNode, SVGProps } from "react";
import {
  getExtendedIcon,
  Icon,
  type IconColor,
  type NamespacedIconName,
} from "@astryxdesign/core/Icon";
import { useThemeName } from "@astryxdesign/core/theme";

export type JigIconName = "add" | "history" | "edit" | "delete";

export const JIG_ICON_KEYS = {
  add: "jig:add",
  history: "jig:history",
  edit: "jig:edit",
  delete: "jig:delete",
} as const satisfies Record<JigIconName, NamespacedIconName>;

type Glyph = (props: SVGProps<SVGSVGElement>) => React.JSX.Element;

function glyph(paths: readonly string[]): Glyph {
  function JigGlyph(props: SVGProps<SVGSVGElement>): React.JSX.Element {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {paths.map((path) => (
          <path key={path} d={path} />
        ))}
      </svg>
    );
  }

  return JigGlyph;
}

const FALLBACK_GLYPHS: Record<JigIconName, Glyph> = {
  add: glyph(["M12 5v14", "M5 12h14"]),
  history: glyph([
    "M3.5 12a8.5 8.5 0 1 0 2.49-6.01",
    "M3.5 5.5v5h5",
    "M12 7.5V12l3 2",
  ]),
  edit: glyph(["M15.5 4.5l4 4L8 20H4v-4L15.5 4.5z", "M13.5 6.5l4 4"]),
  delete: glyph([
    "M4.5 6.5h15",
    "M9.5 6.5v-2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2",
    "M6.5 6.5l1 13a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1l1-13",
    "M10.5 10.5v6",
    "M13.5 10.5v6",
  ]),
};

const NO_ENTRY: ReactNode = <></>;

export function JigIcon({
  name,
  color = "secondary",
  size = "sm",
}: Readonly<{
  name: JigIconName;
  color?: IconColor;
  size?: "xsm" | "sm" | "md" | "lg";
}>): React.ReactElement {
  const themeName = useThemeName();
  const key = JIG_ICON_KEYS[name];
  const hasOverride = getExtendedIcon(key, NO_ENTRY, themeName) !== NO_ENTRY;

  return (
    <Icon
      icon={hasOverride ? key : FALLBACK_GLYPHS[name]}
      color={color}
      size={size}
    />
  );
}
