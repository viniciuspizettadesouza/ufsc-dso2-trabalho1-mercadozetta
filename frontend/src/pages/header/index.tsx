import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { useBrand } from '@/brands/brandContext';
import { apiRoutes, appRoutes } from '@/routes';
import api from '@/services/api';
import { useAuth } from '@/auth/AuthContext';

type HeaderProps = {
  hideLoginAction?: boolean;
};

const Header = ({ hideLoginAction = false }: HeaderProps) => {
  const brand = useBrand();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearSession } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const clearSessionAfterLogout = Boolean(
    (location.state as { clearSessionAfterLogout?: boolean } | null)
      ?.clearSessionAfterLogout,
  );

  useEffect(() => {
    if (!clearSessionAfterLogout) return;

    clearSession();
    navigate(appRoutes.home, { replace: true, state: null });
  }, [clearSession, clearSessionAfterLogout, navigate]);

  useEffect(() => {
    if (!user) return;

    let active = true;
    api
      .get(apiRoutes.unreadNotificationCount)
      .then(({ data }) => {
        if (active) setUnreadCount(data.count);
      })
      .catch(() => {
        // A badge failure must not disrupt the shared navigation.
      });
    return () => {
      active = false;
    };
  }, [user]);

  async function handleLogout() {
    try {
      await api.post(apiRoutes.logout);
    } catch {
      // Local logout must still succeed when the API is unavailable.
    } finally {
      navigate(appRoutes.home, {
        replace: true,
        state: { clearSessionAfterLogout: true },
      });
    }
  }

  function handleLogin() {
    navigate(appRoutes.login);
  }

  return (
    <header className="flex w-full box-border items-center justify-between bg-[var(--brand-primary)] max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-3 max-[700px]:pb-4">
      <Link to="/">
        <img
          className="h-[100px] bg-[var(--brand-primary)] pl-[100px] max-[700px]:pl-5"
          src={brand.logo}
          alt={`${brand.brandName} logo`}
        />
      </Link>

      {user ? (
        <div className="mr-[100px] flex items-center gap-4 text-[var(--brand-text)] max-[700px]:mx-5 max-[700px]:items-start">
          <Link className="font-bold" to={appRoutes.sellerOrders}>
            Seller orders
          </Link>
          <Link className="font-bold" to={appRoutes.admin}>
            Notifications
            {unreadCount > 0 && (
              <span aria-label={`${unreadCount} unread notifications`}>
                {' '}
                ({unreadCount})
              </span>
            )}
          </Link>
          <div className="flex flex-col items-end leading-[1.3] max-[700px]:items-start">
            <strong className="text-base">
              {user.username || brand.copy.header.loggedUserFallback}
            </strong>
            {user.email && <span>{user.email}</span>}
            {user.telephone && <span>{user.telephone}</span>}
          </div>
          <button
            className="h-10 cursor-pointer rounded border-0 bg-[var(--brand-secondary)] px-4 text-sm font-bold text-white"
            type="button"
            onClick={handleLogout}
          >
            {brand.copy.header.logoutAction}
          </button>
        </div>
      ) : (
        !hideLoginAction &&
        location.pathname !== appRoutes.login && (
          <div className="mr-[100px] flex items-center gap-4 text-[var(--brand-text)] max-[700px]:mx-5 max-[700px]:items-start">
            <button
              className="h-10 cursor-pointer rounded border-0 bg-[var(--brand-secondary)] px-4 text-sm font-bold text-white"
              type="button"
              onClick={handleLogin}
            >
              {brand.copy.header.loginAction}
            </button>
          </div>
        )
      )}
    </header>
  );
};

export default Header;
