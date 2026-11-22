import { Button, IconButton } from "@astryxdesign/core";
import { DESTINATIONS } from "../../destinations";
import { JigIcon } from "../../jig-icons";
import {
  DestinationIcon,
  type PlannerHeaderProps,
} from "../../planner-header";

export interface NarrowBottomNavigationProps
  extends Pick<PlannerHeaderProps, "destination" | "onAdd" | "onNavigate"> {
  readonly showAdd: boolean;
}

export function NarrowBottomNavigation({
  destination,
  onAdd,
  onNavigate,
  showAdd,
}: NarrowBottomNavigationProps): React.ReactElement {
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
