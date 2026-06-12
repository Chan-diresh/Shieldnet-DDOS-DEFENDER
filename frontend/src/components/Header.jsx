import { useState, useEffect } from "react";
import { Bell, ChevronRight, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { alertsAPI } from "../services/api";

const TITLES = {
  "/":           "Overview",
  "/traffic":    "Traffic Monitor",
  "/threats":    "Threat Detection",
  "/analytics":  "Analytics",
  "/mitigation": "Mitigation",
  "/reports":    "Reports",
};

const SEV_COLORS = {
  CRITICAL: "#ff2d55", HIGH: "#ff8a00", MEDIUM: "#ffc107", LOW: "#00e87a",
};

export default function Header() {
  const { alerts, setAlerts } = useApp();
  const [open, setOpen]       = useState(false);
  const [time, setTime]       = useState(new Date().toLocaleTimeString());
  const location              = useLocation();

  useEffect(() => {
    const iv = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    alertsAPI.getAlerts({ unread_only: "false", limit: 10 })
      .then(({ data }) => setAlerts(data))
      .catch(() => {});
  }, []);

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  const markRead = async (id) => {
    await alertsAPI.markRead(id).catch(() => {});
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, is_read: true } : a));
  };

  return (
    <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-6 flex-shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9px] text-textDim uppercase tracking-widest">ShieldNet</span>
        <ChevronRight size={11} className="text-textDim" />
        <span className="font-syne font-semibold text-sm text-textBright">
          {TITLES[location.pathname] || "Page"}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Status pill */}
        <div className="flex items-center gap-2 bg-surface2 border border-border rounded-full px-3 py-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-green opacity-40" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green" />
          </span>
          <span className="font-mono text-[9px] text-green tracking-widest">PROTECTED</span>
        </div>

        {/* Clock */}
        <span className="font-mono text-[10px] text-textDim">{time}</span>

        {/* Alerts bell */}
        <div className="relative">
          <button onClick={() => setOpen(!open)}
            className="relative w-8 h-8 rounded-md border border-border hover:bg-surface2 flex items-center justify-center transition-colors">
            <Bell size={14} className={unreadCount > 0 ? "text-yellow" : "text-textDim"} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red" />
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-10 w-80 bg-surface border border-border rounded-lg z-50 shadow-2xl animate-fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="font-syne font-semibold text-sm text-textBright">
                  Alerts {unreadCount > 0 && <span className="text-red ml-1">({unreadCount})</span>}
                </span>
                <button onClick={() => setOpen(false)} className="text-textDim hover:text-white">
                  <X size={13} />
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {alerts.length === 0 && (
                  <p className="text-center text-textDim text-xs py-6 font-mono">No alerts</p>
                )}
                {alerts.map((a) => (
                  <div key={a.id}
                    className={`px-4 py-3 border-b border-border cursor-pointer hover:bg-surface2 transition-colors ${!a.is_read ? "border-l-2" : ""}`}
                    style={!a.is_read ? { borderLeftColor: SEV_COLORS[a.severity] } : {}}
                    onClick={() => markRead(a.id)}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-white flex-1">{a.title || a.message}</span>
                      <span className="font-mono text-[8px] px-1.5 py-0.5 rounded"
                        style={{ color: SEV_COLORS[a.severity], background: SEV_COLORS[a.severity] + "20" }}>
                        {a.severity}
                      </span>
                    </div>
                    <p className="font-mono text-[9px] text-textDim mt-1">
                      {new Date(a.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
