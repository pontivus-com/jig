import { Button } from "@astryxdesign/core";
import { weekDates } from "../../src/core/planning";
import { formatCivilDate, todayCivilDate } from "./dates";

export function DateStrip({
  selectedDate,
  onSelectDate,
}: Readonly<{
  selectedDate: string;
  onSelectDate: (date: string) => void;
}>): React.ReactElement {
  const dates = weekDates(selectedDate);
  const today = todayCivilDate();

  return (
    <nav className="jig-week-strip" aria-label="Week dates">
      {dates.map((date) => {
        const isSelected = date === selectedDate;
        return (
          <Button
            key={date}
            label={formatCivilDate(date, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            variant={isSelected ? "primary" : "secondary"}
            size="sm"
            className={[
              "jig-week-strip-date",
              isSelected ? "jig-date-selected" : "",
              date === today ? "jig-date-today" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-current={isSelected ? "date" : undefined}
            onClick={() => onSelectDate(date)}
          >
            <span className="jig-week-strip-date-content">
              <span>{formatCivilDate(date, { weekday: "short" })}</span>
              <strong>{formatCivilDate(date, { day: "numeric" })}</strong>
            </span>
          </Button>
        );
      })}
    </nav>
  );
}
