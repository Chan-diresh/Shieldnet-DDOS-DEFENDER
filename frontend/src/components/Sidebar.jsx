import { NavLink } from "react-router-dom";
import {
  Activity, TrendingUp, Eye, BarChart2,
  Shield, FileText, Settings, LogOut,
} from "lucide-react";
import { useApp } from "../context/AppContext";

const NAV = [
  { to: "/",           label: "Overview",         icon: Activity  },
  { to: "/traffic",    label: "Traffic Monitor",  icon: TrendingUp },
  { to: "/threats",    label: "Threat Detection", icon: Eye        },
  { to: "/analytics",  label: "Analytics",        icon: BarChart2  },
  { to: "/mitigation", label: "Mitigation",       icon: Shield     },
  { to: "/reports",    label: "Reports",           icon: FileText   },
];

function Pulse({ color = "#00e87a" }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full opacity-40"
        style={{ backgroundColor: color }} />
      <span className="relative inline-flex rounded-full h-2 w-2"
        style={{ backgroundColor: color }} />
    </span>
  );
}

export default function Sidebar() {
  const { user, logout } = useApp();

  return (
    <aside className="w-56 bg-surface border-r border-border flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#00c8f0,#005580)" }}>
            <Shield size={18} color="#fff" />
          </div>
          <div>
            <div className="font-syne font-extrabold text-sm text-textBright leading-none">ShieldNet</div>
            <div className="font-mono text-[8px] text-cyan tracking-widest mt-0.5">DDoS PROTECTION</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-auto">
        <p className="font-mono text-[8px] text-textDim tracking-widest uppercase px-3 pb-2">Navigation</p>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md mb-0.5 text-sm transition-all
               border-l-2 font-syne
               ${isActive
                 ? "bg-surface3 text-cyan border-cyan font-semibold"
                 : "text-textDim border-transparent hover:bg-surface2 hover:text-white"}`
            }>
            <Icon size={14} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* System Health */}
      <div className="px-4 py-3 border-t border-border">
        <p className="font-mono text-[8px] text-textDim uppercase tracking-widest mb-2">System</p>
        {[
          { label: "ML Engine",       color: "#00e87a" },
          { label: "Traffic Analyzer",color: "#00e87a" },
          { label: "Rule Engine",     color: "#00e87a" },
          { label: "DB",              color: "#00e87a" },
        ].map((s) => (
          <div key={s.label} className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-[9px] text-textDim">{s.label}</span>
            <div className="flex items-center gap-1.5">
              <Pulse color={s.color} />
              <span className="font-mono text-[8px]" style={{ color: s.color }}>ONLINE</span>
            </div>
          </div>
        ))}
      </div>

      {/* User */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-textBright">{user?.username || "User"}</p>
            <p className="font-mono text-[9px] text-textDim uppercase">{user?.role}</p>
          </div>
          <button onClick={logout}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-surface3 text-textDim hover:text-red transition-colors">
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
