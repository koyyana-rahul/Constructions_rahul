import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, SESSION_EXPIRED_EVENT } from "../lib/api";

const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyUser = async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get("/auth/verify");
        if (data.success) {
          setUser(data.user);
        } else {
          localStorage.removeItem("token");
        }
      } catch {
        // Expired or invalid token - clear it so the app returns to a clean
        // signed-out state instead of looping on failed requests.
        localStorage.removeItem("token");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, []);

  // The API client fires this on any 401, so an expired session signs the user
  // out everywhere at once instead of leaving a half-authenticated UI.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback((userData) => setUser(userData), []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("token");
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthProvider;