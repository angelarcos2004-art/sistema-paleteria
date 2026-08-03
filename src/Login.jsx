import React, { useState } from 'react';
import './Login.css';

import { supabase } from './supabaseClient';

export default function Login({ onLoginSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(false);
    
    // Autenticacion real con el servidor de Supabase
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: 'acceso@paleteria.com',
      password: password
    });

    setIsLoading(false);

    if (authError || !data.session) {
      setError(true);
      setPassword('');
    } else {
      onLoginSuccess(data.session);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Acceso Restringido</h2>
        <p>Por favor ingresa la contraseña para entrar al sistema de la paletería.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            placeholder="Contraseña"
            className={error ? 'input-error' : ''}
            autoFocus
          />
          {error && <span className="error-text">Contraseña incorrecta</span>}
          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? 'Autenticando...' : 'Entrar al Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
