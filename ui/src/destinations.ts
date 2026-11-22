import type {
  IconName,
  NamespacedIconName,
} from "@astryxdesign/core/Icon";
import { JIG_ICON_KEYS } from "./jig-icons";
import type { Destination } from "./navigation";

export const DESTINATIONS = [
  {
    id: "planner",
    label: "Planner",
    subtitle: null,
    icon: "viewColumns",
  },
  {
    id: "history",
    label: "History",
    subtitle: "Completed work grouped by actual completion date",
    icon: JIG_ICON_KEYS.history,
  },
  {
    id: "settings",
    label: "Settings",
    subtitle: "Repository, synchronization, appearance and diagnostics",
    icon: "wrench",
  },
] as const satisfies readonly {
  readonly id: Destination;
  readonly label: string;
  readonly subtitle: string | null;
  readonly icon: IconName | NamespacedIconName;
}[];

export type DestinationDefinition = (typeof DESTINATIONS)[number];
export type DestinationIconName = DestinationDefinition["icon"];

export function destinationDefinition(
  destination: Destination,
): DestinationDefinition {
  for (const item of DESTINATIONS) {
    if (item.id === destination) {
      return item;
    }
  }

  throw new Error(`Unknown Jig destination: ${destination}`);
}
