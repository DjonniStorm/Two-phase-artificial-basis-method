import {
  createContext,
  useState,
  useContext,
  type PropsWithChildren,
} from 'react';
import type { LinearSystem } from './types';

type AppData = {
  linearSystem: LinearSystem | null;
  setLinearSystem: (system: LinearSystem) => void;
  isCalculated: boolean;
  setIsCalculated: (v: boolean) => void;
};

const AppContext = createContext<AppData | null>(null);

export const AppContextProvider = ({ children }: PropsWithChildren) => {
  const [linearSystem, setLinearSystem] = useState<LinearSystem | null>(null);
  const [isCalculated, setIsCalculated] = useState<boolean>(false);

  return (
    <AppContext.Provider
      value={{ linearSystem, setLinearSystem, isCalculated, setIsCalculated }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppContextProvider');
  }
  return context;
};
