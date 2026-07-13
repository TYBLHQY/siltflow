import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Search, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStatsStore } from "@/stores/stats.store";
import type { ReviewLogEntry } from "@/stores/review-log.store";

interface ParsedReviewLog {
  timestamp: number;
  date: string;
  grade: number;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  state: number;
}

const GRADE_COLORS: Record<number, string> = {
  1: "var(--red)",
  2: "var(--peach)",
  3: "var(--green)",
  4: "var(--blue)",
};

const GRADE_LABELS: Record<number, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};

export function MemoryStateExplorer() {
  const rawCards = useStatsStore((s) => s.rawCards);
  const dataVersion = useStatsStore((s) => s.dataVersion);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ParsedReviewLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Build annotation list from raw card data
  const annotations = useMemo(() => {
    const list: { id: string; documentId: string; card: any }[] = [];
    for (const row of rawCards) {
      try {
        const card = JSON.parse(row.data);
        list.push({
          id: row.annotationId,
          documentId: row.documentId,
          card,
        });
      } catch {
        // skip
      }
    }
    return list.sort((a, b) => (b.card.stability ?? 0) - (a.card.stability ?? 0));
  }, [rawCards, dataVersion]);

  const filtered = useMemo(
    () =>
      annotations.filter((a) =>
        a.id.toLowerCase().includes(search.toLowerCase()),
      ),
    [annotations, search],
  );

  const selectedAnnotation = useMemo(
    () => annotations.find((a) => a.id === selectedId),
    [annotations, selectedId],
  );

  // Load review logs when selection changes
  useEffect(() => {
    if (!selectedAnnotation) {
      setLogs([]);
      return;
    }
    let cancelled = false;
    setLogsLoading(true);
    window.siltflow.reviewLogs
      .listByAnnotation(selectedAnnotation.id, selectedAnnotation.documentId)
      .then((entries: ReviewLogEntry[]) => {
        if (cancelled) return;
        const parsed = entries
          .map((e) => {
            try {
              const data = JSON.parse(e.data);
              const log = data.log;
              return {
                timestamp: new Date(log.review || e.createdAt).getTime(),
                date: new Date(log.review || e.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                }),
                grade: data.grade,
                stability: log.stability,
                difficulty: log.difficulty,
                scheduledDays: log.scheduled_days,
                state: log.state,
              } as ParsedReviewLog;
            } catch {
              return null;
            }
          })
          .filter((p): p is ParsedReviewLog => p !== null)
          .sort((a, b) => a.timestamp - b.timestamp);
        setLogs(parsed);
        setLogsLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLogsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAnnotation]);

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Card list */}
      <div className="lg:w-72 shrink-0">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded-md border bg-background pl-7 pr-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50"
            placeholder="Search cards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="max-h-80 space-y-0.5 overflow-y-auto rounded-md border">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-xs text-center text-muted-foreground">
              {search ? "No matching cards" : "No cards reviewed yet"}
            </p>
          ) : (
            filtered.map((a) => (
              <button
                key={a.id}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                  selectedId === a.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50 text-foreground",
                )}
                onClick={() => setSelectedId(a.id)}
              >
                <ChevronRight
                  className={cn(
                    "h-3 w-3 shrink-0 transition-transform",
                    selectedId === a.id && "rotate-90",
                  )}
                />
                <span className="flex-1 truncate" title={a.id}>
                  {a.id.slice(0, 16)}...
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  S={typeof a.card.stability === "number" ? a.card.stability.toFixed(1) : "?"}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 min-w-0">
        {logsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : selectedAnnotation ? (
          <div className="space-y-4">
            {/* Card info */}
            <div className="rounded-lg border border-border/80 bg-white dark:bg-mantle shadow-sm px-4 py-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium truncate">
                  Annotation: {selectedAnnotation.id.slice(0, 12)}...
                </span>
                <span className="text-muted-foreground shrink-0">
                  Document: {selectedAnnotation.documentId.slice(0, 12)}...
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                <span>Stability: <strong>{selectedAnnotation.card.stability?.toFixed(1)}d</strong></span>
                <span>Difficulty: <strong>{selectedAnnotation.card.difficulty?.toFixed(2)}</strong></span>
                <span>Reps: <strong>{selectedAnnotation.card.reps ?? 0}</strong></span>
                <span>Lapses: <strong>{selectedAnnotation.card.lapses ?? 0}</strong></span>
              </div>
            </div>

            {/* Evolution chart */}
            {logs.length >= 2 ? (
              <div className="rounded-lg border border-border/80 bg-white dark:bg-mantle shadow-sm p-4">
                <h4 className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Stability & Difficulty Over Time
                </h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={logs} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9 }}
                      stroke="var(--text)"
                    />
                    <YAxis
                      yAxisId="stability"
                      tick={{ fontSize: 9 }}
                      stroke="var(--text)"
                      label={{
                        value: "Stability",
                        angle: -90,
                        position: "insideLeft",
                        fontSize: 9,
                        fill: "var(--text)",
                      }}
                    />
                    <YAxis
                      yAxisId="difficulty"
                      orientation="right"
                      domain={[0, 1]}
                      tick={{ fontSize: 9 }}
                      stroke="var(--text)"
                      label={{
                        value: "Difficulty",
                        angle: 90,
                        position: "insideRight",
                        fontSize: 9,
                        fill: "var(--text)",
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 11,
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--tooltip-bg)",
                      }}
                    />
                    <Legend verticalAlign="top"
                      wrapperStyle={{ fontSize: 10 }}
                      content={({ payload }) => {
                        const colors: Record<string, string> = {
                          "Stability": "var(--mauve)",
                          "Difficulty": "var(--pink)",
                        };
                        return (
                          <div className="flex justify-center gap-4 text-[10px]">
                            {payload?.map((entry) => (
                              <div key={entry.value} className="flex items-center gap-1">
                                <span
                                  className="inline-block h-0.5 w-3 rounded-full"
                                  style={{ backgroundColor: colors[entry.value as string] ?? "var(--text)" }}
                                />
                                <span className="text-foreground">{entry.value}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Line
                      yAxisId="stability"
                      type="monotone"
                      dataKey="stability"
                      name="Stability"
                      stroke="var(--mauve)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                    <Line
                      yAxisId="difficulty"
                      type="monotone"
                      dataKey="difficulty"
                      name="Difficulty"
                      stroke="var(--pink)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="rounded-lg border border-border/80 bg-white dark:bg-mantle shadow-sm px-4 py-6 text-center text-[10px] text-muted-foreground">
                {logs.length === 1
                  ? "Only one review recorded — need at least 2 to show evolution"
                  : "No review history for this card yet"}
              </div>
            )}

            {/* Review log table */}
            {logs.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Grade</th>
                      <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Stability</th>
                      <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Difficulty</th>
                      <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Interval</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="px-3 py-1.5 text-foreground">{log.date}</td>
                        <td className="px-3 py-1.5">
                          <span
                            className="inline-block rounded px-1.5 py-0.5 text-[9px] font-medium text-white"
                            style={{ backgroundColor: GRADE_COLORS[log.grade] ?? "var(--lavender)" }}
                          >
                            {GRADE_LABELS[log.grade] ?? log.grade}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right text-foreground">
                          {log.stability.toFixed(1)}d
                        </td>
                        <td className="px-3 py-1.5 text-right text-foreground">
                          {log.difficulty.toFixed(2)}
                        </td>
                        <td className="px-3 py-1.5 text-right text-foreground">
                          {log.scheduledDays}d
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
            Select a card to view its memory timeline
          </div>
        )}
      </div>
    </div>
  );
}
