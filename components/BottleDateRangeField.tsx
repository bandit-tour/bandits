import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIso(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** English dates for the English Bottle UI, even when the browser locale is Hebrew. */
export function humanDate(value: string): string {
  const d = parseIso(value);
  if (!d) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function todayIso(): string {
  const n = new Date();
  return isoFromDate(new Date(n.getFullYear(), n.getMonth(), n.getDate()));
}

function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return isoFromDate(d);
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function nightsBetween(start: string, end: string): number | null {
  const a = parseIso(start);
  const b = parseIso(end);
  if (!a || !b) return null;
  const nights = Math.round((b.getTime() - a.getTime()) / 86400000);
  return nights >= 1 ? nights : null;
}

type Props = {
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
};

export function BottleDateRangeField({ checkIn, checkOut, onChange }: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 860;
  const [open, setOpen] = useState(false);
  const [focusIso, setFocusIso] = useState(todayIso());
  const initial = parseIso(checkIn) ?? new Date();
  const [cursor, setCursor] = useState({ year: initial.getFullYear(), month: initial.getMonth() });

  const nights = nightsBetween(checkIn, checkOut);
  const today = todayIso();

  const label = useMemo(() => {
    if (checkIn && checkOut) return `${humanDate(checkIn)} – ${humanDate(checkOut)}`;
    if (checkIn) return `${humanDate(checkIn)} · choose departure`;
    return "Select your dates";
  }, [checkIn, checkOut]);

  const choose = useCallback(
    (day: string) => {
      if (day < today) return;
      if (!checkIn || checkOut || day <= checkIn) {
        onChange(day, "");
        setFocusIso(day);
        return;
      }
      onChange(checkIn, day);
      setFocusIso(day);
    },
    [checkIn, checkOut, onChange, today],
  );

  const openCalendar = () => {
    const anchor = parseIso(checkIn) ?? new Date();
    setCursor({ year: anchor.getFullYear(), month: anchor.getMonth() });
    setFocusIso(checkIn || today);
    setOpen(true);
  };

  useEffect(() => {
    if (!open || Platform.OS !== "web") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -7 : 7;
        setFocusIso((cur) => {
          const next = addDays(cur, step);
          const d = parseIso(next);
          if (d) setCursor({ year: d.getFullYear(), month: d.getMonth() });
          return next;
        });
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        choose(focusIso);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, focusIso, choose]);

  const shiftMonth = (delta: number) => {
    setCursor((cur) => {
      const d = new Date(cur.year, cur.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const months = wide ? [0, 1] : [0];
  const calendar = open ? (
    <View style={[styles.backdrop, styles.backdropFixed]}>
          <Pressable style={styles.backdropHit} onPress={() => setOpen(false)} accessibilityLabel="Close calendar" />
          <View
            testID="bottle-calendar"
            style={[styles.sheet, wide && styles.sheetWide]}
            accessibilityViewIsModal
          >
            <Text style={styles.sheetTitle} testID="bottle-calendar-status">
              {checkIn && checkOut && nights
                ? `${nights === 1 ? "1 night" : `${nights} nights`}`
                : checkIn
                  ? "Select departure"
                  : "Select arrival"}
            </Text>
            <View style={styles.monthRow}>
              {months.map((offset) => {
                const shown = new Date(cursor.year, cursor.month + offset, 1);
                const year = shown.getFullYear();
                const month = shown.getMonth();
                const firstWeekday = (shown.getDay() + 6) % 7;
                const count = new Date(year, month + 1, 0).getDate();
                const cells: Array<string | null> = [
                  ...Array.from({ length: firstWeekday }, () => null),
                  ...Array.from({ length: count }, (_, i) => isoFromDate(new Date(year, month, i + 1))),
                ];
                return (
                  <View key={`${year}-${month}`} style={styles.month}>
                    <View style={styles.monthHead}>
                      {offset === 0 ? (
                        <Pressable
                          testID="bottle-cal-prev"
                          onPress={() => shiftMonth(-1)}
                          accessibilityRole="button"
                          accessibilityLabel="Previous month"
                          style={styles.navBtn}
                        >
                          <Text style={styles.navText}>‹</Text>
                        </Pressable>
                      ) : (
                        <View style={styles.navBtn} />
                      )}
                      <Text style={styles.monthTitle}>{monthLabel(year, month)}</Text>
                      {offset === months.length - 1 ? (
                        <Pressable
                          testID="bottle-cal-next"
                          onPress={() => shiftMonth(1)}
                          accessibilityRole="button"
                          accessibilityLabel="Next month"
                          style={styles.navBtn}
                        >
                          <Text style={styles.navText}>›</Text>
                        </Pressable>
                      ) : (
                        <View style={styles.navBtn} />
                      )}
                    </View>
                    <View style={styles.weekRow}>
                      {WEEKDAYS.map((name) => (
                        <Text key={name} style={styles.weekday}>
                          {name}
                        </Text>
                      ))}
                    </View>
                    <View style={styles.grid}>
                      {cells.map((day, index) => {
                        if (!day) return <View key={`pad-${year}-${month}-${index}`} style={styles.day} />;
                        const disabled = day < today;
                        const start = day === checkIn;
                        const end = day === checkOut;
                        const inRange = Boolean(checkIn && checkOut && day > checkIn && day < checkOut);
                        const focused = day === focusIso;
                        return (
                          <Pressable
                            key={day}
                            testID={inRange ? `bottle-range-${day}` : `bottle-day-${day}`}
                            disabled={disabled}
                            onPress={() => choose(day)}
                            accessibilityRole="button"
                            accessibilityState={{ disabled, selected: start || end }}
                            accessibilityLabel={humanDate(day)}
                            style={[
                              styles.day,
                              inRange && styles.dayInRange,
                              (start || end) && styles.dayEnd,
                              focused && open && styles.dayFocus,
                              disabled && styles.dayDisabled,
                            ]}
                          >
                            <Text style={[styles.dayText, (start || end) && styles.dayTextOn, disabled && styles.dayTextDisabled]}>
                              {Number(day.slice(8))}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
            <Pressable
              testID="bottle-cal-close"
              style={styles.done}
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close calendar"
            >
              <Text style={styles.doneText}>Close</Text>
            </Pressable>
          </View>
        </View>
  ) : null;
  const overlay =
    calendar && typeof document !== "undefined" ? createPortal(calendar, document.body) : calendar;

  return (
    <View>
      <Pressable
        testID="bottle-when"
        style={styles.trigger}
        onPress={openCalendar}
        accessibilityRole="button"
        accessibilityLabel="When? Open calendar"
        accessibilityHint="Choose a check-in date, then a later check-out date"
      >
        <Text style={[styles.triggerText, !checkIn && styles.placeholder]} testID="bottle-date-label">
          {label}
        </Text>
      </Pressable>
      {nights ? (
        <Text style={styles.nights} testID="bottle-nights">
          {nights === 1 ? "1 night" : `${nights} nights`}
          {nights < 2 ? " · two sleeps need at least two nights" : ""}
        </Text>
      ) : checkIn ? (
        <Text style={styles.nights}>Choose a departure after arrival</Text>
      ) : null}
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E0D8CC",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    minHeight: 48,
    justifyContent: "center",
  },
  triggerText: { fontSize: 16, color: "#1A1510", fontWeight: "700" },
  placeholder: { color: "#8A8178", fontWeight: "600" },
  nights: { marginTop: 8, color: "#3A342C", fontWeight: "700" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(26,21,16,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  backdropFixed: {
    position: "fixed" as "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100000,
  },
  backdropHit: { ...StyleSheet.absoluteFillObject },
  sheet: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFCF8",
    borderRadius: 18,
    padding: 16,
    zIndex: 2,
    shadowColor: "#1A1510",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  sheetWide: { maxWidth: 720 },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: "#1A1510", marginBottom: 8 },
  monthRow: { flexDirection: "row", gap: 16 },
  month: { flex: 1 },
  monthHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthTitle: { fontSize: 15, fontWeight: "800", color: "#1A1510" },
  navBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  navText: { fontSize: 24, color: "#1A1510", fontWeight: "700" },
  weekRow: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: "#8A8178", paddingVertical: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  day: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  dayInRange: { backgroundColor: "#F3E6D4", borderRadius: 0 },
  dayEnd: { backgroundColor: "#1A1510", borderRadius: 10 },
  dayFocus: { borderWidth: 2, borderColor: "#C4A574" },
  dayDisabled: { opacity: 0.35 },
  dayText: { fontSize: 14, fontWeight: "700", color: "#1A1510" },
  dayTextOn: { color: "#FFFFFF" },
  dayTextDisabled: { color: "#8A8178" },
  done: { alignSelf: "flex-end", marginTop: 8, paddingVertical: 8, paddingHorizontal: 12 },
  doneText: { fontWeight: "800", color: "#1A1510" },
});
