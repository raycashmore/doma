import { useEffect, useState } from 'react';

export function useDesktopViewport() {
  const query = '(min-width: 768px)';
  const read = () => typeof window !== 'undefined' && window.matchMedia(query).matches;
  const [isDesktop, setIsDesktop] = useState(read);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isDesktop;
}
