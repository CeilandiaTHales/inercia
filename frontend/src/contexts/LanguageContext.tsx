
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { translations } from '../translations';

type Language = 'pt' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.pt;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Fix: Change children to optional to resolve JSX children mapping issue in some TypeScript environments
export const LanguageProvider = ({ children }: { children?: ReactNode }) => {
  // Default to Portuguese
  const [language, setLanguage] = useState<Language>('pt');

  const value = {
    language,
    setLanguage,
    t: translations[language]
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
