import type { TokenValue } from "@astryxdesign/core/theme";

export interface JigSurfaceRoles {
  readonly chrome: TokenValue;
  readonly planner: TokenValue;
  readonly task: TokenValue;
}

const sharedJigProductLocalTokens = {
  "--jig-state-today-border": "var(--color-border-teal)",
  "--jig-state-today-text": "var(--color-text-teal)",
  "--jig-state-task-selected-bg": "var(--color-info-muted)",
  "--jig-state-task-selected-border": "var(--color-border-info)",
  "--jig-state-nav-active-bg": "var(--color-neutral)",
  "--jig-state-nav-active-text": "var(--color-text-primary)",
  "--jig-state-drag-border": "var(--color-accent)",
  "--jig-state-drag-bg": "var(--color-accent-muted)",
  "--jig-priority-high": "var(--color-text-error)",
  "--jig-priority-normal": "var(--color-text-secondary)",
  "--jig-priority-low": "var(--color-text-success)",
  "--jig-status-healthy-bg": "var(--color-success-muted)",
  "--jig-status-healthy-border": "var(--color-border-success)",
  "--jig-status-healthy-text": "var(--color-text-success)",
  "--jig-state-hover-bg":
    "color-mix(in srgb, var(--jig-task-surface) 95%, var(--color-tint-hover) 5%)",
  "--jig-state-pressed-bg":
    "color-mix(in srgb, var(--jig-task-surface) 90%, var(--color-tint-hover) 10%)",
  "--jig-task-border": "var(--color-border-emphasized)",
  "--jig-brand-primary": "var(--color-icon-primary)",
  "--jig-brand-accent": "var(--color-icon-accent)",
} as const satisfies Record<string, TokenValue>;

export function jigProductLocalTokens(
  surfaceRoles: JigSurfaceRoles,
): Record<string, TokenValue> {
  return {
    ...sharedJigProductLocalTokens,
    "--jig-chrome-surface": surfaceRoles.chrome,
    "--jig-planner-surface": surfaceRoles.planner,
    "--jig-task-surface": surfaceRoles.task,
  };
}
