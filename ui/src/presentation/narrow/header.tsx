import {
  BrandHome,
  DestinationHeading,
  TemporalNavigator,
  type PlannerHeaderProps,
} from "../../planner-header";

export function NarrowConfiguredHeader(
  props: PlannerHeaderProps,
): React.ReactElement {
  return (
    <header className="jig-app-header jig-app-header-narrow">
      <div className="jig-header-mobile-application-row">
        <div className="jig-header-mobile-identity">
          <BrandHome onHome={props.onHome} />
        </div>
        <div className="jig-header-mobile-title">
          <DestinationHeading destination={props.destination} compact />
        </div>
        <div className="jig-header-mobile-actions">
          {props.compactStatusControl}
        </div>
      </div>
      {props.destination === "planner" ? (
        <div className="jig-header-mobile-temporal-row">
          <TemporalNavigator
            weekLabel={props.weekLabel}
            canGoPrevious={props.canGoPrevious}
            compact
            onPreviousWeek={props.onPreviousWeek}
            onToday={props.onToday}
            onNextWeek={props.onNextWeek}
          />
        </div>
      ) : null}
    </header>
  );
}
