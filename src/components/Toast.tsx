import { useToastStore } from "@/stores/toast.store"
import { CheckCircle2, AlertCircle, Info } from "lucide-react"

export function Toast() {
  const message = useToastStore((s) => s.message)
  const type = useToastStore((s) => s.type)

  if (!message) return null

  const Icon = type === "info" ? Info : type === "success" ? CheckCircle2 : AlertCircle

  const darkColorMap = {
    info: "border-blue-600 bg-blue-950/90 text-blue-200 backdrop-blur-sm",
    success: "border-green-600 bg-green-950/90 text-green-200 backdrop-blur-sm",
    error: "border-red-600 bg-red-950/90 text-red-200 backdrop-blur-sm",
  }

  return (
    <div className="fixed top-4 left-1/2 z-[100] -translate-x-1/2">
      <div
        className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 shadow-lg text-sm ${darkColorMap[type]}`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
    </div>
  )
}
