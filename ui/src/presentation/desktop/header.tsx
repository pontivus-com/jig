import { Button } from "@astryxdesign/core";
import {
  BrandHome,
  DestinationHeading,
  DestinationNav,
  TemporalNavigator,
  type PlannerHeaderProps,
} from "../../planner-header";
import { JigIcon } from "../../jig-icons";

export function DesktopConfiguredHeader(
  props: PlannerHeaderProps,
): React.ReactElement {
  return (
    <header className="jig-app-header jig-app-header-desktop">
      <div className="jig-header-left">
        <BrandHome onHome={props.onHome} />
      </div>
      <div className="jig-header-center">
        {props.destination === "planner" ? (
          <TemporalNavigator
            weekLabel={props.weekLabel}
            canGoPrevious={props.canGoPrevious}
            onPreviousWeek={props.onPreviousWeek}
            onToday={props.onToday}
            onNextWeek={props.onNextWeek}
          />
        ) : (
          <DestinationHeading destination={props.destination} />
        )}
      </div>
      <div className="jig-header-right">
        {props.destination === "planner" ? (
          <Button
            label="Add task"
            icon={<JigIcon name="add" color="inherit" />}
            variant="primary"
            size="sm"
            onClick={props.onAdd}
          />
        ) : null}
        <DestinationNav
          destination={props.destination}
          onNavigate={props.onNavigate}
        />
        {props.statusControl}
      </div>
    </header>
  );
}
