import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import PosMenu from './PosMenu';
import Login from './Login';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Verificar si ya existe una sesion de Supabase activa al recargar la pagina
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setIsChecking(false);
    });

    // Escuchar cambios de sesion en caso de caducidad
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  if (isChecking) {
    return <div style={{ background: '#121212', height: '100vh' }}></div>; // Pantalla negra temporal durante la validacion
  }

  return (
    <>
      {isAuthenticated ? (
        <PosMenu />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  );
}

export default App;
