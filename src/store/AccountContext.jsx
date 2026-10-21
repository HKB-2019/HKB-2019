import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { accountMe, accountLogout, accountRenew } from '../lib/api.js';

/* Who is signed in, for every page: the header's person icon, checkout's
 * details, the account pages. `status`:
 *   loading   asking the server
 *   in        signed in (`account` is theirs)
 *   out       signed out
 *   off       the shop does not offer accounts (it cannot send email yet)
 * The session warning before a sign-in ends lives in ShopLayout. */

const AccountContext = createContext(null);

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used inside <AccountProvider>');
  return ctx;
}

export function AccountProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState('loading');
  // Why they were signed out, when it was not their own doing ('expired').
  const [endedBy, setEndedBy] = useState(null);

  const refresh = useCallback(async () => {
    try { const me = await accountMe(); setAccount(me); setStatus('in'); return me; }
    catch (err) {
      setAccount(null);
      setStatus(err.status === 404 ? 'off' : 'out');
      return null;
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signedIn = useCallback((me) => { setAccount(me); setStatus('in'); setEndedBy(null); }, []);
  const signOut = useCallback(async () => {
    await accountLogout().catch(() => {});
    setAccount(null); setStatus('out');
  }, []);
  const ended = useCallback(() => { setAccount(null); setStatus('out'); setEndedBy('expired'); }, []);
  const stay = useCallback(async () => {
    const { expiresAt } = await accountRenew();
    setAccount(a => (a ? { ...a, expiresAt } : a));
    return expiresAt;
  }, []);

  const value = useMemo(() => ({ account, status, endedBy, setAccount, refresh, signedIn, signOut, ended, stay }),
    [account, status, endedBy, refresh, signedIn, signOut, ended, stay]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

/** "KB" for Kehinde Balogun. */
export const initialsOf = (name = '', email = '') =>
  (name.trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('') || email[0] || '?').toUpperCase();
