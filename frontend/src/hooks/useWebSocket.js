import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useApp } from "../context/AppContext";

export function useWebSocket() {
  const { addAlert } = useApp();
  const socketRef = useRef(null);
  const [trafficHistory, setTrafficHistory]   = useState(() =>
    Array.from({ length: 60 }, (_, i) => ({
      t: i, legitimate: 800 + Math.random() * 400,
      attack: Math.random() > 0.6 ? Math.random() * 300 : Math.random() * 40,
    }))
  );
  const [liveStats, setLiveStats]     = useState({ total_rps: 0, attack_rps: 0 });
  const [recentAttacks, setRecentAttacks] = useState([]);
  const [summary, setSummary]         = useState({});
  const tickRef = useRef(60);

  useEffect(() => {
    const socket = io({ path: "/socket.io", transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("traffic:snapshot", (snap) => {
      tickRef.current++;
      setLiveStats(snap);
      setTrafficHistory((prev) => [
        ...prev.slice(-59),
        { t: tickRef.current, legitimate: snap.total_rps - snap.attack_rps, attack: snap.attack_rps },
      ]);
    });

    socket.on("attack:new", (attack) => {
      setRecentAttacks((prev) => [attack, ...prev.slice(0, 49)]);
    });

    socket.on("alert:new", (alert) => {
      addAlert(alert);
    });

    socket.on("dashboard:summary", (s) => setSummary(s));

    return () => socket.disconnect();
  }, []);

  return { trafficHistory, liveStats, recentAttacks, summary };
}
