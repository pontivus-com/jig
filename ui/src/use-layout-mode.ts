import { useEffect, useState } from "react";

export const DESKTOP_LAYOUT_MEDIA_QUERY = "(min-width: 76rem)";

export type LayoutMode = "desktop" | "narrow";

function layoutMode(query: MediaQueryList): LayoutMode {
  return query.matches ? "desktop" : "narrow";
}

export function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>(() =>
    layoutMode(window.matchMedia(DESKTOP_LAYOUT_MEDIA_QUERY)),
  );

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_LAYOUT_MEDIA_QUERY);
    const onChange = (event: MediaQueryListEvent): void => {
      setMode(event.matches ? "desktop" : "narrow");
    };

    setMode(layoutMode(query));
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return mode;
}
