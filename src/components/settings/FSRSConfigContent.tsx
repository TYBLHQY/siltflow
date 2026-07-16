import { BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFSRSStore } from "@/stores/fsrs.store";

export function FSRSConfigContent() {
  const params = useFSRSStore((s) => s.params);
  const updateParam = useFSRSStore((s) => s.updateParam);
  const resetParams = useFSRSStore((s) => s.resetParams);

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <BrainCircuit className="h-5 w-5" />
        <h2 className="text-base font-semibold">Spaced Repetition (FSRS)</h2>
      </div>

      <div className="space-y-4">
        {/* Request retention */}
        <div>
          <label className="block text-xs font-medium mb-1">
            Retention rate ({Math.round(params.request_retention * 100)}%)
          </label>
          <input
            type="range"
            min="0.7"
            max="0.97"
            step="0.01"
            className="w-full"
            value={params.request_retention}
            onChange={(e) =>
              updateParam("request_retention", parseFloat(e.target.value))
            }
          />
          <p className="text-xs text-ctp-overlay0 mt-0.5">
            Higher = more reviews, better retention. Default: 85%
          </p>
        </div>

        {/* Maximum interval */}
        <div>
          <label className="block text-xs font-medium mb-1">
            Maximum interval (days: {params.maximum_interval})
          </label>
          <input
            type="range"
            min="30"
            max="3650"
            step="30"
            className="w-full"
            value={params.maximum_interval}
            onChange={(e) =>
              updateParam("maximum_interval", parseInt(e.target.value, 10))
            }
          />
          <p className="text-xs text-ctp-overlay0 mt-0.5">
            Max days between reviews. Default: 365
          </p>
        </div>

        {/* Fuzz */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enable_fuzz"
            className="rounded"
            checked={params.enable_fuzz}
            onChange={(e) => updateParam("enable_fuzz", e.target.checked)}
          />
          <label htmlFor="enable_fuzz" className="text-xs">
            Enable fuzz (adds jitter to intervals for natural spacing)
          </label>
        </div>

        {/* Short term steps */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enable_short_term"
            className="rounded"
            checked={params.enable_short_term}
            onChange={(e) => updateParam("enable_short_term", e.target.checked)}
          />
          <label htmlFor="enable_short_term" className="text-xs">
            Enable short-term (re)learning steps
          </label>
        </div>

        {/* Learning steps (shown when enable_short_term) */}
        {params.enable_short_term && (
          <div>
            <label className="block text-xs font-medium mb-1">
              Learning steps
            </label>
            <div className="flex gap-2">
              {[0, 1].map((idx) => {
                const raw = (params.learning_steps as string[])[idx] ?? "1m";
                const val = parseInt(raw.replace(/[^0-9]/g, ""), 10) || 1;
                return (
                  <div key={idx} className="flex-1 flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      className="w-full rounded-md border bg-ctp-base px-2 py-1.5 text-xs"
                      value={val}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10) || 1;
                        const arr = [...(params.learning_steps as string[])];
                        arr[idx] = `${n}m`;
                        updateParam("learning_steps" as const, arr as any);
                      }}
                    />
                    <span className="text-xs text-ctp-overlay0 shrink-0">
                      m
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Relearning steps */}
        {params.enable_short_term && (
          <div>
            <label className="block text-xs font-medium mb-1">
              Relearning steps
            </label>
            <div className="flex gap-2">
              {[0].map((idx) => {
                const raw = (params.relearning_steps as string[])[idx] ?? "10m";
                const val = parseInt(raw.replace(/[^0-9]/g, ""), 10) || 10;
                return (
                  <div key={idx} className="flex-1 flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      className="w-full rounded-md border bg-ctp-base px-2 py-1.5 text-xs"
                      value={val}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10) || 10;
                        const arr = [`${n}m`];
                        updateParam("relearning_steps" as const, arr as any);
                      }}
                    />
                    <span className="text-xs text-ctp-overlay0 shrink-0">
                      m
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 border-t pt-3">
        <Button
          variant="outline"
          size="sm"
          className="text-xs text-ctp-red"
          onClick={resetParams}
        >
          Reset to defaults
        </Button>
      </div>
    </>
  );
}
