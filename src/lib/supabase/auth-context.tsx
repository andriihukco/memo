'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextValue {
  accessToken: string | null;
  setAccessToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextValue>({
  accessToken: null,
  setAccessToken: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  return (
    <AuthContext.Provider value={{ accessToken, setAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
