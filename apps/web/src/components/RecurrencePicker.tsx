import type { Recurrence } from "../types";
import { RECURRENCE_KIND_LABEL } from "../types";

interface Props {
  value: Recurrence;
  onChange: (recurrence: Recurrence) => void;
}

const KINDS: Array<Recurrence["kind"]> = [
  "oneTime",
  "daily",
  "weekly",
  "semiMonthly",
  "monthly",
  "annually",
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function RecurrencePicker({ value, onChange }: Props) {
  function handleKindChange(kind: Recurrence["kind"]) {
    switch (kind) {
      case "oneTime":
        onChange({ kind: "oneTime" });
        break;
      case "daily":
        onChange({ kind: "daily" });
        break;
      case "weekly":
        onChange({
          kind: "weekly",
          weekday: value.kind === "weekly" ? value.weekday : 1,
        });
        break;
      case "semiMonthly":
        onChange({ kind: "semiMonthly" });
        break;
      case "monthly":
        onChange({
          kind: "monthly",
          day: value.kind === "monthly" ? value.day : 1,
        });
        break;
      case "annually":
        onChange({
          kind: "annually",
          month: value.kind === "annually" ? value.month : 1,
          day: value.kind === "annually" ? value.day : 1,
        });
        break;
    }
  }

  return (
    <div className="recurrence-picker">
      <select
        className="input"
        value={value.kind}
        onChange={(event) => handleKindChange(event.target.value as Recurrence["kind"])}
      >
        {KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {RECURRENCE_KIND_LABEL[kind]}
          </option>
        ))}
      </select>

      {value.kind === "weekly" && (
        <select
          className="input"
          value={value.weekday}
          onChange={(event) => onChange({ kind: "weekly", weekday: Number(event.target.value) })}
        >
          {WEEKDAYS.map((label, index) => (
            <option key={label} value={index}>
              {label}
            </option>
          ))}
        </select>
      )}

      {value.kind === "monthly" && (
        <label className="field field--inline">
          <span className="field__label">Day of month</span>
          <select
            className="input"
            value={value.day}
            onChange={(event) => onChange({ kind: "monthly", day: Number(event.target.value) })}
          >
            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </label>
      )}

      {value.kind === "annually" && (
        <div className="recurrence-picker__row">
          <select
            className="input"
            value={value.month}
            onChange={(event) =>
              onChange({ kind: "annually", month: Number(event.target.value), day: value.day })
            }
          >
            {MONTHS.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={value.day}
            onChange={(event) =>
              onChange({ kind: "annually", month: value.month, day: Number(event.target.value) })
            }
          >
            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
