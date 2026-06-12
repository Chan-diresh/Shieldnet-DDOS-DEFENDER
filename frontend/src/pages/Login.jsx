import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Eye, EyeOff } from "lucide-react";
import { useApp } from "../context/AppContext";

export default function Login() {
  const { login }       = useApp();
  const navigate        = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4"
      style={{ background: "radial-gradient(ellipse at 50% 0%, #00c8f010 0%, #030711 60%)" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg,#00c8f0,#005580)" }}>
            <Shield size={30} color="#fff" />
          </div>
          <h1 className="font-syne font-extrabold text-2xl text-textBright">ShieldNet</h1>
          <p className="font-mono text-[9px] text-cyan tracking-widest mt-1">DDoS PROTECTION PLATFORM</p>
        </div>

        {/* Form */}
        <div className="bg-surface border border-border rounded-xl p-8">
          <h2 className="font-syne font-bold text-lg text-textBright mb-6">Sign In</h2>
          {error && (
            <div className="bg-red/10 border border-red/30 rounded-lg px-4 py-2.5 mb-4">
              <p className="text-red text-xs font-mono">{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-mono text-[9px] text-textDim uppercase tracking-widest block mb-1.5">
                Email
              </label>
              <input type="email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-surface2 border border-border rounded-lg px-4 py-2.5 text-sm text-textBright
                           font-mono outline-none focus:border-cyan transition-colors placeholder:text-textDim"
                placeholder="admin@shieldnet.io" />
            </div>
            <div>
              <label className="font-mono text-[9px] text-textDim uppercase tracking-widest block mb-1.5">
                Password
              </label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} required value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-surface2 border border-border rounded-lg px-4 py-2.5 pr-10 text-sm
                             text-textBright font-mono outline-none focus:border-cyan transition-colors
                             placeholder:text-textDim"
                  placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-textDim hover:text-white transition-colors">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg font-syne font-semibold text-sm transition-all mt-2
                         disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg,#00c8f0,#0080a0)", color: "#fff" }}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
        <p className="text-center font-mono text-[9px] text-textDim mt-6 tracking-widest">
          SHIELDNET v1.0 — CLOUD DDoS PROTECTION
        </p>
      </div>
    </div>
  );
}
