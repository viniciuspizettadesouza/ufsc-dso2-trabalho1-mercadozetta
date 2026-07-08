import { Link, useLocation, useNavigate } from 'react-router';

import logo from '../../assets/logo.svg'
import { appRoutes } from '../../routes';

type StoredUser = {
    _id?: string;
    email?: string;
    username?: string;
    telephone?: string;
};

type HeaderProps = {
    hideLoginAction?: boolean;
};

function getStoredUser(): StoredUser | null {
    const storedUser = localStorage.getItem('user');

    if (!storedUser) {
        return null;
    }

    try {
        return JSON.parse(storedUser);
    } catch {
        localStorage.removeItem('user');
        return null;
    }
}

const Header = ({ hideLoginAction = false }: HeaderProps) => {
    const navigate = useNavigate();
    const location = useLocation();
    const user = getStoredUser();

    function handleLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate(appRoutes.home);
    }

    function handleLogin() {
        navigate(appRoutes.login);
    }

    return (
        <header className="flex w-full box-border items-center justify-between bg-[#fff159] max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-3 max-[700px]:pb-4">
            <Link to="/">
                <img className="h-[100px] bg-[#fff159] pl-[100px] max-[700px]:pl-5" src={logo} alt="logo" />
            </Link>

            {user ? (
                <div className="mr-[100px] flex items-center gap-4 text-[#333] max-[700px]:mx-5 max-[700px]:items-start">
                    <div className="flex flex-col items-end leading-[1.3] max-[700px]:items-start">
                        <strong className="text-base">{user.username || 'Logged user'}</strong>
                        {user.email && <span>{user.email}</span>}
                        {user.telephone && <span>{user.telephone}</span>}
                    </div>
                    <button
                        className="h-10 cursor-pointer rounded border-0 bg-[#3483fa] px-4 text-sm font-bold text-white"
                        type="button"
                        onClick={handleLogout}
                    >
                        Logout
                    </button>
                </div>
            ) : !hideLoginAction && location.pathname !== appRoutes.login && (
                <div className="mr-[100px] flex items-center gap-4 text-[#333] max-[700px]:mx-5 max-[700px]:items-start">
                    <button
                        className="h-10 cursor-pointer rounded border-0 bg-[#3483fa] px-4 text-sm font-bold text-white"
                        type="button"
                        onClick={handleLogin}
                    >
                        Login
                    </button>
                </div>
            )}
        </header>
    );
};

export default Header
