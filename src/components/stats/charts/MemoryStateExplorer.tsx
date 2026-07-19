import { useState, useEffect, useMemo, useDeferredValue } from "react";
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
import { Search, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStatsStore } from "@/stores/stats.store";

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
  1: "var(--catppuccin-color-red)",
  2: "var(--catppuccin-color-peach)",
  3: "var(--catppuccin-color-green)",
  4: "var(--catppuccin-color-blue)",
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
  const deferredSearch = useDeferredValue(search);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ParsedReviewLog[]>([]);
  const [annotationsMap, setAnnotationsMap] = useState<Map<string, string>>(new Map());

  // Load all annotations for text lookup
  useEffect(() => {
    window.siltflow.annotations.listAll().then((rows) => {
      const map = new Map<string, string>();
      // Only index annotation-kind rows; highlights have no FSRS cards to display
      for (const row of rows) {
        if (row.text && row.kind !== "highlight") map.set(row.id, row.text);
      }
      setAnnotationsMap(map);
    });
  }, []);

  // Build annotation list from raw card data
  const annotations = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: { id: string; documentId: string; text: string; card: any }[] = [];
    for (const row of rawCards) {
      try {
        const card = JSON.parse(row.data);
        const text = annotationsMap.get(row.annotationId) ?? row.annotationId;
        list.push({
          id: row.annotationId,
          documentId: row.documentId,
          text,
          card,
        });
      } catch {
        // skip
      }
    }
    return list.sort((a, b) => (b.card.stability ?? 0) - (a.card.stability ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawCards, dataVersion, annotationsMap]);

  // Auto-select first annotation when data loads
  useEffect(() => {
    if (!selectedId && annotations.length > 0) {
      setSelectedId(annotations[0].id);
    }
  }, [annotations, selectedId]);

  const filtered = useMemo(
    () =>
      annotations.filter((a) =>
        a.text.toLowerCase().includes(deferredSearch.toLowerCase()),
      ),
    [annotations, deferredSearch],
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
    window.siltflow.reviewLogs
      .listByAnnotation(selectedAnnotation.id, selectedAnnotation.documentId)
      .then((entries) => {
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
      })
      .catch(() => {
        // no-op
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAnnotation]);

  return (
    <div className="flex flex-col gap-4 lg:flex-row h-full">
      {/* Card list */}
      <div className="lg:w-72 shrink-0 flex flex-col">
        <div className="relative mb-2 shrink-0">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ctp-overlay0" />
          <input
            className="w-full rounded-md border bg-ctp-base pl-7 pr-2 py-1.5 text-xs outline-none placeholder:text-ctp-overlay0/50"
            placeholder="Search cards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full rounded-md border">
            <div className="space-y-0.5">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-xs text-center text-ctp-overlay0">
                  {search ? "No matching cards" : "No cards reviewed yet"}
                </p>
              ) : (
                filtered.map((a) => (
                  <button
                    key={a.id}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                      selectedId === a.id
                        ? "bg-ctp-surface0 text-ctp-text"
                        : "hover:bg-ctp-surface0/50 text-ctp-text",
                    )}
                    onClick={() => setSelectedId(a.id)}
                  >
                    <ChevronRight
                      className={cn(
                        "h-3 w-3 shrink-0 transition-transform",
                        selectedId === a.id && "rotate-90",
                      )}
                    />
                    <span className="flex-1 truncate" title={a.text}>
                      {a.text}
                    </span>
                    <span className="shrink-0 text-xs text-ctp-overlay0">
                      S={typeof a.card.stability === "number" ? a.card.stability.toFixed(1) : "?"}
                    </span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 min-w-0 flex flex-col">
        {selectedAnnotation ? (
          <>
            {/* Card info — fixed */}
            <div className="rounded-lg border border-ctp-overlay0/80 bg-card shadow-sm px-4 py-3 shrink-0">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium truncate">
                  {selectedAnnotation.text}
                </span>
                <span className="text-ctp-overlay0 shrink-0">
                  Document: {selectedAnnotation.documentId.slice(0, 12)}...
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-ctp-overlay0">
                <span>Stability: <strong>{selectedAnnotation.card.stability?.toFixed(1)}d</strong></span>
                <span>Difficulty: <strong>{selectedAnnotation.card.difficulty?.toFixed(2)}</strong></span>
                <span>Reps: <strong>{selectedAnnotation.card.reps ?? 0}</strong></span>
                <span>Lapses: <strong>{selectedAnnotation.card.lapses ?? 0}</strong></span>
              </div>
            </div>

            {/* Chart card — fixed */}
            {logs.length >= 2 ? (
              <div className="rounded-lg border border-ctp-overlay0/80 bg-card shadow-sm p-4 mt-4 shrink-0">
                <h4 className="mb-2 text-xs font-semibold text-ctp-overlay0 uppercase tracking-wider">
                  Stability & Difficulty Over Time
                </h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={logs} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-ctp-overlay0/50" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9 }}
                      stroke="var(--catppuccin-color-text)"
                    />
                    <YAxis
                      yAxisId="stability"
                      tick={{ fontSize: 9 }}
                      stroke="var(--catppuccin-color-text)"
                      label={{
                        value: "Stability",
                        angle: -90,
                        position: "insideLeft",
                        fontSize: 9,
                        fill: "var(--catppuccin-color-text)",
                      }}
                    />
                    <YAxis
                      yAxisId="difficulty"
                      orientation="right"
                      domain={[0, 1]}
                      tick={{ fontSize: 9 }}
                      stroke="var(--catppuccin-color-text)"
                      label={{
                        value: "Difficulty",
                        angle: 90,
                        position: "insideRight",
                        fontSize: 9,
                        fill: "var(--catppuccin-color-text)",
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 11,
                        borderRadius: 6,
                        border: "1px solid var(--catppuccin-color-overlay0)",
                        background: "var(--tooltip-bg)",
                      }}
                    />
                    <Legend verticalAlign="top"
                      wrapperStyle={{ fontSize: 10 }}
                      content={({ payload }) => {
                        const colors: Record<string, string> = {
                          "Stability": "var(--catppuccin-color-mauve)",
                          "Difficulty": "var(--catppuccin-color-pink)",
                        };
                        return (
                          <div className="flex justify-center gap-4 text-xs">
                            {payload?.map((entry) => (
                              <div key={entry.value} className="flex items-center gap-1">
                                <span
                                  className="inline-block h-0.5 w-3 rounded-full"
                                  style={{ backgroundColor: colors[entry.value as string] ?? "var(--catppuccin-color-text)" }}
                                />
                                <span className="text-ctp-text">{entry.value}</span>
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
                      stroke="var(--catppuccin-color-mauve)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                    <Line
                      yAxisId="difficulty"
                      type="monotone"
                      dataKey="difficulty"
                      name="Difficulty"
                      stroke="var(--catppuccin-color-pink)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="rounded-lg border border-ctp-overlay0/80 bg-card shadow-sm mt-4 px-4 py-6 text-center text-xs text-ctp-overlay0 shrink-0">
                {logs.length === 1
                  ? "Only one review recorded — need at least 2 to show evolution"
                  : "No review history for this card yet"}
              </div>
            )}

            {/* Review log table — fixed header + scrollable body */}
            {logs.length > 0 && (
              <div className="flex-1 min-h-0 mt-4 flex flex-col rounded-md border border-ctp-overlay0/80">
                {/* Fixed table header */}
                <div className="shrink-0 bg-ctp-surface0/50 border-b border-ctp-overlay0/50">
                  <div className="flex w-full text-xs">
                    <div className="flex-1 px-3 py-1.5 font-medium text-ctp-text">Date</div>
                    <div className="flex-1 px-3 py-1.5 font-medium text-ctp-text">Grade</div>
                    <div className="w-20 px-3 py-1.5 text-right font-medium text-ctp-text">Stability</div>
                    <div className="w-20 px-3 py-1.5 text-right font-medium text-ctp-text">Difficulty</div>
                    <div className="w-16 px-3 py-1.5 text-right font-medium text-ctp-text">Interval</div>
                  </div>
                </div>
                {/* Scrollable table body */}
                <div className="flex-1 min-h-0">
                  <ScrollArea className="h-full">
                    {logs.map((log, i) => (
                      <div
                        key={i}
                        className="flex w-full text-xs border-b border-ctp-overlay0/50 last:border-0"
                      >
                        <div className="flex-1 px-3 py-1.5 text-ctp-text">{log.date}</div>
                        <div className="flex-1 px-3 py-1.5">
                          <span
                            className="inline-block rounded px-1.5 py-0.5 text-xs font-medium text-ctp-base"
                            style={{ backgroundColor: GRADE_COLORS[log.grade] ?? "var(--catppuccin-color-lavender)" }}
                          >
                            {GRADE_LABELS[log.grade] ?? log.grade}
                          </span>
                        </div>
                        <div className="w-20 px-3 py-1.5 text-right text-ctp-text">{log.stability.toFixed(1)}d</div>
                        <div className="w-20 px-3 py-1.5 text-right text-ctp-text">{log.difficulty.toFixed(2)}</div>
                        <div className="w-16 px-3 py-1.5 text-right text-ctp-text">{log.scheduledDays}d</div>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center flex-1 text-xs text-ctp-overlay0">
            Select a card to view its memory timeline
          </div>
        )}
      </div>
    </div>
  );
}
