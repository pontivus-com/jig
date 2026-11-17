import {
  Button,
  DropdownMenu,
  Icon,
  IconButton,
} from "@astryxdesign/core";
import type { ReactNode } from "react";
import jigSymbolLightUrl from "../../assets/jig-symbol.svg";
import jigSymbolDarkUrl from "../../assets/jig-symbol-on-dark.svg";
import type { LayoutMode } from "./use-layout-mode";

export type Destination = "planner" | "history" | "settings";

export interface PlannerHeaderProps {
  readonly destination: Destination;
  readonly layoutMode: LayoutMode;
  readonly weekLabel: string;
  readonly statusControl: ReactNode;
  readonly onHome: () => void;
  readonly onPreviousWeek: () => void;
  readonly onToday: () => void;
  readonly onNextWeek: () => void;
  readonly onAdd: () => void;
  readonly onNavigate: (destination: Destination) => void;
}

function BrandHome({
  onHome,
}: Readonly<{ onHome: () => void }>): React.ReactElement {
  return (
    <Button
      label="Planner home"
      variant="ghost"
      className="jig-header-home"
      onClick={onHome}
    >
      <span className="jig-header-brand">
        <span className="jig-brand-logo-wrap" aria-hidden="true">
          <img
            className="jig-brand-logo jig-brand-logo-light"
            src={jigSymbolLightUrl}
            alt=""
          />
          <img
            className="jig-brand-logo jig-brand-logo-dark"
            src={jigSymbolDarkUrl}
            alt=""
          />
        </span>
        <strong>Jig</strong>
      </span>
    </Button>
  );
}

function TemporalNavigator({
  weekLabel,
  onPreviousWeek,
  onToday,
  onNextWeek,
}: Readonly<
  Pick<
    PlannerHeaderProps,
    "weekLabel" | "onPreviousWeek" | "onToday" | "onNextWeek"
  >
>): React.ReactElement {
  return (
    <div className="jig-header-temporal">
      <strong className="jig-header-week-range">{weekLabel}</strong>
      <div className="jig-header-week-controls">
        <IconButton
          label="Previous week"
          icon={<Icon icon="chevronLeft" color="inherit" />}
          variant="ghost"
          size="sm"
          onClick={onPreviousWeek}
        />
        <Button
          label="Today"
          variant="secondary"
          size="sm"
          onClick={onToday}
        />
        <IconButton
          label="Next week"
          icon={<Icon icon="chevronRight" color="inherit" />}
          variant="ghost"
          size="sm"
          onClick={onNextWeek}
        />
      </div>
    </div>
  );
}

function DestinationTitle({
  destination,
}: Readonly<{ destination: Exclude<Destination, "planner"> }>): React.ReactElement {
  return (
    <strong className="jig-header-destination-title">
      {destination === "history" ? "History" : "Settings"}
    </strong>
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
      {(["planner", "history", "settings"] as const).map((item) => (
        <Button
          key={item}
          label={item === "planner" ? "Planner" : item === "history" ? "History" : "Settings"}
          variant="ghost"
          aria-current={destination === item ? "page" : undefined}
          className={destination === item ? "jig-header-nav-active" : ""}
          onClick={() => onNavigate(item)}
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
          <DestinationTitle destination={destination} />
        )}
      </div>
      <div className="jig-header-right">
        {destination === "planner" ? (
          <Button label="Add task" variant="primary" onClick={onAdd} />
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
    statusControl,
    onHome,
    onPreviousWeek,
    onToday,
    onNextWeek,
    onAdd,
    onNavigate,
  } = props;

  return (
    <header className="jig-app-header jig-app-header-narrow">
      <div className="jig-header-mobile-band">
        <BrandHome onHome={onHome} />
        <div className="jig-header-mobile-actions">
          {destination === "planner" ? (
            <IconButton
              label="Add task"
              icon={<span aria-hidden="true">+</span>}
              variant="primary"
              size="sm"
              onClick={onAdd}
            />
          ) : null}
          {statusControl}
          <DropdownMenu
            presentation="popover"
            button={{
              label: "Open navigation menu",
              icon: <Icon icon="menu" color="inherit" />,
              isIconOnly: true,
              variant: "ghost",
              size: "sm",
            }}
            items={[
              {
                id: "history",
                label: "History",
                endContent:
                  destination === "history" ? (
                    <span aria-label="Current page">
                      <Icon icon="check" size="xsm" color="inherit" />
                    </span>
                  ) : undefined,
                onClick: () => onNavigate("history"),
              },
              {
                id: "settings",
                label: "Settings",
                endContent:
                  destination === "settings" ? (
                    <span aria-label="Current page">
                      <Icon icon="check" size="xsm" color="inherit" />
                    </span>
                  ) : undefined,
                onClick: () => onNavigate("settings"),
              },
            ]}
            placement="below"
            alignment="end"
          />
        </div>
      </div>
      {destination === "planner" ? (
        <TemporalNavigator
          weekLabel={weekLabel}
          onPreviousWeek={onPreviousWeek}
          onToday={onToday}
          onNextWeek={onNextWeek}
        />
      ) : (
        <DestinationTitle destination={destination} />
      )}
    </header>
  );
}

export function PlannerHeader(props: PlannerHeaderProps): React.ReactElement {
  return props.layoutMode === "desktop" ? (
    <DesktopHeader {...props} />
  ) : (
    <NarrowHeader {...props} />
  );
}
