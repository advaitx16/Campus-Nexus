'use client';
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';
const ThemeCtx = createContext<{ theme: Theme; toggle: (e?: React.MouseEvent) => void }>({ theme: 'dark', toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('cn_theme') as Theme | null;
    const preferred = saved ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(preferred);
    document.documentElement.classList.toggle('dark', preferred === 'dark');
  }, []);

  const toggle = (e?: React.MouseEvent) => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    
    // Telegram-like expanding circle view transition
    if ((document as any).startViewTransition && e) {
      const x = e.clientX;
      const y = e.clientY;
      const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      
      const transition = (document as any).startViewTransition(() => {
        setTheme(next);
        localStorage.setItem('cn_theme', next);
        document.documentElement.classList.toggle('dark', next === 'dark');
      });

      transition.ready.then(() => {
        const clipPath = [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`
        ];
        document.documentElement.animate(
          {
            clipPath: next === 'dark' ? clipPath : clipPath.reverse(),
          },
          {
            duration: 400,
            easing: 'ease-in-out',
            pseudoElement: next === 'dark' ? '::view-transition-new(root)' : '::view-transition-old(root)',
          }
        );
      });
    } else {
      setTheme(next);
      localStorage.setItem('cn_theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
    }
  };

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
