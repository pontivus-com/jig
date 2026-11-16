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
      {dates.map((date) => (
        <button
          key={date}
          type="button"
          className={[
            "jig-week-strip-date",
            date === selectedDate ? "jig-date-selected" : "",
            date === today ? "jig-date-today" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-current={date === selectedDate ? "date" : undefined}
          onClick={() => onSelectDate(date)}
        >
          <span>{formatCivilDate(date, { weekday: "short" })}</span>
          <strong>{formatCivilDate(date, { day: "numeric" })}</strong>
        </button>
      ))}
    </nav>
  );
}
