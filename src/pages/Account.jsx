import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import ShopLayout from '../components/ShopLayout.jsx';
import { useAccount } from '../store/AccountContext.jsx';
import { Loader } from '../components/Notices.jsx';
import { SignIn, SignUp, Verify, Forgot, Reset } from '../components/account/AuthForms.jsx';
import { Overview, Orders, Profile, Security } from '../components/account/AccountArea.jsx';
import { Addresses } from '../components/account/Addresses.jsx';
import { Notifications } from '../components/account/Notifications.jsx';

/* /account and everything under it: signing in and the customer's own pages.
 * The pages for someone signed out send a signed-in visitor to their account;
 * the account's pages send a signed-out one to sign in, and back after. */

const OUT = { '/account/sign-in': SignIn, '/account/sign-up': SignUp, '/account/verify': Verify, '/account/forgot': Forgot, '/account/reset': Reset };
const IN = {
  '/account': Overview, '/account/orders': Orders, '/account/profile': Profile, '/account/addresses': Addresses,
  '/account/security': Security, '/account/notifications': Notifications
};
const TITLES = {
  '/account/sign-in': 'Sign in', '/account/sign-up': 'Create an account', '/account/verify': 'Check your email',
  '/account/forgot': 'Reset your password', '/account/reset': 'New password',
  '/account': 'Your account', '/account/orders': 'Your orders', '/account/profile': 'Profile', '/account/addresses': 'Addresses',
  '/account/security': 'Security', '/account/notifications': 'Notifications'
};

export default function Account() {
  const { pathname, search } = useLocation();
  const { status } = useAccount();
  const path = pathname.replace(/\/+$/, '') || '/account';

  useEffect(() => {
    const was = document.title;
    document.title = `${TITLES[path] ?? 'Your account'} — MASQ.`;
    return () => { document.title = was; };
  }, [path]);

  let body;
  if (status === 'loading') body = <Loader title="Loading your account…" className="acct-loading" />;
  else if (status === 'off') body = <Navigate to="/" replace />;
  else if (OUT[path]) {
    // Resetting a password works signed in or out; the rest is for signed-out visitors.
    const Page = OUT[path];
    body = status === 'in' && path !== '/account/reset' ? <Navigate to="/account" replace /> : <Page />;
  } else if (IN[path]) {
    const Page = IN[path];
    body = status === 'in' ? <Page /> : <Navigate to={`/account/sign-in?next=${encodeURIComponent(path + search)}`} replace />;
  } else body = <Navigate to="/account" replace />;

  return <ShopLayout>{body}</ShopLayout>;
}
