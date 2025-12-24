import { createContext, useContext, useState, type ReactNode } from 'react';

const AUTH_TOKEN_KEY = 'mi_app_token';
const AUTH_USER_TYPE_KEY = 'mi_app_user_type';
const AUTH_USER_ID_KEY = 'mi_app_user_id';

interface AuthContextType {
  isAuthenticated: boolean;
  userType: string | null;
  userId: string | null;
  // login signature: token, optional callback, optional userType
  // compatible signature: login(token, callback?, userType?, userId?)
  login: (token: string, callback?: () => void, userType?: string, userId?: string) => void;
  logout: (callback?: () => void) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    return !!storedToken;
  });

  const [userType, setUserType] = useState<string | null>(() => {
    return localStorage.getItem(AUTH_USER_TYPE_KEY);
  });

  const [userId, setUserId] = useState<string | null>(() => {
    return localStorage.getItem(AUTH_USER_ID_KEY);
  });

  const login = (token: string, callback?: () => void, userTypeParam?: string, userIdParam?: string) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);

    if (userTypeParam) {
      localStorage.setItem(AUTH_USER_TYPE_KEY, userTypeParam);
      setUserType(userTypeParam);
    }

    if (userIdParam) {
      localStorage.setItem(AUTH_USER_ID_KEY, userIdParam);
      setUserId(userIdParam);
    }

    setIsAuthenticated(true);
    if (callback) callback();
  };

  const logout = (callback?: () => void) => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_TYPE_KEY);
    localStorage.removeItem(AUTH_USER_ID_KEY);
    setIsAuthenticated(false);
    setUserType(null);
    setUserId(null);
    if (callback) callback();
  };

  const value = { isAuthenticated, userType, userId, login, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}