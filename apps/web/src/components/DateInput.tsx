import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import type { DateFormat } from "../types";
import {
  formatDate,
  parseDateInput,
  parseDateString,
  toDateInputValue,
} from "../lib/format";

interface Props {
  /** ISO yyyy-mm-dd string (matches how we store dates everywhere else). */
  value: string;
  onChange: (value: string) => void;
  format: DateFormat;
  /** Minimum selectable day, ISO yyyy-mm-dd. */
  min?: string;
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
}

export function DateInput({ value, onChange, format, min, placeholder, id, autoFocus }: Props) {
  const [text, setText] = useState(() => (value ? formatDate(parseDateInput(value), format) : ""));
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Reflect external value / format changes back into the text input.
  useEffect(() => {
    setText(value ? formatDate(parseDateInput(value), format) : "");
    setInvalid(false);
  }, [value, format]);

  // Close popup on outside click.
  useEffect(() => {
    if (!open) return;
    function handler(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function commitText() {
    if (!text.trim()) {
      // Allow clearing only if no min constraint blocks it; we don't support
      // null values here, so treat empty as "reset to prior value".
      setText(value ? formatDate(parseDateInput(value), format) : "");
      setInvalid(false);
      return;
    }
    const parsed = parseDateString(text, format);
    if (!parsed) {
      setInvalid(true);
      return;
    }
    if (min) {
      const minDate = parseDateInput(min);
      if (parsed.getTime() < minDate.getTime()) {
        setInvalid(true);
        return;
      }
    }
    setInvalid(false);
    const iso = toDateInputValue(parsed);
    setText(formatDate(parsed, format));
    if (iso !== value) onChange(iso);
  }

  function handleSelectFromCalendar(iso: string) {
    setInvalid(false);
    setOpen(false);
    if (iso !== value) onChange(iso);
  }

  return (
    <div className={`date-input ${invalid ? "date-input--invalid" : ""}`} ref={wrapperRef}>
      <input
        id={id}
        type="text"
        className="input date-input__field"
        inputMode="numeric"
        value={text}
        placeholder={placeholder ?? format.toLowerCase()}
        onChange={(event) => {
          setText(event.target.value);
          setInvalid(false);
        }}
        onBlur={commitText}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitText();
          } else if (event.key === "Escape" && open) {
            setOpen(false);
          }
        }}
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
      />
      <button
        type="button"
        className="date-input__trigger"
        onClick={() => setOpen((previous) => !previous)}
        aria-label="Open calendar"
        aria-expanded={open}
      >
        <CalendarIcon size={16} aria-hidden />
      </button>
      {open && (
        <CalendarPopup
          value={value}
          min={min}
          onSelect={handleSelectFromCalendar}
        />
      )}
    </div>
  );
}

interface CalendarPopupProps {
  value: string;
  min?: string;
  onSelect: (iso: string) => void;
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function CalendarPopup({ value, min, onSelect }: CalendarPopupProps) {
  const initial = value ? parseDateInput(value) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const minTs = min ? parseDateInput(min).getTime() : null;
  const selectedTs = value ? parseDateInput(value).getTime() : null;
  const todayTs = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }, []);

  const cells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startDay = firstOfMonth.getDay();
    const out: Array<{ date: Date; inMonth: boolean }> = [];
    for (let i = 0; i < startDay; i++) {
      out.push({ date: new Date(viewYear, viewMonth, i - startDay + 1), inMonth: false });
    }
    const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      out.push({ date: new Date(viewYear, viewMonth, d), inMonth: true });
    }
    while (out.length < 42) {
      const last = out[out.length - 1]!.date;
      const next = new Date(last);
      next.setDate(next.getDate() + 1);
      out.push({ date: next, inMonth: false });
    }
    return out;
  }, [viewYear, viewMonth]);

  function navigateMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="calendar-popup" role="dialog" aria-label="Choose a date">
      <div className="calendar-popup__header">
        <button
          type="button"
          className="icon-button"
          onClick={() => navigateMonth(-1)}
          aria-label="Previous month"
        >
          <ChevronLeft size={16} aria-hidden />
        </button>
        <span className="calendar-popup__label">{monthLabel}</span>
        <button
          type="button"
          className="icon-button"
          onClick={() => navigateMonth(1)}
          aria-label="Next month"
        >
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
      <div className="calendar-popup__weekdays">
        {WEEKDAY_LABELS.map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>
      <div className="calendar-popup__grid">
        {cells.map((cell, index) => {
          const cellTs = cell.date.getTime();
          const disabled = minTs !== null && cellTs < minTs;
          const selected = selectedTs === cellTs;
          const isToday = todayTs === cellTs;
          const className = [
            "calendar-popup__day",
            cell.inMonth ? "" : "calendar-popup__day--muted",
            selected ? "calendar-popup__day--selected" : "",
            isToday ? "calendar-popup__day--today" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={index}
              type="button"
              className={className}
              onClick={() => onSelect(toDateInputValue(cell.date))}
              disabled={disabled}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
