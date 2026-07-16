import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  loading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}

export function ChartCard({
  title,
  loading,
  error,
  isEmpty,
  emptyMessage,
  children,
}: ChartCardProps) {
  return (
    <div className="flex flex-col rounded-lg border border-ctp-overlay0/80 bg-white dark:bg-ctp-mantle shadow-sm p-4">
      <h3 className="mb-3 text-xs font-semibold text-ctp-overlay0 uppercase tracking-wider">
        {title}
      </h3>
      {loading ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-ctp-overlay0" />
        </div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <p className="text-xs text-red-500">{error}</p>
        </div>
      ) : isEmpty ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <p className="text-xs text-ctp-overlay0">
            {emptyMessage ?? "No data yet"}
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
