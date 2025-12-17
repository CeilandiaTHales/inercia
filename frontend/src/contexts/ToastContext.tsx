
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CheckCircle, Zap, XCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastData {
  id: number;
  msg: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (msg: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Fix: Change children to optional to resolve JSX children mapping issue in some TypeScript environments
export const ToastProvider = ({ children }: { children?: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = (msg: string, type: ToastType = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-6 right-6 z-[150] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div 
            key={t.id} 
            className={`pointer-events-auto px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-bounce-in transition-all ${
              t.type === 'success' ? 'bg-emerald-600 text-white' : 
              t.type === 'error' ? 'bg-red-600 text-white' : 
              'bg-blue-600 text-white'
            }`}
          >
            {t.type === 'success' && <CheckCircle size={20} />}
            {t.type === 'error' && <Zap size={20} />}
            {t.type === 'info' && <Info size={20} />}
            <span className="font-bold text-sm">{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
