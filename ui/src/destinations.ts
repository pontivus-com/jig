import type {
  IconName,
  NamespacedIconName,
} from "@astryxdesign/core/Icon";
import { JIG_ICON_KEYS } from "./jig-icons";

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
  readonly id: string;
  readonly label: string;
  readonly subtitle: string | null;
  readonly icon: IconName | NamespacedIconName;
}[];

export type Destination = (typeof DESTINATIONS)[number]["id"];
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
