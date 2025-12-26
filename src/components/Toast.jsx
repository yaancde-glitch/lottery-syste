import { useEffect, useState } from 'react';

// Toast 管理器 - 单例模式
class ToastManager {
  constructor() {
    this.listeners = new Set();
    this.idCounter = 0;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(toast) {
    const id = ++this.idCounter;
    const toastWithId = { ...toast, id };
    this.listeners.forEach(listener => listener(toastWithId));
  }

  success(message, duration = 2000) {
    this.notify({ type: 'success', message, duration });
  }

  error(message, duration = 3000) {
    this.notify({ type: 'error', message, duration });
  }

  info(message, duration = 2000) {
    this.notify({ type: 'info', message, duration });
  }

  delete(message, duration = 2000) {
    this.notify({ type: 'delete', message, duration });
  }
}

export const toastManager = new ToastManager();

// Toast 组件
export default function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = toastManager.subscribe((toast) => {
      setToasts(prev => [...prev, toast]);

      // 自动移除
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, toast.duration);
    });

    return unsubscribe;
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const getToastStyles = (type) => {
    const baseStyles = 'backdrop-blur-md border shadow-xl flex items-center gap-3 animate-slideDown';

    switch (type) {
      case 'success':
        return `${baseStyles} bg-green-900/80 border-green-500/30 text-green-100`;
      case 'error':
        return `${baseStyles} bg-red-900/80 border-red-500/30 text-red-100`;
      case 'delete':
        return `${baseStyles} bg-slate-800/90 border-red-500/30 text-gray-100`;
      default:
        return `${baseStyles} bg-slate-800/90 border-yellow-500/30 text-yellow-100`;
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'delete':
        return (
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${getToastStyles(toast.type)} px-6 py-3 rounded-full min-w-[200px] max-w-md pointer-events-auto`}
          onClick={() => removeToast(toast.id)}
        >
          {getIcon(toast.type)}
          <span className="font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
