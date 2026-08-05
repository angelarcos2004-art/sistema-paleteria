import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchExpectedTotal, executeDailyClose, fetchSalesByCloseId } from './services/cierreService';
import HistorialCortes from './HistorialCortes';
import './CierreDiario.css';

export default function CierreDiario({ onClose }) {
  const [activeTab, setActiveTab] = useState('hacer-corte');
  // Estados transaccionales correspondientes al proceso de cierre.
  const [expectedTotal, setExpectedTotal] = useState(0);
  const [actualCash, setActualCash] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [reportData, setReportData] = useState(null);

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

      // Reduccion de los datos tubulares a una estructura apta para renderizado tabular, separando normales de cortesía.
      const groupedData = {};
      const courtesyData = {};

      salesLog.forEach(sale => {
        const flavorStr = sale.sabor;
        const isCourtesy = Number(sale.precio) === 0;

        if (isCourtesy) {
          if (!courtesyData[flavorStr]) courtesyData[flavorStr] = { name: flavorStr, qty: 0 };
          courtesyData[flavorStr].qty += 1;
        } else {
          if (!groupedData[flavorStr]) groupedData[flavorStr] = { name: flavorStr, qty: 0, subtotal: 0 };
          groupedData[flavorStr].qty += 1;
          groupedData[flavorStr].subtotal += Number(sale.precio);
        }
      });
      
      // Conversion a vectores para autoTable
      const tableRows = Object.values(groupedData).map(item => [
        item.name,
        item.qty.toString(),
        `$${item.subtotal.toFixed(2)}`
      ]);

      const courtesyRows = Object.values(courtesyData).map(item => [
        item.name,
        item.qty.toString()
      ]);

      // Almacenamos los datos para renderizar el resumen en pantalla y permitir descarga manual
      setReportData({
        tableRows,
        courtesyRows,
        expected: expectedTotal,
        actual: numericActualCash,
        diff: difference,
        id: closeId
      });

      setIsDone(true);
    } catch (error) {
      console.error('Fallo en la finalizacion del cierre:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const generatePDF = () => {
    if (!reportData) return;
    const { tableRows, courtesyRows, expected, actual, diff, id } = reportData;
    
    // 3. Instanciacion de jsPDF y construccion del buffer del documento PDF.
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Reporte de Cierre Diario", 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Fecha de emisión: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`ID de Cierre (Referencia): ${id}`, 14, 38);

    autoTable(doc, {
      startY: 45,
      head: [['Sabor (Ventas Normales)', 'Cantidad', 'Subtotal']],
      body: tableRows,
    });

    let finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || 45;

    if (courtesyRows.length > 0) {
      autoTable(doc, {
        startY: finalY + 10,
        head: [['Sabor (Cortesía)', 'Cantidad Regalada']],
        body: courtesyRows,
        headStyles: { fillColor: [33, 150, 243] } // Azul para distinguirlo
      });
      finalY = doc.lastAutoTable.finalY;
    }

    // Anexado del balance financiero al final del reporte tabular.
    doc.text(`Total Esperado: $${expected.toFixed(2)}`, 14, finalY + 15);
    doc.text(`Efectivo Real: $${actual.toFixed(2)}`, 14, finalY + 23);
    doc.text(`Desfase: $${diff.toFixed(2)}`, 14, finalY + 31);

    // Desencadena el guardado nativo del archivo binario.
    doc.save(`cierre_diario_${id}.pdf`);
  };

  return (
    <div className="cierre-overlay">
      <div className="cierre-modal" style={{ maxWidth: activeTab === 'historial' ? '600px' : '450px', width: '90%' }}>
        <div className="admin-header">
          <h2>Cortes de Caja Diarios</h2>
          <button className="close-btn" onClick={onClose} style={{ top: '15px', right: '20px' }}>&times;</button>
        </div>
        
        <div className="financial-tabs" style={{ marginBottom: '1.5rem', marginTop: '1rem' }}>
          <button 
            className={`tab-btn ${activeTab === 'hacer-corte' ? 'active' : ''}`}
            onClick={() => setActiveTab('hacer-corte')}
          >
            Hacer Corte
          </button>
          <button 
            className={`tab-btn ${activeTab === 'historial' ? 'active' : ''}`}
            onClick={() => setActiveTab('historial')}
          >
            Historial de Cortes
          </button>
        </div>
        
        {activeTab === 'hacer-corte' && (
          <>
          {isDone && reportData ? (
          <div className="cierre-success" style={{ maxHeight: '70vh', overflowY: 'auto', textAlign: 'left', padding: '1rem', width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ textAlign: 'center', color: '#4caf50', marginTop: 0, marginBottom: '0.5rem' }}>¡Cierre Exitoso!</h3>
            <p style={{ textAlign: 'center', color: '#555', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Resumen de ventas del día</p>
            
            <table className="summary-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'left' }}>Sabor</th>
                  <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Cant.</th>
                  <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {reportData.tableRows.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{row[0]}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'center' }}>{row[1]}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {reportData.courtesyRows.length > 0 && (
              <>
                <h4 style={{ color: '#1976d2', marginTop: '1rem', marginBottom: '0.5rem' }}>Cortesías Entregadas</h4>
                <table className="summary-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#e3f2fd' }}>
                      <th style={{ padding: '8px', borderBottom: '2px solid #90caf9', color: '#1565c0', textAlign: 'left' }}>Sabor</th>
                      <th style={{ padding: '8px', borderBottom: '2px solid #90caf9', color: '#1565c0', textAlign: 'center' }}>Regaladas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.courtesyRows.map((row, idx) => (
                      <tr key={`c-${idx}`}>
                        <td style={{ padding: '8px', borderBottom: '1px solid #bbdefb' }}>{row[0]}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #bbdefb', textAlign: 'center' }}>{row[1]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', marginTop: '1rem', border: '1px solid #eee' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#555' }}>Total Esperado:</span>
                <strong>${reportData.expected.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#555' }}>Efectivo en Caja:</span>
                <strong>${reportData.actual.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #ddd', color: reportData.diff < 0 ? '#d32f2f' : (reportData.diff > 0 ? '#388e3c' : '#333') }}>
                <strong>{reportData.diff < 0 ? 'Faltante:' : (reportData.diff > 0 ? 'Sobrante:' : 'Diferencia:')}</strong>
                <strong>${reportData.diff.toFixed(2)}</strong>
              </div>
            </div>

            <div className="cierre-actions" style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
              <button className="cierre-button secondary" onClick={generatePDF} style={{ flex: 1, padding: '0.8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Descargar PDF
              </button>
              <button className="cierre-button primary" onClick={onClose} style={{ flex: 1, padding: '0.8rem' }}>Listo</button>
            </div>
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
          </>
        )}

        {activeTab === 'historial' && (
          <HistorialCortes onClose={onClose} />
        )}
      </div>
    </div>
  );
}
