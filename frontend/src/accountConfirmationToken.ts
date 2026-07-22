import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

export function useAccountConfirmationToken() {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get('token') ?? '',
  );

  useEffect(() => {
    if (!location.hash) return;
    void navigate(
      { pathname: location.pathname, search: location.search, hash: '' },
      { replace: true },
    );
  }, [location.hash, location.pathname, location.search, navigate]);

  return token;
}
