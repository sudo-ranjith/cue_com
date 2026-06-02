import { useEffect } from 'react';

interface PageTitleProps {
  title: string;
  suffix?: string;
}

export function PageTitle({ title, suffix = 'CueCom' }: PageTitleProps) {
  useEffect(() => {
    document.title = suffix ? `${title} | ${suffix}` : title;
    return () => {
      document.title = 'CueCom';
    };
  }, [title, suffix]);

  return null;
}
