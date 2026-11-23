import type {
  CoreTokenName,
  TokenValue,
} from "@astryxdesign/core/theme";

export const jigMotionTokens = {
  "--duration-fast-min": "190ms",
  "--duration-fast": "250ms",
  "--duration-fast-max": "330ms",
  "--duration-medium-min": "450ms",
  "--duration-medium": "600ms",
  "--duration-medium-max": "800ms",
  "--duration-slow-min": "1050ms",
  "--duration-slow": "1400ms",
  "--duration-slow-max": "1870ms",
} as const satisfies Partial<Record<CoreTokenName, TokenValue>>;
