import React, { useState, useEffect } from 'react';
import { fetchPendingSales, deletePendingSale } from './services/cierreService';
import './CierreDiario.css';

export default function VentasActuales() {
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingId, setIsProcessingId] = useState(null);
  const [deleteConfirmConfig, setDeleteConfirmConfig] = useState({ isOpen: false, id: null, sabor: '' });

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    setIsLoading(true);
    const data = await fetchPendingSales();
    setSales(data);
    setIsLoading(false);
  };

  const handleRequestAnular = (id, sabor) => {
    setDeleteConfirmConfig({ isOpen: true, id, sabor });
  };

  const handleConfirmAnular = async () => {
    const { id, sabor } = deleteConfirmConfig;
    setDeleteConfirmConfig({ isOpen: false, id: null, sabor: '' });
    
    setIsProcessingId(id);
    try {
      await deletePendingSale(id);
      // Remove from local state
      setSales(prev => prev.filter(sale => sale.id !== id));
    } catch (error) {
      alert("Hubo un error al intentar anular la venta.");
      console.error(error);
    } finally {
      setIsProcessingId(null);
    }
  };

  return (
    <div className="cierre-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
      <p style={{ textAlign: 'center', color: '#555', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Ventas registradas hoy que aún no forman parte del corte.
      </p>

      {isLoading ? (
        <p style={{ textAlign: 'center' }}>Cargando ventas...</p>
      ) : sales.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#888' }}>No hay ventas registradas todavía.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {Object.values(
            sales.reduce((acc, venta) => {
              const isCourtesy = Number(venta.precio) === 0;
              const key = `${venta.sabor}-${isCourtesy}`;
              if (!acc[key]) {
                acc[key] = {
                  sabor: venta.sabor,
                  isCourtesy,
                  precioUnitario: isCourtesy ? 0 : Number(venta.precio),
                  ids: [],
                  cantidad: 0
                };
              }
              acc[key].ids.push(venta.id);
              acc[key].cantidad += 1;
              return acc;
            }, {})
          ).map(grupo => {
            const totalRow = grupo.cantidad * grupo.precioUnitario;
            const targetId = grupo.ids[0]; // Tomamos el primer ID disponible para anular uno
            
            return (
              <li key={`${grupo.sabor}-${grupo.isCourtesy}`} style={{ padding: '12px 15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: grupo.isCourtesy ? '#e3f2fd' : '#fcfcfc', borderRadius: '8px', marginBottom: '8px', border: grupo.isCourtesy ? '1px solid #bbdefb' : '1px solid #e0e0e0' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '1rem', color: grupo.isCourtesy ? '#1565c0' : '#333' }}>
                    {grupo.sabor} {grupo.isCourtesy && <span style={{ fontSize: '0.8rem' }}>(Cortesía)</span>}
                  </strong>
                  <span style={{ fontSize: '0.85rem', color: '#666' }}>
                    {grupo.cantidad} unidades - Subtotal: ${totalRow.toFixed(2)}
                  </span>
                </div>
                <button 
                  className="cierre-button primary" 
                  style={{ padding: '6px 12px', fontSize: '0.85rem', backgroundColor: '#dc3545', color: 'white', border: 'none' }}
                  onClick={() => handleRequestAnular(targetId, grupo.sabor)}
                  disabled={isProcessingId === targetId}
                >
                  {isProcessingId === targetId ? '...' : '-1 (Anular)'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {deleteConfirmConfig.isOpen && (
        <div className="custom-prompt-overlay" style={{ zIndex: 1000 }}>
          <div className="custom-prompt-modal" style={{ border: '1px solid #dc3545' }}>
            <h3 style={{ marginTop: 0, color: '#dc3545' }}>Confirmar Anulación</h3>
            <p>¿Estás seguro de que deseas anular esta venta de <strong>{deleteConfirmConfig.sabor}</strong>?</p>
            <p style={{ fontSize: '0.9rem', color: '#aaaaaa', marginBottom: '1.5rem' }}>
              Esta acción borrará la venta del registro y no se puede deshacer.
            </p>
            <div className="custom-prompt-actions">
              <button className="prompt-cancel-btn" onClick={() => setDeleteConfirmConfig({ isOpen: false, id: null, sabor: '' })}>Cancelar</button>
              <button className="prompt-delete-btn" onClick={handleConfirmAnular}>Sí, Anular</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
