import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import Sidebar from "./components/Sidebar";
import Header  from "./components/Header";
import Login   from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { ThreatDetection } from "./pages/AllPages";
import { TrafficMonitor }  from "./pages/AllPages";
import { Analytics }       from "./pages/AllPages";
import { Mitigation }      from "./pages/AllPages";
import { Reports }         from "./pages/AllPages";

function Guard({ children }) {
  const { user, loading } = useApp();
  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <p className="font-mono text-cyan text-sm animate-pulse">INITIALIZING SHIELDNET…</p>
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/traffic"    element={<TrafficMonitor />} />
            <Route path="/threats"    element={<ThreatDetection />} />
            <Route path="/analytics"  element={<Analytics />} />
            <Route path="/mitigation" element={<Mitigation />} />
            <Route path="/reports"    element={<Reports />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<Guard><Layout /></Guard>} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
