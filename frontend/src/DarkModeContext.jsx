/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';

export const DarkModeContext = createContext([false, () => {}]);

export const DarkModeProvider = ({ children }) => {
  const [dark, setDark] = useState(() => {
    return localStorage.getItem('djsce-dark-mode') === 'true';
  });

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-bs-theme', 'dark');
      localStorage.setItem('djsce-dark-mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.removeAttribute('data-bs-theme');
      localStorage.setItem('djsce-dark-mode', 'false');
    }
  };

  return (
    <DarkModeContext.Provider value={[dark, toggleDark]}>
      {children}
    </DarkModeContext.Provider>
  );
};

export const useDarkMode = () => useContext(DarkModeContext);
