import React, { createContext, useContext, useMemo } from 'react';
import { BoardGroup, BoardItem } from './types';

interface DataContextType {
  groups: BoardGroup[];
  items: BoardItem[];
}

export const DataContext = createContext<DataContextType>({ groups: [], items: [] });

export const DataProvider: React.FC<{ groups: BoardGroup[]; children: React.ReactNode }> = ({ groups, children }) => {
  const items = useMemo(() => groups.flatMap(g => g.items), [groups]);
  const value = useMemo(() => ({ groups, items }), [groups, items]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => useContext(DataContext);
