/**
 * CalendarHeatmap — GitHub-style year calendar heatmap.
 *
 * Mirrors desktop CalendarHeatmap.tsx + CalendarGrid.tsx, but implemented
 * with NativeWind View cells (no SVG available in React Native).
 *
 * Data: computeCalendarHeatmap(logs) from @siltflow/shared-lib
 */

import { useMemo, useState, useEffect } from "react";
import { View, Text, ScrollView } from "@/tw";
import { Appearance } from "react-native";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { useStatsStore } from "@/stores/stats.store";
import { computeCalendarHeatmap } from "@siltflow/shared-lib";

// ── Constants ───────────────────────────────────────────────────────

const CELL_SIZE = 12;
const CELL_GAP = 3;
const CELL_STRIDE = CELL_SIZE + CELL_GAP;

// Desktop heatmap palette — levels 1-4 are fixed green, level 0
// switches between light/dark (mirrors desktop index.css).
const HEATMAP_LIGHT = ["#ebedf0", "#9be9a8", "#54d17a", "#2da44e", "#116329"];
const HEATMAP_DARK = ["#161b22", "#9be9a8", "#54d17a", "#2da44e", "#116329"];

const WEEKDAY_LABELS = ["", "MON", "", "WED", "", "FRI", ""];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getLevel(value: number): number {
  if (value <= 0) return 0;
  if (value <= 2) return 1;
  if (value <= 5) return 2;
  if (value <= 10) return 3;
  return 4;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startOfWeek(d: Date, weekStartsOn: 0 | 1): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Find last in-range cell in a column (Hermes doesn't have Array.findLast) */
function findLastInRange(col: { date: Date; value: number; level: number }[], start: Date): { date: Date; value: number; level: number } | undefined {
  for (let i = col.length - 1; i >= 0; i--) {
    if (col[i].date >= start) return col[i];
  }
  return undefined;
}

// ── Component ───────────────────────────────────────────────────────

export function CalendarHeatmap() {
  const reviewLogs = useStatsStore((s) => s.reviewLogs);

  const [scheme, setScheme] = useState(
    () => Appearance.getColorScheme() ?? "light",
  );
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(colorScheme ?? "light");
    });
    return () => sub.remove();
  }, []);

  const palette = scheme === "dark" ? HEATMAP_DARK : HEATMAP_LIGHT;

  const heatmap = useMemo(
    () => computeCalendarHeatmap(reviewLogs),
    [reviewLogs],
  );

  const { endDate, rangeDays } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    return { endDate: end, rangeDays: days };
  }, []);

  const isEmpty = heatmap.size === 0;

  // Build grid data
  const { columns, monthLabels } = useMemo(() => {
    const weekStartsOn: 0 | 1 = 0;
    const end = startOfDay(endDate);
    const start = addDays(end, -(rangeDays - 1));
    const firstWeek = startOfWeek(start, weekStartsOn);
    const totalDays = Math.ceil((end.getTime() - firstWeek.getTime()) / 86_400_000) + 1;
    const weeks = Math.ceil(totalDays / 7);

    // Build cells
    const cells: { date: Date; value: number; level: number }[] = [];
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const date = addDays(firstWeek, w * 7 + d);
        const inRange = date >= start && date <= end;
        const key = date.toISOString().slice(0, 10);
        const value = inRange ? (heatmap.get(key) ?? 0) : 0;
        cells.push({ date, value, level: getLevel(value) });
      }
    }

    // Group into columns (weeks)
    const cols = [];
    for (let i = 0; i < weeks; i++) {
      cols.push(cells.slice(i * 7, i * 7 + 7));
    }

    // Month labels
    const months: { colIndex: number; text: string }[] = [];
    let lastLabeledWeek = -999;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const lastCell = findLastInRange(col, start) ?? col[6];
      const prevCol = i > 0 ? cols[i - 1] : null;
      const prevLast = prevCol ? findLastInRange(prevCol, start) ?? prevCol[6] : undefined;

      const monthChanged = !prevLast || !sameMonth(lastCell.date, prevLast.date);
      if (monthChanged && i - lastLabeledWeek >= 3) {
        months.push({ colIndex: i, text: MONTH_NAMES[lastCell.date.getMonth()] });
        lastLabeledWeek = i;
      }
    }

    return { columns: cols, monthLabels: months };
  }, [heatmap, endDate, rangeDays]);

  // ── Total width ──────────────────────────────────────────────────

  const totalWidth = columns.length * CELL_STRIDE - CELL_GAP;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <View className="py-8 items-center">
            <Text className="text-xs text-ctp-subtext0">No review activity yet</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Month labels row */}
              <View className="flex-row mb-1" style={{ paddingLeft: 32 }}>
                <View style={{ width: totalWidth, height: 14 }}>
                  {monthLabels.map((m) => (
                    <Text
                      key={m.colIndex}
                      className="absolute text-[9px] text-ctp-overlay0"
                      style={{ left: m.colIndex * CELL_STRIDE, top: 0 }}
                    >
                      {m.text}
                    </Text>
                  ))}
                </View>
              </View>

              {/* Grid + weekday labels */}
              <View className="flex-row">
                {/* Weekday labels */}
                <View className="mr-1.5" style={{ gap: CELL_GAP, width: 28 }}>
                  {WEEKDAY_LABELS.map((label, i) => (
                    <View
                      key={i}
                      className="justify-center items-end"
                      style={{ height: CELL_SIZE }}
                    >
                      <Text className="text-[8px] text-ctp-overlay0">{label}</Text>
                    </View>
                  ))}
                </View>

                {/* Heatmap grid */}
                <View className="flex-row" style={{ gap: CELL_GAP }}>
                  {columns.map((col, colIdx) => (
                    <View key={colIdx} style={{ gap: CELL_GAP }}>
                      {col.map((cell, rowIdx) => (
                        <View
                          key={`${colIdx}-${rowIdx}`}
                          className="rounded-sm"
                          style={{
                            width: CELL_SIZE,
                            height: CELL_SIZE,
                            backgroundColor: palette[cell.level] ?? palette[0],
                          }}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              </View>

              {/* Legend */}
              <View className="flex-row items-center justify-end gap-1 mt-2">
                <Text className="text-[9px] text-ctp-overlay0">Less</Text>
                {palette.map((color, i) => (
                  <View
                    key={i}
                    className="rounded-sm"
                    style={{ width: CELL_SIZE, height: CELL_SIZE, backgroundColor: color }}
                  />
                ))}
                <Text className="text-[9px] text-ctp-overlay0">More</Text>
              </View>
            </View>
          </ScrollView>
        )}
      </CardContent>
    </Card>
  );
}
