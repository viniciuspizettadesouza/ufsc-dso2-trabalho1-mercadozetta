import React from 'react';
import './Main.css';

import logo from '../assets/logo.svg'

export default function Main({ match }) {
    return (
        <div className="main-container">
            <img src={logo} alt="logo" />
            <ul>
                <li>
                    <img src="https://www.gsuplementos.com.br/upload/produto/imagem/creatina-250g-creapure-growth-supplements.jpg" alt="creatina" />
                    <footer>
                        <strong>CREATINA (250G) (CREAPURE®) - GROWTH SUPPLEMENTS</strong>
                        <p>GROWTH SUPPLEMENTS</p>
                    </footer>
                </li>
                <li>
                    <img src="http://images.tcdn.com.br/img/img_prod/499313/creatina_powder_200g_universal_nutrition_520_1_20170921103339.jpg" alt="creatina" />
                    <footer>
                        <strong>Creatina 400 g - Universal</strong>
                        <p>É US GURI</p>
                        <p>TO DE HORROR</p>
                    </footer>
                </li>
                <li>
                    <img src="http://images.tcdn.com.br/img/img_prod/499313/creatina_powder_200g_universal_nutrition_520_1_20170921103339.jpg" alt="creatina" />
                    <footer>
                        <strong>Creatina 400 g - Universal</strong>
                        <p>É US GURI</p>
                        <p>TO DE HORROR</p>
                    </footer>
                </li>
                <li>
                    <img src="http://images.tcdn.com.br/img/img_prod/499313/creatina_powder_200g_universal_nutrition_520_1_20170921103339.jpg" alt="creatina" />
                    <footer>
                        <strong>Creatina 400 g - Universal</strong>
                        <p>É US GURI</p>
                        <p>TO DE HORROR</p>
                    </footer>
                </li>
            </ul>
        </div>

    );
}
