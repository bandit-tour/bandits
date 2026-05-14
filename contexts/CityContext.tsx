import { supabase } from '@/lib/supabase';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

interface CityContextType {
  selectedCity: string;
  setSelectedCity: (city: string) => void;
}

const noop = () => {};
const CityContext = createContext<CityContextType>({
  selectedCity: '',
  setSelectedCity: noop,
});

export const useCity = () => {
  return useContext(CityContext);
};

interface CityProviderProps {
  children: ReactNode;
}

/**
 * `selectedCity` drives bandiTEAM / Explore scoping. Synced from `user_profile.city` when the user
 * is signed in so "destination" is never stuck empty after profile save.
 */
export const CityProvider: React.FC<CityProviderProps> = ({ children }) => {
  const [selectedCity, setSelectedCity] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setSelectedCity('');
          return;
        }
        const { data, error } = await supabase.from('user_profile').select('city').eq('id', user.id).maybeSingle();
        if (error) return;
        const c = String((data as { city?: string } | null)?.city || '').trim();
        if (c) setSelectedCity(c);
      } catch {
        /* keep prior */
      }
    };
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void load());
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // Memoize the provider value so consumers (Explore, mySpots, etc.) don't
  // re-render on every CityProvider re-render. Without this, the outer
  // AppStateProvider's polling-driven re-renders cascade into every screen
  // that calls `useCity()`.
  const value = useMemo<CityContextType>(
    () => ({ selectedCity, setSelectedCity }),
    [selectedCity],
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
};
