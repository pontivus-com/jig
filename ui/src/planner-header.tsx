import {
  Button,
  Icon,
  IconButton,
} from "@astryxdesign/core";
import type {
  IconName,
  NamespacedIconName,
} from "@astryxdesign/core/Icon";
import type { ReactNode } from "react";
import { JIG_ICON_KEYS, JigIcon } from "./jig-icons";
import { JigLogo } from "./jig-logo";
import type { Destination } from "./navigation";
import type { LayoutMode } from "./use-layout-mode";

const DESTINATIONS = [
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

type DestinationDefinition = (typeof DESTINATIONS)[number];
type DestinationIconName = DestinationDefinition["icon"];

export interface PlannerHeaderProps {
  readonly destination: Destination;
  readonly layoutMode: LayoutMode;
  readonly weekLabel: string;
  readonly statusControl: ReactNode;
  readonly compactStatusControl: ReactNode;
  readonly onHome: () => void;
  readonly onPreviousWeek: () => void;
  readonly onToday: () => void;
  readonly onNextWeek: () => void;
  readonly onAdd: () => void;
  readonly onNavigate: (destination: Destination) => void;
}

function destinationDefinition(
  destination: Destination,
): DestinationDefinition {
  for (const item of DESTINATIONS) {
    if (item.id === destination) {
      return item;
    }
  }

  throw new Error(`Unknown Jig destination: ${destination}`);
}

function DestinationIcon({
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

function BrandHome({
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

function TemporalNavigator({
  weekLabel,
  compact,
  onPreviousWeek,
  onToday,
  onNextWeek,
}: Readonly<
  Pick<
    PlannerHeaderProps,
    "weekLabel" | "onPreviousWeek" | "onToday" | "onNextWeek"
  > & { readonly compact?: boolean }
>): React.ReactElement {
  return (
    <div className="jig-header-temporal">
      <IconButton
        label="Previous week"
        icon={<Icon icon="chevronLeft" color="inherit" />}
        variant="ghost"
        size="sm"
        onClick={onPreviousWeek}
      />
      <strong className="jig-header-week-range">{weekLabel}</strong>
      <IconButton
        label="Next week"
        icon={<Icon icon="chevronRight" color="inherit" />}
        variant="ghost"
        size="sm"
        onClick={onNextWeek}
      />
      {compact === true ? (
        <Button
          label="Today"
          variant="ghost"
          size="sm"
          className="jig-mobile-today"
          onClick={onToday}
        />
      ) : (
        <Button
          label="Today"
          icon={<Icon icon="calendar" size="sm" color="inherit" />}
          variant="secondary"
          size="sm"
          onClick={onToday}
        />
      )}
    </div>
  );
}

function DestinationHeading({
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
      {compact ? null : (
        <span className="jig-header-destination-subtitle">
          {definition.subtitle}
        </span>
      )}
    </div>
  );
}

function DestinationNav({
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

function DesktopHeader(props: PlannerHeaderProps): React.ReactElement {
  const {
    destination,
    weekLabel,
    statusControl,
    onHome,
    onPreviousWeek,
    onToday,
    onNextWeek,
    onAdd,
    onNavigate,
  } = props;

  return (
    <header className="jig-app-header jig-app-header-desktop">
      <div className="jig-header-left">
        <BrandHome onHome={onHome} />
      </div>
      <div className="jig-header-center">
        {destination === "planner" ? (
          <TemporalNavigator
            weekLabel={weekLabel}
            onPreviousWeek={onPreviousWeek}
            onToday={onToday}
            onNextWeek={onNextWeek}
          />
        ) : (
          <DestinationHeading destination={destination} />
        )}
      </div>
      <div className="jig-header-right">
        {destination === "planner" ? (
          <Button
            label="Add task"
            icon={<JigIcon name="add" color="inherit" />}
            variant="primary"
            size="sm"
            onClick={onAdd}
          />
        ) : null}
        <DestinationNav
          destination={destination}
          onNavigate={onNavigate}
        />
        {statusControl}
      </div>
    </header>
  );
}

function NarrowHeader(props: PlannerHeaderProps): React.ReactElement {
  const {
    destination,
    weekLabel,
    compactStatusControl,
    onHome,
    onPreviousWeek,
    onToday,
    onNextWeek,
  } = props;

  return (
    <header className="jig-app-header jig-app-header-narrow">
      <div className="jig-header-mobile-application-row">
        <div className="jig-header-mobile-identity">
          <BrandHome onHome={onHome} />
        </div>
        <div className="jig-header-mobile-title">
          <DestinationHeading destination={destination} compact />
        </div>
        <div className="jig-header-mobile-actions">
          {compactStatusControl}
        </div>
      </div>
      {destination === "planner" ? (
        <div className="jig-header-mobile-temporal-row">
          <TemporalNavigator
            weekLabel={weekLabel}
            compact
            onPreviousWeek={onPreviousWeek}
            onToday={onToday}
            onNextWeek={onNextWeek}
          />
        </div>
      ) : null}
    </header>
  );
}

export interface CompactApplicationNavigationProps
  extends Pick<PlannerHeaderProps, "destination" | "onAdd" | "onNavigate"> {
  readonly showAdd: boolean;
}

export function CompactApplicationNavigation({
  destination,
  onAdd,
  onNavigate,
  showAdd,
}: CompactApplicationNavigationProps): React.ReactElement {
  return (
    <>
      {destination === "planner" && showAdd ? (
        <IconButton
          label="Add task"
          icon={<JigIcon name="add" color="inherit" />}
          variant="primary"
          className="jig-mobile-add-fab"
          onClick={onAdd}
        />
      ) : null}
      <nav className="jig-mobile-bottom-navigation" aria-label="Primary">
        {DESTINATIONS.map((item) => {
          const isCurrent = destination === item.id;
          return (
            <Button
              key={item.id}
              label={item.label}
              variant="ghost"
              width="100%"
              aria-current={isCurrent ? "page" : undefined}
              className={[
                "jig-mobile-nav-item",
                isCurrent ? "jig-mobile-nav-item-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onNavigate(item.id)}
            >
              <span className="jig-mobile-nav-content">
                <span className="jig-mobile-nav-icon" aria-hidden="true">
                  <DestinationIcon icon={item.icon} />
                </span>
                <span className="jig-mobile-nav-label">{item.label}</span>
              </span>
            </Button>
          );
        })}
      </nav>
    </>
  );
}

export function PlannerHeader(props: PlannerHeaderProps): React.ReactElement {
  return props.layoutMode === "desktop" ? (
    <DesktopHeader {...props} />
  ) : (
    <NarrowHeader {...props} />
  );
}
