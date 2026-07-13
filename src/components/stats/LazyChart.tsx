import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface LazyChartProps {
  children: ReactNode;
  height?: number;
}

export function LazyChart({ children, height = 320 }: LazyChartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "100px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {isVisible ? (
        children
      ) : (
        <div
          className="flex items-center justify-center rounded-lg border border-border/80 bg-white dark:bg-mantle shadow-sm"
          style={{ height }}
        >
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
