import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { useBrand } from '@/brands/brandContext';
import { appRoutes } from '@/routes';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/Button';
import { useLogout } from '@/serverState/auth';
import { useUnreadNotificationCount } from '@/serverState/notifications';

type HeaderProps = {
  hideLoginAction?: boolean;
};

const Header = ({ hideLoginAction = false }: HeaderProps) => {
  const brand = useBrand();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearSession } = useAuth();
  const logout = useLogout();
  const clearSessionAfterLogout = Boolean(
    (location.state as { clearSessionAfterLogout?: boolean } | null)
      ?.clearSessionAfterLogout,
  );

  useEffect(() => {
    if (!clearSessionAfterLogout) return;

    clearSession();
    navigate(appRoutes.home, { replace: true, state: null });
  }, [clearSession, clearSessionAfterLogout, navigate]);

  const { data: unreadCount = 0 } = useUnreadNotificationCount(
    user?._id ?? 'anonymous',
    Boolean(user),
  );

  async function handleLogout() {
    try {
      await logout.mutateAsync();
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
    <header className="box-border flex w-full items-center justify-between bg-surface-emphasized max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-3 max-[700px]:pb-4">
      <Link to="/">
        <img
          className="h-[100px] bg-surface-emphasized pl-[100px] max-[700px]:pl-5"
          src={brand.logo}
          alt={`${brand.brandName} logo`}
        />
      </Link>

      {user ? (
        <div className="mr-[100px] flex items-center gap-4 text-content max-[700px]:mx-5 max-[700px]:items-start">
          <Link className="font-bold" to={appRoutes.sellerOrders}>
            Seller orders
          </Link>
          <Link className="font-bold" to={appRoutes.notifications}>
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
          <Button
            aria-busy={logout.isPending}
            className="h-10 px-4 text-sm"
            disabled={logout.isPending}
            variant="primary"
            type="button"
            onClick={handleLogout}
          >
            {brand.copy.header.logoutAction}
          </Button>
        </div>
      ) : (
        !hideLoginAction &&
        location.pathname !== appRoutes.login && (
          <div className="mr-[100px] flex items-center gap-4 text-content max-[700px]:mx-5 max-[700px]:items-start">
            <Button
              className="h-10 px-4 text-sm"
              variant="primary"
              type="button"
              onClick={handleLogin}
            >
              {brand.copy.header.loginAction}
            </Button>
          </div>
        )
      )}
    </header>
  );
};

export default Header;
