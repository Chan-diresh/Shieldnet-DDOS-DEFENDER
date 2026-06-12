import { TrendingUp, TrendingDown } from "lucide-react";

// ── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon: Icon, color, trend }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 flex-1">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[9px] text-textDim uppercase tracking-widest">{label}</p>
          <p className="font-mono text-2xl font-bold mt-1.5 leading-none" style={{ color }}>
            {value}
          </p>
          {sub && <p className="text-[10px] text-textDim mt-1.5 font-syne">{sub}</p>}
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: color + "20" }}>
          <Icon size={17} style={{ color }} />
        </div>
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-3">
          {trend >= 0
            ? <TrendingUp size={11} className="text-green" />
            : <TrendingDown size={11} className="text-red" />}
          <span className={`font-mono text-[9px] ${trend >= 0 ? "text-green" : "text-red"}`}>
            {trend >= 0 ? "+" : ""}{trend}% last hour
          </span>
        </div>
      )}
    </div>
  );
}

// ── SeverityBadge ─────────────────────────────────────────────────────────────
const SEV = {
  CRITICAL: { bg: "#22000e", text: "#ff2d55", border: "#4d001a" },
  HIGH:     { bg: "#220c00", text: "#ff8a00", border: "#4d1800" },
  MEDIUM:   { bg: "#1e1800", text: "#ffc107", border: "#3d3000" },
  LOW:      { bg: "#082218", text: "#00e87a", border: "#0d3a28" },
};
export function SeverityBadge({ sev }) {
  const c = SEV[sev] || SEV.LOW;
  return (
    <span className="font-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {sev}
    </span>
  );
}

// ── Pulse ─────────────────────────────────────────────────────────────────────
export function Pulse({ color = "#00e87a", size = 6 }) {
  return (
    <span className="relative flex flex-shrink-0" style={{ width: size, height: size }}>
      <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full opacity-40"
        style={{ backgroundColor: color }} />
      <span className="relative inline-flex rounded-full" style={{ width: size, height: size, backgroundColor: color }} />
    </span>
  );
}

// ── Attack row ────────────────────────────────────────────────────────────────
export function AttackRow({ attack }) {
  const fmt = (n) => n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n);
  return (
    <div className="px-4 py-2.5 border-b border-border hover:bg-surface2 transition-colors cursor-default grid grid-cols-[1fr_auto] gap-2">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] text-cyan">{attack.src_ip || attack.ip}</span>
          {attack.country && <span className="font-mono text-[9px] text-textDim">{attack.country}</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="font-mono text-[10px] text-orange">{attack.attack_type || attack.type}</span>
          {attack.packets_rate && <span className="font-mono text-[9px] text-textDim">{fmt(attack.packets_rate)} pps</span>}
          <span className="font-mono text-[9px] text-textDim">
            conf: {(parseFloat(attack.confidence) * 100).toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <SeverityBadge sev={attack.severity} />
        <span className="font-mono text-[9px] text-textDim">
          {new Date(attack.detected_at || attack.time || Date.now()).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

// ── Custom chart tooltip ──────────────────────────────────────────────────────
export function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface2 border border-border rounded-lg p-3 font-mono text-[11px] shadow-xl">
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.stroke || p.color }} className="mb-0.5">
          {p.name}: <b>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</b>
        </div>
      ))}
    </div>
  );
}
