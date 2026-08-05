import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchRecentClosures, fetchSalesByCloseId } from './services/cierreService';
import './CierreDiario.css';

export default function HistorialCortes({ onClose }) {
  const [closures, setClosures] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estado para el cierre específico seleccionado
  const [selectedCloseData, setSelectedCloseData] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  useEffect(() => {
    const loadHistory = async () => {
      const data = await fetchRecentClosures(30); // Últimos 30 cierres
      setClosures(data);
      setIsLoading(false);
    };
    loadHistory();
  }, []);

  const handleSelectClose = async (cierre) => {
    setIsLoadingDetail(true);
    try {
      const salesLog = await fetchSalesByCloseId(cierre.id);

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
      
      const tableRows = Object.values(groupedData).map(item => [
        item.name,
        item.qty.toString(),
        `$${item.subtotal.toFixed(2)}`
      ]);

      const courtesyRows = Object.values(courtesyData).map(item => [
        item.name,
        item.qty.toString()
      ]);

      setSelectedCloseData({
        tableRows,
        courtesyRows,
        expected: Number(cierre.total_esperado),
        actual: Number(cierre.efectivo_real),
        diff: Number(cierre.diferencia),
        id: cierre.id,
        fecha: new Date(cierre.cerrado_en).toLocaleString()
      });
    } catch (error) {
      console.error('Error al cargar detalle del cierre:', error);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const generatePDF = () => {
    if (!selectedCloseData) return;
    const { tableRows, courtesyRows, expected, actual, diff, id, fecha } = selectedCloseData;
    
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Reporte de Cierre Diario (Histórico)", 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Fecha del Corte: ${fecha}`, 14, 30);
    doc.text(`ID de Cierre: ${id}`, 14, 38);

    autoTable(doc, {
      startY: 45,
      head: [['Sabor', 'Cantidad', 'Subtotal']],
      body: tableRows,
    });

    let finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || 45;

    if (courtesyRows.length > 0) {
      autoTable(doc, {
        startY: finalY + 10,
        head: [['Sabor (Cortesía)', 'Cantidad Regalada']],
        body: courtesyRows,
        headStyles: { fillColor: [33, 150, 243] }
      });
      finalY = doc.lastAutoTable.finalY;
    }

    doc.text(`Total Esperado: $${expected.toFixed(2)}`, 14, finalY + 15);
    doc.text(`Efectivo Real: $${actual.toFixed(2)}`, 14, finalY + 23);
    doc.text(`Desfase: $${diff.toFixed(2)}`, 14, finalY + 31);

    doc.save(`cierre_historico_${id}.pdf`);
  };

  return (
    <div className="historial-container">
        
        {selectedCloseData ? (
          <div className="cierre-success" style={{ maxHeight: '70vh', overflowY: 'auto', textAlign: 'left', padding: '1rem', width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ textAlign: 'center', color: '#1976d2', marginTop: 0, marginBottom: '0.5rem' }}>Detalle del Corte</h3>
            <p style={{ textAlign: 'center', color: '#555', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{selectedCloseData.fecha}</p>
            
            <div style={{ overflowX: 'auto' }}>
              <table className="summary-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.9rem', minWidth: '300px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'left' }}>Sabor</th>
                    <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Cant.</th>
                    <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCloseData.tableRows.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{row[0]}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'center' }}>{row[1]}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{row[2]}</td>
                    </tr>
                  ))}
                  {selectedCloseData.tableRows.length === 0 && (
                    <tr><td colSpan="3" style={{ textAlign: 'center', padding: '10px' }}>Sin ventas registradas</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedCloseData.courtesyRows.length > 0 && (
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
                    {selectedCloseData.courtesyRows.map((row, idx) => (
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
                <strong>${selectedCloseData.expected.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#555' }}>Efectivo en Caja:</span>
                <strong>${selectedCloseData.actual.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #ddd', color: selectedCloseData.diff < 0 ? '#d32f2f' : (selectedCloseData.diff > 0 ? '#388e3c' : '#333') }}>
                <strong>{selectedCloseData.diff < 0 ? 'Faltante:' : (selectedCloseData.diff > 0 ? 'Sobrante:' : 'Diferencia:')}</strong>
                <strong>${selectedCloseData.diff.toFixed(2)}</strong>
              </div>
            </div>

            <div className="cierre-actions" style={{ marginTop: '2rem' }}>
              <button className="cierre-button secondary" onClick={generatePDF} style={{ flex: 1, padding: '0.8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Descargar PDF
              </button>
              <button className="cierre-button primary" onClick={() => setSelectedCloseData(null)} style={{ flex: 1, padding: '0.8rem' }}>Volver a la Lista</button>
            </div>
          </div>
        ) : (
          <div className="cierre-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {isLoading ? (
              <p style={{ textAlign: 'center' }}>Cargando historial...</p>
            ) : closures.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#888' }}>No hay cortes registrados todavía.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {closures.map(cierre => {
                  const fecha = new Date(cierre.cerrado_en);
                  const diff = Number(cierre.diferencia);
                  return (
                    <li key={cierre.id} style={{ padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fcfcfc', borderRadius: '8px', marginBottom: '8px', border: '1px solid #e0e0e0' }}>
                      <div>
                        <strong style={{ display: 'block', fontSize: '1rem', color: '#333' }}>
                          {fecha.toLocaleDateString()} - {fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </strong>
                        <span style={{ fontSize: '0.85rem', color: '#666' }}>Esperado: ${Number(cierre.total_esperado).toFixed(2)}</span>
                        <span style={{ display: 'block', fontSize: '0.85rem', color: diff < 0 ? '#d32f2f' : (diff > 0 ? '#388e3c' : '#555'), fontWeight: 'bold' }}>
                          Dif: ${diff.toFixed(2)}
                        </span>
                      </div>
                      <button 
                        className="cierre-button primary" 
                        style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                        onClick={() => handleSelectClose(cierre)}
                        disabled={isLoadingDetail}
                      >
                        {isLoadingDetail ? '...' : 'Ver Detalle'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
    </div>
  );
}
