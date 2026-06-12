import { createContext, useContext, useState, useEffect } from "react";
import { authAPI } from "../services/api";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts]   = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("sn_token");
    if (token) {
      authAPI.me()
        .then(({ data }) => setUser(data))
        .catch(() => localStorage.removeItem("sn_token"))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    localStorage.setItem("sn_token", data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("sn_token");
    setUser(null);
  };

  const addAlert = (alert) =>
    setAlerts((prev) => [{ id: Date.now(), ...alert }, ...prev.slice(0, 49)]);

  return (
    <AppContext.Provider value={{ user, loading, login, logout, alerts, setAlerts, addAlert }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
