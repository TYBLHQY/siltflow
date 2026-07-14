import { NavLink } from "react-router-dom";
import {
  FileText,
  BookOpen,
  BarChart3,
  Settings,
} from "lucide-react";

const tabs = [
  { to: "/documents", label: "Docs", Icon: FileText },
  { to: "/study", label: "Study", Icon: BookOpen },
  { to: "/stats", label: "Stats", Icon: BarChart3 },
  { to: "/settings", label: "Settings", Icon: Settings },
];

export default function TabBar() {
  return (
    <nav className="flex-shrink-0 flex items-center justify-around bg-card border-t border-border px-2" style={{ height: '56px' }}>
      {tabs.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 text-xs transition-colors ${
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`
          }
          style={{ textDecoration: "none" }}
        >
          <Icon className="size-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
