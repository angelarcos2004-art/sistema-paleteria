import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import CierreDiario from './CierreDiario';
import ControlFinanciero from './ControlFinanciero';
import './AdminPanel.css';

// Componente transaccional para agrupar controles administrativos.
export default function AdminPanel({ onClose, isEditMode, setIsEditMode, isCourtesyMode, setIsCourtesyMode }) {
  // Estado local para delegar el montaje del componente de cierre diario.
  const [isClosing, setIsClosing] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isControlFinancieroOpen, setIsControlFinancieroOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error al cerrar sesión', error);
    }
  };

  return (
    <div className="admin-overlay">
      <div className="admin-modal">
        <div className="admin-header">
          <h2>Configuración</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="admin-body">
          <p className="admin-description">Administra el inventario, ajusta precios y supervisa los ingresos y cortes diarios.</p>
          <div className="admin-grid">
            <button 
              className={`admin-grid-btn edit-mode-btn ${isEditMode ? 'active' : ''}`}
              onClick={() => {
                setIsEditMode(prev => !prev);
                onClose(); // Cerrar panel para ir directo a la caja a editar
              }}
            >
              <span className="grid-icon">🍧</span>
              {isEditMode ? 'Terminar Edición' : 'Precios y Sabores'}
            </button>

            <button 
              className={`admin-grid-btn courtesy-btn ${isCourtesyMode ? 'active' : ''}`}
              onClick={() => {
                setIsCourtesyMode(prev => !prev);
                onClose(); // Cerrar panel para ir directo a la caja a regalar
              }}
            >
              <span className="grid-icon">🎁</span>
              {isCourtesyMode ? 'Cortesías Activas' : 'Modo Cortesía'}
            </button>
            
            <button 
              className="admin-grid-btn cierre-btn"
              onClick={() => setIsClosing(true)}
            >
              <span className="grid-icon">💵</span>
              Cortes Diarios
            </button>
            
            <button 
              className="admin-grid-btn finanzas-btn"
              onClick={() => setIsControlFinancieroOpen(true)}
            >
              <span className="grid-icon">📊</span>
              Control Financiero
            </button>
          </div>
          
          <div className="admin-footer-actions">
            <button 
              className="admin-action-btn logout-btn"
              onClick={() => setIsLogoutConfirmOpen(true)}
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
      {/* Montaje condicional del componente de cierre en una capa superior */}
      {isClosing && <CierreDiario onClose={() => setIsClosing(false)} />}

      {/* Montaje condicional del componente de Control Financiero */}
      {isControlFinancieroOpen && <ControlFinanciero onClose={() => setIsControlFinancieroOpen(false)} />}
      
      {/* Modal de confirmación para cerrar sesión */}
      {isLogoutConfirmOpen && (
        <div className="custom-prompt-overlay" style={{ zIndex: 1000 }}>
          <div className="custom-prompt-modal" style={{ border: '2px solid #ef9a9a' }}>
            <h3 style={{ marginTop: 0, color: '#d32f2f' }}>¿Cerrar Sesión?</h3>
            <p>¿Estás seguro de que deseas cerrar la sesión actual?</p>
            <div className="custom-prompt-actions">
              <button className="prompt-cancel-btn" onClick={() => setIsLogoutConfirmOpen(false)}>Cancelar</button>
              <button className="prompt-confirm-btn" style={{ backgroundColor: '#ef9a9a', color: 'var(--text-dark)' }} onClick={handleLogout}>Cerrar Sesión</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
