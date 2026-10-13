import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { scrollToId } from './scroll.js';

/**
 * Go to a section of the home page ("#drop"). On the home page that is a
 * scroll; from a product page it is a trip home, landing on the section.
 */
export function useSectionLink() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return useCallback((hash) => {
    if (pathname === '/') scrollToId(hash);
    else navigate('/' + hash);
  }, [pathname, navigate]);
}
