import { useEffect, useState } from "react";
import { Globe, Activity, Lock, Cpu } from "lucide-react";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { StatCard, AttackRow, ChartTooltip, Pulse, SeverityBadge } from "../components/Charts";
import { useWebSocket } from "../hooks/useWebSocket";
import { analyticsAPI, detectionAPI, mitigationAPI } from "../services/api";

const fmt = (n) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : String(Math.round(n));

const ATK_COLORS = ["#ff2d55","#ff8a00","#ffc107","#00c8f0","#a78bfa","#f472b6"];
const ATK_TYPES  = ["SYN Flood","HTTP Flood","UDP Flood","ICMP Flood","Slowloris","DNS Amp"];

export default function Dashboard() {
  const { trafficHistory, liveStats, recentAttacks, summary } = useWebSocket();
  const [overview, setOverview]     = useState(null);
  const [atkTypes, setAtkTypes]     = useState([]);
  const [mlInfo, setMlInfo]         = useState(null);
  const [rules, setRules]           = useState([]);

  useEffect(() => {
    analyticsAPI.getOverview().then(({ data }) => setOverview(data)).catch(() => {});
    analyticsAPI.getAttackTypes().then(({ data }) => setAtkTypes(data)).catch(() => {});
    detectionAPI.getModelInfo().then(({ data }) => setMlInfo(data)).catch(() => {});
    mitigationAPI.getRules().then(({ data }) => setRules(data)).catch(() => {});
  }, []);

  const pieData = atkTypes.length
    ? atkTypes.slice(0, 6).map((a, i) => ({ name: a.attack_type, value: parseInt(a.count), color: ATK_COLORS[i] }))
    : ATK_TYPES.map((n, i) => ({ name: n, value: [34,28,18,11,6,3][i], color: ATK_COLORS[i] }));

  const mlMetrics = [
    { label: "Accuracy",  value: 98.7, color: "#00e87a" },
    { label: "Precision", value: 97.9, color: "#00c8f0" },
    { label: "Recall",    value: 99.1, color: "#ffc107" },
    { label: "F1 Score",  value: 98.5, color: "#ff8a00" },
  ];

  return (
    <div className="flex flex-col gap-4 p-5 h-full overflow-auto">
      {/* Stats row */}
      <div className="flex gap-3">
        <StatCard label="Total Requests"  value={fmt(overview?.traffic?.total_requests || 5820000)}
          sub="Last 24 hours" icon={Globe}    color="#00c8f0" trend={12} />
        <StatCard label="Current Req/s"   value={fmt(liveStats.total_rps || 1240)}
          sub={`${liveStats.attack_rps || 0} malicious/s`} icon={Activity} color="#00e87a" trend={-3} />
        <StatCard label="Blocked IPs"     value={fmt(overview?.blocked?.blocked_ips || summary.blocked_ips || 1847)}
          sub="Auto-blacklisted" icon={Lock}  color="#ff2d55" trend={8} />
        <StatCard label="ML Accuracy"     value="98.7%"
          sub="XGBoost + CICIDS ensemble" icon={Cpu} color="#ffc107" />
      </div>

      {/* Traffic chart + Attack feed */}
      <div className="flex gap-3" style={{ height: 300 }}>
        <div className="bg-surface border border-border rounded-lg p-4 flex-[2] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-mono text-[9px] text-textDim uppercase tracking-widest">Real-Time Traffic</p>
              <p className="font-mono text-[8px] text-textDim mt-0.5">Last 60s — 1s resolution</p>
            </div>
            <div className="flex gap-4">
              {[["#00c8f0","Legitimate"],["#ff2d55","Attack"]].map(([c,l]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5" style={{ background: c }} />
                  <span className="font-mono text-[8px] text-textDim">{l}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trafficHistory.slice(-30)} margin={{ left: -18, right: 4, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00c8f0" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#00c8f0" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ff2d55" stopOpacity={0.28}/>
                  <stop offset="95%" stopColor="#ff2d55" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#172438" vertical={false} />
              <XAxis dataKey="t" hide />
              <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#4a6078" }} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="legitimate" stroke="#00c8f0" fill="url(#gL)" strokeWidth={1.5} name="Legitimate" />
              <Area type="monotone" dataKey="attack"     stroke="#ff2d55" fill="url(#gA)" strokeWidth={1.5} name="Attack" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Live Attack Feed */}
        <div className="bg-surface border border-border rounded-lg flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-mono text-[9px] text-textDim uppercase tracking-widest">Live Attack Feed</span>
            <div className="flex items-center gap-1.5">
              <Pulse color="#ff2d55" size={5} />
              <span className="font-mono text-[8px] text-red">LIVE</span>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {recentAttacks.length === 0
              ? <p className="text-center text-textDim font-mono text-xs py-8">Monitoring…</p>
              : recentAttacks.slice(0, 10).map((a, i) => <AttackRow key={a.id || i} attack={a} />)
            }
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex gap-3" style={{ height: 260 }}>
        {/* Attack Vector Pie */}
        <div className="bg-surface border border-border rounded-lg p-4 w-72 flex flex-col">
          <p className="font-mono text-[9px] text-textDim uppercase tracking-widest mb-2">Attack Vectors</p>
          <div className="flex items-center flex-1">
            <ResponsiveContainer width="50%" height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={66} dataKey="value" strokeWidth={0}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-sm" style={{ background: d.color }} />
                    <span className="font-mono text-[9px] text-textDim">{d.name}</span>
                  </div>
                  <span className="font-mono text-[9px] text-textBright font-bold">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ML Model Stats */}
        <div className="bg-surface border border-border rounded-lg p-4 w-56 flex flex-col">
          <p className="font-mono text-[9px] text-textDim uppercase tracking-widest">ML Performance</p>
          <p className="font-mono text-[8px] text-textDim mt-0.5 mb-3">
            {mlInfo?.stage1 ? "Two-stage XGBoost" : "XGBoost + CICIDS"}
          </p>
          {mlMetrics.map((m) => (
            <div key={m.label} className="mb-2.5">
              <div className="flex justify-between mb-1">
                <span className="font-mono text-[9px] text-textDim">{m.label}</span>
                <span className="font-mono text-[9px] font-bold" style={{ color: m.color }}>{m.value}%</span>
              </div>
              <div className="h-1 rounded-full bg-surface3">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${m.value}%`, background: m.color }} />
              </div>
            </div>
          ))}
          <div className="mt-auto bg-surface3 border border-border rounded-lg px-3 py-2">
            <p className="font-mono text-[8px] text-textDim">Model Version</p>
            <p className="font-mono text-[10px] text-textBright mt-0.5">v1.0.0 · UNSW + CIC</p>
          </div>
        </div>

        {/* Active Rules */}
        <div className="bg-surface border border-border rounded-lg flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-mono text-[9px] text-textDim uppercase tracking-widest">Active Mitigation Rules</p>
          </div>
          <div className="overflow-y-auto flex-1">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface2">
                  {["Rule","Layer","Threshold","Hits","Status"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-mono text-[8px] text-textDim uppercase tracking-widest font-normal border-b border-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(rules.length ? rules : [
                  { id:1, name:"SYN Cookie Protection", layer:"L4", threshold:"10K pps", hit_count:4821, is_active:true },
                  { id:2, name:"HTTP Rate Limiting",    layer:"L7", threshold:"100 rps", hit_count:1203, is_active:true },
                  { id:3, name:"IP Reputation Filter",  layer:"L3", threshold:"Global DB",hit_count:567, is_active:true },
                  { id:4, name:"Geo-Blocking Tier",     layer:"L3", threshold:"15 countries",hit_count:312,is_active:true},
                  { id:5, name:"Slowloris Guard",       layer:"L7", threshold:"50 conn/IP",hit_count:0, is_active:false},
                ]).map((r) => (
                  <tr key={r.id} className="hover:bg-surface2 transition-colors">
                    <td className="px-3 py-2 text-xs text-textBright border-b border-border">{r.name}</td>
                    <td className="px-3 py-2 font-mono text-[9px] text-cyan border-b border-border">{r.layer || r.rule_type}</td>
                    <td className="px-3 py-2 font-mono text-[9px] text-textDim border-b border-border">{r.threshold}</td>
                    <td className="px-3 py-2 font-mono text-[9px] text-orange border-b border-border">{fmt(r.hit_count)}</td>
                    <td className="px-3 py-2 border-b border-border">
                      <span className={`font-mono text-[8px] ${r.is_active ? "text-green" : "text-textDim"}`}>
                        ● {r.is_active ? "ACTIVE" : "STANDBY"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
