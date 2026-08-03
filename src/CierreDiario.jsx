import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchExpectedTotal, executeDailyClose, fetchSalesByCloseId } from './services/cierreService';
import './CierreDiario.css';

export default function CierreDiario({ onClose }) {
  // Estados transaccionales correspondientes al proceso de cierre.
  const [expectedTotal, setExpectedTotal] = useState(0);
  const [actualCash, setActualCash] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // Derivacion reactiva de la diferencia matematica en tiempo de renderizado.
  const numericActualCash = parseFloat(actualCash) || 0;
  const difference = numericActualCash - expectedTotal;

  // Montaje del componente que dispara la agregacion de ventas pendientes.
  useEffect(() => {
    const initializeData = async () => {
      try {
        const total = await fetchExpectedTotal();
        setExpectedTotal(total);
      } catch (error) {
        console.error('Fallo recuperando el total esperado:', error);
      }
    };
    initializeData();
  }, []);

  // Procesa el comando del usuario para ejecutar transacciones hacia Supabase y renderizar el reporte.
  const handleFinalize = async () => {
    if (actualCash === '') return;
    setIsProcessing(true);
    try {
      // 1. Efectua la insercion del cierre y la mutacion referencial en cascada.
      const closeId = await executeDailyClose(expectedTotal, numericActualCash, difference);
      
      // 2. Extrae las ventas confirmadas atadas a este nodo relacional para el reporte.
      const salesLog = await fetchSalesByCloseId(closeId);

      // Reduccion de los datos tubulares a una estructura apta para renderizado tabular (frecuencia).
      const groupedData = salesLog.reduce((acc, sale) => {
        const flavorStr = sale.sabor;
        if (!acc[flavorStr]) {
          acc[flavorStr] = { name: flavorStr, qty: 0, subtotal: 0 };
        }
        acc[flavorStr].qty += 1;
        acc[flavorStr].subtotal += Number(sale.precio);
        return acc;
      }, {});
      
      // Conversion de la tabla hash a un vector dimensional (Array de Arrays) requerido por autotable.
      const tableRows = Object.values(groupedData).map(item => [
        item.name,
        item.qty.toString(),
        `$${item.subtotal.toFixed(2)}`
      ]);

      // 3. Instanciacion de jsPDF y construccion del buffer del documento PDF.
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("Reporte de Cierre Diario", 14, 22);
      
      doc.setFontSize(12);
      doc.text(`Fecha de emision: ${new Date().toLocaleString()}`, 14, 30);
      doc.text(`ID de Cierre (Referencia): ${closeId}`, 14, 38);

      autoTable(doc, {
        startY: 45,
        head: [['Sabor', 'Cantidad', 'Subtotal']],
        body: tableRows,
      });

      // Anexado del balance financiero al final del reporte tabular.
      const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || 45;
      doc.text(`Total Esperado: $${expectedTotal.toFixed(2)}`, 14, finalY + 15);
      doc.text(`Efectivo Real (Caja): $${numericActualCash.toFixed(2)}`, 14, finalY + 23);
      doc.text(`Desfase (Merma/Excedente): $${difference.toFixed(2)}`, 14, finalY + 31);

      // Desencadena el guardado nativo del archivo binario.
      doc.save(`cierre_diario_${closeId}.pdf`);

      setIsDone(true);
    } catch (error) {
      console.error('Fallo en la finalizacion del cierre o generacion de PDF:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="cierre-overlay">
      <div className="cierre-modal">
        <h2>Cierre Diario</h2>
        
        {isDone ? (
          <div className="cierre-success">
            <p>El cierre de caja ha sido procesado exitosamente.</p>
            <button className="cierre-button primary" onClick={onClose}>Aceptar</button>
          </div>
        ) : (
          <div className="cierre-body">
            <div className="metric-box">
              <span className="metric-label">Total Esperado</span>
              <span className="metric-value">${expectedTotal.toFixed(2)}</span>
            </div>

            <div className="input-group">
              <label htmlFor="actualCash">Efectivo Real (Caja)</label>
              <input 
                id="actualCash"
                type="number" 
                step="0.01"
                min="0"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                disabled={isProcessing}
                placeholder="0.00"
              />
            </div>

            <div className={`metric-box difference-box ${difference < 0 ? 'deficit' : 'surplus'}`}>
              <span className="metric-label">Diferencia</span>
              <span className="metric-value">${difference.toFixed(2)}</span>
            </div>

            <div className="cierre-actions">
              <button 
                className="cierre-button secondary" 
                onClick={onClose} 
                disabled={isProcessing}
              >
                Cancelar
              </button>
              <button 
                className="cierre-button primary" 
                onClick={handleFinalize} 
                disabled={isProcessing || actualCash === ''}
              >
                {isProcessing ? 'Guardando cierre...' : 'Finalizar Cierre'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
