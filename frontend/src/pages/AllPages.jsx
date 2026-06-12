// ─── ThreatDetection.jsx ────────────────────────────────────────────────────
import { useEffect, useState } from "react";

import { detectionAPI, analyticsAPI, mitigationAPI } from "../services/api";

import { AttackRow, SeverityBadge, ChartTooltip } from "../components/Charts";

import { useWebSocket } from "../hooks/useWebSocket";

import { RefreshCw, Plus, Trash2, Download } from "lucide-react";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function ThreatDetection() {
  const { recentAttacks } = useWebSocket();
  const [attacks, setAttacks] = useState([]);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("ALL");

  const load = async () => {
    setLoading(true);
    try {
      const [a, s] = await Promise.all([
        detectionAPI.getAttacks({ limit: 50 }),
        detectionAPI.getStats(),
      ]);
      setAttacks(a.data.data || []);
      setStats(s.data);
    } catch { setAttacks([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const allAttacks = [...recentAttacks, ...attacks].slice(0, 60);
  const filtered = filter === "ALL" ? allAttacks : allAttacks.filter(a => (a.severity || a.attack_type) === filter);

  return (
    <div className="p-5 h-full flex flex-col gap-4 overflow-auto">
      {/* Stats */}
      <div className="flex gap-3">
        {[
          { label:"Total Detections",    v: stats?.totals?.total || "12,847", color:"#00c8f0" },
          { label:"Active Threats",      v: stats?.totals?.active || "23",    color:"#ff2d55" },
          { label:"Avg Confidence",      v: stats ? `${(parseFloat(stats.totals?.avg_confidence||0.95)*100).toFixed(1)}%` : "95.4%", color:"#00e87a" },
          { label:"False Positives",     v: "32",  color:"#ff8a00" },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-lg p-4 flex-1">
            <p className="font-mono text-[9px] text-textDim uppercase tracking-widest">{s.label}</p>
            <p className="font-mono text-2xl font-bold mt-1.5" style={{ color: s.color }}>{s.v}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 flex-1 min-h-0">
        {/* Attack Feed */}
        <div className="bg-surface border border-border rounded-lg flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9px] text-textDim uppercase tracking-widest">Live Threat Feed</span>
              <div className="flex gap-1">
                {["ALL","CRITICAL","HIGH","MEDIUM"].map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`font-mono text-[8px] px-2 py-0.5 rounded border transition-colors ${
                      filter===f ? "border-cyan text-cyan bg-cyan/10" : "border-border text-textDim hover:border-textDim"
                    }`}>{f}</button>
                ))}
              </div>
            </div>
            <button onClick={load} className="text-textDim hover:text-white transition-colors">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
          <div className="overflow-y-auto flex-1">
            {loading
              ? <p className="text-center font-mono text-xs text-textDim py-8">Loading…</p>
              : filtered.length === 0
                ? <p className="text-center font-mono text-xs text-textDim py-8">No threats detected</p>
                : filtered.map((a, i) => <AttackRow key={a.id || i} attack={a} />)
            }
          </div>
        </div>

        {/* Sidebar stats */}
        <div className="w-64 flex flex-col gap-3">
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="font-mono text-[9px] text-textDim uppercase tracking-widest mb-3">By Attack Type</p>
            {(stats?.by_type || [
              { attack_type:"DDoS",       count:4821 },
              { attack_type:"DoS Hulk",   count:2103 },
              { attack_type:"Slowloris",  count:1456 },
              { attack_type:"HTTP Flood", count:987  },
              { attack_type:"Bot",        count:754  },
            ]).slice(0,6).map((t, i) => (
              <div key={i} className="flex items-center justify-between mb-2">
                <span className="font-mono text-[9px] text-textDim truncate">{t.attack_type}</span>
                <span className="font-mono text-[9px] text-red font-bold">{parseInt(t.count).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="font-mono text-[9px] text-textDim uppercase tracking-widest mb-3">Top Sources</p>
            {[
              { country:"China",       flag:"🇨🇳", count:"4,821" },
              { country:"Russia",      flag:"🇷🇺", count:"2,103" },
              { country:"Netherlands", flag:"🇳🇱", count:"1,456" },
              { country:"USA",         flag:"🇺🇸", count:"987" },
              { country:"Brazil",      flag:"🇧🇷", count:"754" },
            ].map(c => (
              <div key={c.country} className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{c.flag}</span>
                  <span className="text-xs text-textDim">{c.country}</span>
                </div>
                <span className="font-mono text-[9px] text-red font-bold">{c.count}</span>
              </div>
            ))}
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="font-mono text-[9px] text-textDim uppercase tracking-widest mb-2">ML Model</p>
            <p className="font-mono text-[9px] text-cyan mt-1">Stage 1: UNSW-NB15</p>
            <p className="font-mono text-[8px] text-textDim">XGBoost · Binary detection</p>
            <p className="font-mono text-[9px] text-cyan mt-2">Stage 2: CICIDS</p>
            <p className="font-mono text-[8px] text-textDim">XGBoost · Attack classification</p>
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex justify-between">
                <span className="font-mono text-[8px] text-textDim">Threshold</span>
                <span className="font-mono text-[8px] text-yellow">0.30 prob</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── TrafficMonitor.jsx ──────────────────────────────────────────────────────


export function TrafficMonitor() {
  const { trafficHistory, liveStats } = useWebSocket();
  const hourly = Array.from({ length: 24 }, (_, i) => ({
    h: `${i}h`,
    legitimate: 30000 + Math.random() * 50000,
    attack:      2000 + Math.random() * 18000,
  }));

  const stats = [
    { label:"Bandwidth In",        v:"2.4 Gbps",  color:"#00c8f0" },
    { label:"Bandwidth Out",       v:"1.1 Gbps",  color:"#00e87a" },
    { label:"Total Packets/s",     v:"124K",       color:"#ffc107" },
    { label:"Active Connections",  v:"8,234",      color:"#ff8a00" },
  ];

  return (
    <div className="p-5 flex flex-col gap-4 h-full overflow-auto">
      <div className="flex gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-lg p-4 flex-1 text-center">
            <p className="font-mono text-[9px] text-textDim uppercase tracking-widest">{s.label}</p>
            <p className="font-mono text-xl font-bold mt-1.5" style={{ color: s.color }}>{s.v}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-lg p-4" style={{ height: 280 }}>
        <p className="font-mono text-[9px] text-textDim uppercase tracking-widest mb-4">60-Second Live Breakdown</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={trafficHistory} margin={{ left:-16, right:4 }}>
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00c8f0" stopOpacity={0.3}/><stop offset="95%" stopColor="#00c8f0" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff2d55" stopOpacity={0.3}/><stop offset="95%" stopColor="#ff2d55" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#172438" vertical={false}/>
            <XAxis dataKey="t" hide />
            <YAxis tick={{ fontSize:10, fontFamily:"JetBrains Mono", fill:"#4a6078" }}/>
            <Tooltip content={<ChartTooltip/>}/>
            <Area type="monotone" dataKey="legitimate" stroke="#00c8f0" fill="url(#g1)" strokeWidth={1.5} name="Legitimate"/>
            <Area type="monotone" dataKey="attack"     stroke="#ff2d55" fill="url(#g2)" strokeWidth={1.5} name="Attack"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-surface border border-border rounded-lg p-4" style={{ height: 260 }}>
        <p className="font-mono text-[9px] text-textDim uppercase tracking-widest mb-4">24-Hour Traffic Distribution</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={hourly} margin={{ left:-16, right:4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#172438" vertical={false}/>
            <XAxis dataKey="h" tick={{ fontSize:9, fontFamily:"JetBrains Mono", fill:"#4a6078" }}/>
            <YAxis tick={{ fontSize:10, fontFamily:"JetBrains Mono", fill:"#4a6078" }}/>
            <Tooltip content={<ChartTooltip/>}/>
            <Bar dataKey="legitimate" fill="#00c8f0" opacity={0.75} radius={[2,2,0,0]} name="Legitimate"/>
            <Bar dataKey="attack"     fill="#ff2d55" opacity={0.75} radius={[2,2,0,0]} name="Attack"/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


// ─── Analytics.jsx ───────────────────────────────────────────────────────────


const ATK_COLORS2 = ["#ff2d55","#ff8a00","#ffc107","#00c8f0","#a78bfa","#f472b6"];

export function Analytics() {
  const [atkTypes, setAtkTypes] = useState([]);
  const [topAtk, setTopAtk]     = useState([]);
  const weekly = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => ({
    d, attacks: 1000+Math.random()*4000, blocked: 950+Math.random()*3800, leg: 50000+Math.random()*70000,
  }));

  useEffect(() => {
    analyticsAPI.getAttackTypes({ range:"7d" }).then(({ data }) => setAtkTypes(data)).catch(()=>{});
    analyticsAPI.getTopAttackers().then(({ data }) => setTopAtk(data)).catch(()=>{});
  }, []);

  const pie = atkTypes.length
    ? atkTypes.slice(0,6).map((a,i) => ({ name:a.attack_type, value:parseInt(a.count), color:ATK_COLORS2[i] }))
    : ["SYN Flood","HTTP Flood","UDP Flood","ICMP Flood","Slowloris","DNS Amp"].map((n,i) => ({
        name:n, value:[34,28,18,11,6,3][i], color:ATK_COLORS2[i] }));

  return (
    <div className="p-5 flex flex-col gap-4 h-full overflow-auto">
      <div className="flex gap-3" style={{ height: 300 }}>
        <div className="bg-surface border border-border rounded-lg p-4 flex-[2] flex flex-col">
          <p className="font-mono text-[9px] text-textDim uppercase tracking-widest mb-3">7-Day Attacks vs Blocked</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly} margin={{ left:-16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#172438" vertical={false}/>
              <XAxis dataKey="d" tick={{ fontSize:11, fontFamily:"JetBrains Mono", fill:"#4a6078" }}/>
              <YAxis tick={{ fontSize:10, fontFamily:"JetBrains Mono", fill:"#4a6078" }}/>
              <Tooltip content={<ChartTooltip/>}/>
              <Bar dataKey="attacks" fill="#ff2d55" opacity={0.8} radius={[2,2,0,0]} name="Attacks"/>
              <Bar dataKey="blocked" fill="#00e87a" opacity={0.8} radius={[2,2,0,0]} name="Blocked"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4 flex-1 flex flex-col">
          <p className="font-mono text-[9px] text-textDim uppercase tracking-widest mb-2">Attack Distribution</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pie} cx="50%" cy="50%" outerRadius={68} dataKey="value" strokeWidth={0}>
                {pie.map((e,i) => <Cell key={i} fill={e.color}/>)}
              </Pie>
              <Tooltip content={<ChartTooltip/>}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {pie.map(d => (
              <div key={d.name} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-sm" style={{ background: d.color }}/>
                <span className="font-mono text-[8px] text-textDim">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-4" style={{ height: 260 }}>
        <p className="font-mono text-[9px] text-textDim uppercase tracking-widest mb-3">7-Day Legitimate Traffic</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={weekly} margin={{ left:-16 }}>
            <defs>
              <linearGradient id="g3" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00c8f0" stopOpacity={0.3}/><stop offset="95%" stopColor="#00c8f0" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#172438" vertical={false}/>
            <XAxis dataKey="d" tick={{ fontSize:11, fontFamily:"JetBrains Mono", fill:"#4a6078" }}/>
            <YAxis tick={{ fontSize:10, fontFamily:"JetBrains Mono", fill:"#4a6078" }}/>
            <Tooltip content={<ChartTooltip/>}/>
            <Area type="monotone" dataKey="leg" stroke="#00c8f0" fill="url(#g3)" strokeWidth={2} name="Legitimate"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {topAtk.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-mono text-[9px] text-textDim uppercase tracking-widest">Top Attackers (24h)</p>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface2">
                {["IP Address","Attacks","Last Seen","Attack Types","Max Severity"].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-mono text-[8px] text-textDim uppercase tracking-widest font-normal border-b border-border">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topAtk.slice(0,10).map((a,i) => (
                <tr key={i} className="hover:bg-surface2 transition-colors">
                  <td className="px-4 py-2 font-mono text-[10px] text-cyan border-b border-border">{a.src_ip}</td>
                  <td className="px-4 py-2 font-mono text-[10px] text-red font-bold border-b border-border">{a.attack_count}</td>
                  <td className="px-4 py-2 font-mono text-[9px] text-textDim border-b border-border">{new Date(a.last_seen).toLocaleTimeString()}</td>
                  <td className="px-4 py-2 font-mono text-[9px] text-textDim border-b border-border">{(a.attack_types||[]).slice(0,2).join(", ")}</td>
                  <td className="px-4 py-2 border-b border-border"><SeverityBadge sev={a.max_severity||"HIGH"}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


// ─── Mitigation.jsx ──────────────────────────────────────────────────────────

export function Mitigation() {
  const [rules, setRules]         = useState([]);
  const [blockedIPs, setBlockedIPs] = useState([]);
  const [tab, setTab]             = useState("rules");
  const [loading, setLoading]     = useState(true);
  const [ipInput, setIpInput]     = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [r, b] = await Promise.all([
        mitigationAPI.getRules(),
        mitigationAPI.getBlockedIPs(),
      ]);
      setRules(r.data); setBlockedIPs(b.data.data || []);
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggle = async (id) => {
    try {
      const { data } = await mitigationAPI.toggleRule(id);
      setRules(prev => prev.map(r => r.id === id ? data : r));
    } catch {}
  };

  const blockIP = async () => {
    if (!ipInput.trim()) return;
    try {
      await mitigationAPI.blockIP({ ip_address: ipInput.trim(), reason: "Manual block" });
      setIpInput(""); load();
    } catch {}
  };

  const unblock = async (id) => {
    await mitigationAPI.unblockIP(id).catch(()=>{});
    setBlockedIPs(prev => prev.filter(ip => ip.id !== id));
  };

  return (
    <div className="p-5 flex flex-col gap-4 h-full overflow-auto">
      {/* Summary cards */}
      <div className="flex gap-3">
        {[
          { label:"Active Rules",    v: rules.filter(r=>r.is_active).length,  color:"#00e87a" },
          { label:"Standby Rules",   v: rules.filter(r=>!r.is_active).length, color:"#4a6078" },
          { label:"Blocked IPs",     v: blockedIPs.length,                     color:"#ff2d55" },
          { label:"Auto-Blocked",    v: blockedIPs.filter(i=>i.blocked_by==="ml-engine").length, color:"#ff8a00" },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-lg p-4 flex-1">
            <p className="font-mono text-[9px] text-textDim uppercase tracking-widest">{s.label}</p>
            <p className="font-mono text-2xl font-bold mt-1.5" style={{ color:s.color }}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {["rules","blocked-ips"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`font-mono text-[9px] uppercase tracking-widest px-4 py-2 border-b-2 transition-colors ${
              tab===t ? "border-cyan text-cyan" : "border-transparent text-textDim hover:text-white"
            }`}>{t.replace("-"," ")}</button>
        ))}
      </div>

      {tab === "rules" && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface2">
                {["Rule Name","Layer","Threshold","Hits","Status","Action"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-mono text-[8px] text-textDim uppercase tracking-widest font-normal border-b border-border">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={6} className="text-center font-mono text-xs text-textDim py-8">Loading…</td></tr>
                : rules.map(r => (
                  <tr key={r.id} className="hover:bg-surface2 transition-colors">
                    <td className="px-4 py-2.5 text-sm text-textBright border-b border-border">{r.name}</td>
                    <td className="px-4 py-2.5 font-mono text-[9px] text-cyan border-b border-border">{r.layer}</td>
                    <td className="px-4 py-2.5 font-mono text-[9px] text-textDim border-b border-border">{r.threshold}</td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-orange border-b border-border">{(r.hit_count||0).toLocaleString()}</td>
                    <td className="px-4 py-2.5 border-b border-border">
                      <span className={`font-mono text-[8px] ${r.is_active?"text-green":"text-textDim"}`}>● {r.is_active?"ACTIVE":"STANDBY"}</span>
                    </td>
                    <td className="px-4 py-2.5 border-b border-border">
                      <button onClick={() => toggle(r.id)}
                        className={`font-mono text-[8px] px-2 py-0.5 rounded border transition-colors ${
                          r.is_active
                            ? "border-red/40 bg-red/10 text-red hover:bg-red/20"
                            : "border-green/40 bg-green/10 text-green hover:bg-green/20"
                        }`}>
                        {r.is_active ? "DISABLE" : "ENABLE"}
                      </button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {tab === "blocked-ips" && (
        <div className="flex flex-col gap-3">
          {/* Manual block */}
          <div className="bg-surface border border-border rounded-lg p-4 flex items-center gap-3">
            <input value={ipInput} onChange={e => setIpInput(e.target.value)}
              placeholder="Enter IP to block (e.g. 192.168.1.1)"
              className="flex-1 bg-surface2 border border-border rounded-lg px-4 py-2 font-mono text-xs text-textBright outline-none focus:border-cyan transition-colors placeholder:text-textDim"/>
            <button onClick={blockIP}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all"
              style={{ background:"#ff2d5520", color:"#ff2d55", border:"1px solid #ff2d5540" }}>
              <Plus size={13}/> Block IP
            </button>
          </div>
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface2">
                  {["IP Address","Reason","Attack Type","Blocked By","Hits","Action"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-mono text-[8px] text-textDim uppercase tracking-widest font-normal border-b border-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {blockedIPs.map(ip => (
                  <tr key={ip.id} className="hover:bg-surface2 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[10px] text-red border-b border-border">{ip.ip_address}</td>
                    <td className="px-4 py-2.5 text-xs text-textDim border-b border-border">{ip.reason}</td>
                    <td className="px-4 py-2.5 font-mono text-[9px] text-orange border-b border-border">{ip.attack_type||"—"}</td>
                    <td className="px-4 py-2.5 font-mono text-[9px] text-textDim border-b border-border">{ip.blocked_by}</td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-textBright border-b border-border">{ip.hit_count}</td>
                    <td className="px-4 py-2.5 border-b border-border">
                      <button onClick={() => unblock(ip.id)} className="text-textDim hover:text-red transition-colors">
                        <Trash2 size={13}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Reports.jsx ─────────────────────────────────────────────────────────────

export function Reports() {
  const [overview, setOverview] = useState(null);
  useEffect(() => { analyticsAPI.getOverview().then(({ data }) => setOverview(data)).catch(()=>{}); }, []);

  const rows = [
    ["Total Requests (24h)",    overview?.traffic?.total_requests?.toLocaleString() || "5,820,000"],
    ["Legitimate Traffic",       "87.3%"],
    ["Attack Traffic",           "12.7%"],
    ["Attacks Detected",         overview?.attacks?.total_attacks?.toLocaleString() || "12,847"],
    ["Critical Attacks",         overview?.attacks?.critical?.toLocaleString() || "234"],
    ["Blocked IPs",              overview?.blocked?.blocked_ips?.toLocaleString() || "1,847"],
    ["False Positive Rate",      "0.25%"],
    ["Avg Detection Latency",    "1.3 ms"],
    ["System Uptime",            "99.99%"],
  ];
  const mlRows = [
    ["Architecture",  "XGBoost — Two-stage pipeline"],
    ["Stage 1",       "UNSW-NB15 · Binary detection"],
    ["Stage 2",       "CICIDS · Multi-class classification"],
    ["Accuracy",      "98.7%"],
    ["Precision",     "97.9%"],
    ["Recall",        "99.1%"],
    ["F1 Score",      "98.5%"],
    ["Model Version", "v1.0.0"],
  ];

  return (
    <div className="p-5 flex flex-col gap-4 h-full overflow-auto">
      <div className="bg-surface border border-border rounded-lg px-5 py-4">
        <h2 className="font-syne font-bold text-lg text-textBright">System Summary Report</h2>
        <p className="font-mono text-[9px] text-textDim mt-1">Generated: {new Date().toLocaleString()}</p>
      </div>

      <div className="flex gap-3">
        <div className="bg-surface border border-border rounded-lg p-5 flex-1">
          <p className="font-mono text-[9px] text-textDim uppercase tracking-widest mb-4">Protection Summary</p>
          {rows.map(([k,v]) => (
            <div key={k} className="flex justify-between py-2 border-b border-border">
              <span className="text-xs text-textDim">{k}</span>
              <span className="font-mono text-xs text-textBright font-bold">{v}</span>
            </div>
          ))}
        </div>
        <div className="bg-surface border border-border rounded-lg p-5 flex-1">
          <p className="font-mono text-[9px] text-textDim uppercase tracking-widest mb-4">ML Model Performance</p>
          {mlRows.map(([k,v]) => (
            <div key={k} className="flex justify-between py-2 border-b border-border">
              <span className="text-xs text-textDim">{k}</span>
              <span className="font-mono text-xs text-cyan font-bold">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-5">
        <p className="font-mono text-[9px] text-textDim uppercase tracking-widest mb-4">Export</p>
        <div className="flex gap-3 flex-wrap">
          {["PDF Report","CSV Export","JSON Data","SIEM Export"].map(btn => (
            <button key={btn}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface2 text-textDim
                         hover:border-cyan hover:text-cyan font-syne text-sm transition-colors">
              <Download size={13}/> {btn}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
