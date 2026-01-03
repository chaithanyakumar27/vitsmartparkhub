import React, { createContext, useContext, useState, ReactNode } from 'react';

interface User {
  collegeId: string;
}

interface AuthContextType {
  user: User | null;
  login: (collegeId: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('vit_parking_user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = (collegeId: string, password: string): boolean => {
    // Demo validation - accepts any college ID format with at least 5 chars and password min 4 chars
    if (collegeId.length >= 5 && password.length >= 4) {
      const userData = { collegeId };
      setUser(userData);
      localStorage.setItem('vit_parking_user', JSON.stringify(userData));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('vit_parking_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};