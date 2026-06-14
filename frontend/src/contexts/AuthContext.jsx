import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getToken,
  getUserFromStorage,
  saveAuth,
  clearAuth,
  setAuthToken,
  loginUser,
  registerUser,
  fetchMe,
} from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getUserFromStorage());
  const [token, setToken] = useState(getToken());
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    setAuthToken(token);
    fetchMe()
      .then((result) => {
        setUser(result.data.user);
      })
      .catch(() => {
        clearAuth();
        setUser(null);
        setToken(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const login = async (email, password) => {
    setError(null);
    const result = await loginUser({ email, password });
    const { token: authToken, user: authUser } = result.data;
    saveAuth({ token: authToken, user: authUser });
    setToken(authToken);
    setUser(authUser);
    return result;
  };

  const register = async (name, email, password) => {
    setError(null);
    const result = await registerUser({ name, email, password });
    const { token: authToken, user: authUser } = result.data;
    saveAuth({ token: authToken, user: authUser });
    setToken(authToken);
    setUser(authUser);
    return result;
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    setToken(null);
  };

  const value = useMemo(
    () => ({ user, token, loading, error, login, register, logout }),
    [user, token, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
