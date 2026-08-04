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
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <img 
            src="/images/logo.png" 
            alt="Logo Paletería" 
            style={{ width: '120px', height: '120px', objectFit: 'contain', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))' }} 
            onError={(e) => e.target.style.display = 'none'} 
          />
        </div>
        <h2>¡Bienvenid@!</h2>
        <p>Ingresa la clave para comenzar.</p>
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
          {error && <span className="error-text">La clave es incorrecta, intenta de nuevo.</span>}
          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
