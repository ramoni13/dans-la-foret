import React, { createContext, useContext, useEffect } from 'react';
import { useFonts } from 'expo-font';
import { Fredoka_700Bold } from '@expo-google-fonts/fredoka/700Bold';

const HomeFontContext = createContext<string | undefined>(undefined);

export function HomeFontProvider({ children }: { children: React.ReactNode }) {
  const [loaded, error] = useFonts({ ForestDisplay: Fredoka_700Bold });

  useEffect(() => {
    if (error) console.warn('[HomeFont] Chargement de la police impossible', error);
  }, [error]);

  return (
    <HomeFontContext.Provider value={loaded ? 'ForestDisplay' : undefined}>
      {children}
    </HomeFontContext.Provider>
  );
}

export function useHomeFont() {
  return useContext(HomeFontContext);
}
