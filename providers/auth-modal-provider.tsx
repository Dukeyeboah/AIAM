'use client';

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { AuthModal } from '@/components/auth/auth-modal';
import { useAuth } from '@/providers/auth-provider';

interface AuthModalContextValue {
  open: () => void;
  close: () => void;
  setOpen: (open: boolean) => void;
  isOpen: boolean;
}

const AuthModalContext = createContext<AuthModalContextValue | undefined>(
  undefined
);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (user) {
      setIsOpen(false);
    }
  }, [user]);

  const value = useMemo<AuthModalContextValue>(
    () => ({
      open,
      close,
      setOpen: setIsOpen,
      isOpen,
    }),
    [close, open, isOpen]
  );

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AuthModal open={isOpen} onOpenChange={setIsOpen} />
    </AuthModalContext.Provider>
  );
}

export const useAuthModal = (): AuthModalContextValue => {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error('useAuthModal must be used within an AuthModalProvider.');
  }
  return context;
};
