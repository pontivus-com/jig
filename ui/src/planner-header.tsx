import {
  Button,
  Icon,
  IconButton,
} from "@astryxdesign/core";
import type { ReactNode } from "react";
import { JIG_ICON_KEYS, JigIcon } from "./jig-icons";
import {
  DESTINATIONS,
  destinationDefinition,
  type Destination,
  type DestinationIconName,
} from "./destinations";
import { JigLogo } from "./jig-logo";

export interface PlannerHeaderProps {
  readonly destination: Destination;
  readonly weekLabel: string;
  readonly canGoPrevious: boolean;
  readonly statusControl: ReactNode;
  readonly compactStatusControl: ReactNode;
  readonly onHome: () => void;
  readonly onPreviousWeek: () => void;
  readonly onToday: () => void;
  readonly onNextWeek: () => void;
  readonly onAdd: () => void;
  readonly onNavigate: (destination: Destination) => void;
}

export function DestinationIcon({
  icon,
}: Readonly<{ icon: DestinationIconName }>): React.ReactElement {
  switch (icon) {
    case JIG_ICON_KEYS.history:
      return <JigIcon name="history" color="inherit" />;
    case "viewColumns":
      return <Icon icon="viewColumns" size="sm" color="inherit" />;
    case "wrench":
      return <Icon icon="wrench" size="sm" color="inherit" />;
  }

  const unreachable: never = icon;
  return unreachable;
}

export function BrandHome({
  onHome,
}: Readonly<{ onHome: () => void }>): React.ReactElement {
  return (
    <Button
      label="Planner home"
      variant="ghost"
      size="sm"
      className="jig-header-home"
      onClick={onHome}
    >
      <span className="jig-header-brand">
        <span className="jig-brand-logo-wrap" aria-hidden="true">
          <JigLogo />
        </span>
      </span>
    </Button>
  );
}

export function TemporalNavigator({
  weekLabel,
  canGoPrevious,
  compact = false,
  onPreviousWeek,
  onToday,
  onNextWeek,
}: Readonly<
  Pick<
    PlannerHeaderProps,
    | "weekLabel"
    | "canGoPrevious"
    | "onPreviousWeek"
    | "onToday"
    | "onNextWeek"
  > & { readonly compact?: boolean }
>): React.ReactElement {
  return (
    <div className="jig-header-temporal">
      <IconButton
        label="Previous horizon"
        icon={<Icon icon="chevronLeft" color="inherit" />}
        variant="ghost"
        size="sm"
        className="jig-temporal-control"
        isDisabled={!canGoPrevious}
        onClick={onPreviousWeek}
      />
      <strong className="jig-header-week-range">{weekLabel}</strong>
      <IconButton
        label="Next horizon"
        icon={<Icon icon="chevronRight" color="inherit" />}
        variant="ghost"
        size="sm"
        className="jig-temporal-control"
        onClick={onNextWeek}
      />
      {compact ? (
        <Button
          label="Today"
          variant="ghost"
          size="sm"
          className="jig-mobile-today jig-temporal-control"
          onClick={onToday}
        />
      ) : (
        <Button
          label="Today"
          icon={<Icon icon="calendar" size="sm" color="inherit" />}
          variant="ghost"
          size="sm"
          className="jig-temporal-control"
          onClick={onToday}
        />
      )}
    </div>
  );
}

export function DestinationHeading({
  destination,
  compact = false,
}: Readonly<{
  destination: Destination;
  compact?: boolean;
}>): React.ReactElement {
  const definition = destinationDefinition(destination);
  return (
    <div className="jig-header-destination-heading">
      <h1 className="jig-header-destination-title">{definition.label}</h1>
      {compact || definition.subtitle === null ? null : (
        <span className="jig-header-destination-subtitle">
          {definition.subtitle}
        </span>
      )}
    </div>
  );
}

export function DestinationNav({
  destination,
  onNavigate,
}: Readonly<
  Pick<PlannerHeaderProps, "destination" | "onNavigate">
>): React.ReactElement {
  return (
    <nav className="jig-header-destinations" aria-label="Primary">
      {DESTINATIONS.map((item) => (
        <Button
          key={item.id}
          label={item.label}
          icon={<DestinationIcon icon={item.icon} />}
          variant="ghost"
          size="sm"
          aria-current={destination === item.id ? "page" : undefined}
          className={[
            "jig-header-nav-item",
            destination === item.id ? "jig-header-nav-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onNavigate(item.id)}
        />
      ))}
    </nav>
  );
}
