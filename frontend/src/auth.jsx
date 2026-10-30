import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (getToken()) {
      api.me().then(setUser).catch(() => setToken(null)).finally(() => setLoading(false));
    }
    const onLogout = () => setUser(null);
    window.addEventListener("ems-logout", onLogout);
    return () => window.removeEventListener("ems-logout", onLogout);
  }, []);

  const login = async (email, password) => {
    const { token, user } = await api.login(email, password);
    setToken(token);
    setUser(user);
  };
  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, logout, isAdmin: user?.role === "admin" }}>{children}</Ctx.Provider>;
}
