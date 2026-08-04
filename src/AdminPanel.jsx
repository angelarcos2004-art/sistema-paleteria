import React, { useState } from 'react';
import CierreDiario from './CierreDiario';
import CierreMensual from './CierreMensual';
import './AdminPanel.css';

// Componente transaccional para agrupar controles administrativos.
export default function AdminPanel({ onClose, isEditMode, setIsEditMode }) {
  // Estado local para delegar el montaje del componente de cierre diario.
  const [isClosing, setIsClosing] = useState(false);

  return (
    <div className="admin-overlay">
      <div className="admin-modal">
        <div className="admin-header">
          <h2>Configuración</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="admin-body">
          <p className="admin-description">
            Desde aquí puedes cambiar precios, agregar sabores y ver las ventas.
          </p>
          <button 
            className={`admin-action-btn edit-mode-btn ${isEditMode ? 'active' : ''}`}
            onClick={() => setIsEditMode(prev => !prev)}
          >
            {isEditMode ? 'Terminar de Editar' : 'Editar Precios y Sabores'}
          </button>
          
          <button 
            className="admin-action-btn cierre-btn"
            onClick={() => setIsClosing(true)}
          >
            Hacer Corte del Día
          </button>
          
          <CierreMensual />
        </div>
      </div>
      {/* Montaje condicional del componente de cierre en una capa superior */}
      {isClosing && <CierreDiario onClose={() => setIsClosing(false)} />}
    </div>
  );
}
