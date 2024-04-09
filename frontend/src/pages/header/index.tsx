import { Link } from 'react-router-dom';
import './index.css';

import logo from '../../assets/logo.svg'

const Header = () => (
    <header className="header">
        <Link to="/">
            <img src={logo} alt="logo" />
        </Link>
    </header>
)

export default Header