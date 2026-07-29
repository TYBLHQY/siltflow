import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  BrainCircuit,
  Monitor,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useState } from "react";

const NAV_ITEMS = [
  { to: "/devices", icon: Monitor, label: "Devices" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Layout() {
  const { device, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-ctp-overlay0/20 bg-ctp-mantle transition-transform duration-200",
          "lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ctp-mauve/15">
            <BrainCircuit className="h-4 w-4 text-ctp-mauve" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">SiltFlow</h2>
            <p className="text-[10px] text-ctp-overlay0">Dashboard</p>
          </div>
        </div>

        <div className="mx-3 border-t border-ctp-overlay0/10" />

        {/* Nav items */}
        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={closeSidebar}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-ctp-mauve/15 text-ctp-mauve font-medium"
                    : "text-ctp-text hover:bg-ctp-surface0",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Device info + Logout */}
        <div className="border-t border-ctp-overlay0/10 px-3 py-3">
          <div className="mb-2 truncate rounded-lg bg-ctp-base px-3 py-2">
            <p className="truncate text-xs font-medium text-ctp-text">
              {device?.deviceName ?? "Unknown device"}
            </p>
            <p className="truncate text-[10px] text-ctp-overlay0">
              {device?.isAdmin ? "Admin" : "Member"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-ctp-overlay0 transition-colors hover:bg-ctp-red/10 hover:text-ctp-red"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-auto bg-ctp-base">
        {/* Mobile header bar */}
        <div className="flex items-center gap-3 border-b border-ctp-overlay0/10 bg-ctp-mantle px-4 py-2.5 lg:hidden">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-1.5 text-ctp-overlay0 hover:bg-ctp-surface0 hover:text-ctp-text"
          >
            {sidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-ctp-mauve/15">
              <BrainCircuit className="h-3.5 w-3.5 text-ctp-mauve" />
            </div>
            <span className="text-sm font-semibold">SiltFlow</span>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
