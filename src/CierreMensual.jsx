import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchMonthlyClosures, fetchMonthlySalesByFlavor, fetchMonthlyInvestments } from './services/cierreMensualService';
import './CierreMensual.css';

// Componente para la renderizacion de metricas agregadas mensuales y graficas de barras.
export default function CierreMensual() {
  const [closures, setClosures] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [courtesyData, setCourtesyData] = useState([]);
  const [totalInvestments, setTotalInvestments] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showDataTables, setShowDataTables] = useState(false);
  
  // Estado local para seleccionar el mes historico a analizar. Por defecto, mes en curso.
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Vector de mapeo hexadecimal para la paleta de colores del grafico de sectores.
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c', '#8dd1e1'];

  // Reduccion escalar de las matrices de datos recuperados para totalizacion de KPIs.
  // Ahora calculamos el ingreso bruto directamente de las ventas reales (salesData) y no de los cortes.
  const totalGrossIncome = salesData.reduce((acc, row) => acc + Number(row.ingresos), 0);
  const totalActualCash = closures.reduce((acc, row) => acc + Number(row.efectivo_real), 0);
  const totalGap = closures.reduce((acc, row) => acc + Number(row.diferencia), 0);

  // Hook de ciclo de vida para sincronizar colecciones desde Supabase cada que cambia el mes seleccionado.
  useEffect(() => {
    const initializeMetrics = async () => {
      setIsLoading(true);
      try {
        // Parseo de la cadena YYYY-MM para inyectar como enteros numericos.
        const [yearStr, monthStr] = targetDate.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10) - 1; // Ajuste a indice cero para constructor Date

        // Ejecucion concurrente para evitar que un query termine antes que el otro y habilite botones prematuramente.
        const [closuresData, dataCombinada, investmentsData] = await Promise.all([
          fetchMonthlyClosures(year, month),
          fetchMonthlySalesByFlavor(year, month),
          fetchMonthlyInvestments(year, month)
        ]);
        setClosures(closuresData);
        setSalesData(dataCombinada.salesData);
        setCourtesyData(dataCombinada.courtesyData);
        setTotalInvestments(investmentsData);
      } catch (error) {
        console.error("Fallo al cargar metricas", error);
      } finally {
        setIsLoading(false);
      }
    };
    initializeMetrics();
  }, [targetDate]);

  // Compila y estructura el buffer binario del reporte gerencial en formato PDF.
  const handleExportPDF = async () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Reporte de Balance Mensual", 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Fecha de emision: ${new Date().toLocaleString()}`, 14, 30);
    
    // Inyeccion de las metricas escalares calculadas.
    doc.text(`Inversión: $${totalInvestments.toFixed(2)}`, 14, 40);
    doc.text(`Ventas: $${totalGrossIncome.toFixed(2)}`, 14, 47);
    const gananciaNetaReal = totalGrossIncome - totalInvestments;
    doc.text(`Ganancia: $${gananciaNetaReal.toFixed(2)}`, 14, 54);
    
    doc.text(`Dinero Físico en Caja vs Esperado: $${totalGap.toFixed(2)}`, 14, 61);

    // Mapeo iterativo de la frecuencia de items (La Tabla es mejor para el PDF que la gráfica amontonada)
    const salesRows = salesData
      .sort((a, b) => b.cantidad - a.cantidad) // Ordenar de mayor a menor venta
      .map(item => [
        item.name, 
        item.cantidad.toString(), 
        `$${item.ingresos.toFixed(2)}`
      ]);

    autoTable(doc, {
      startY: 70,
      head: [['Sabor de Paleta', 'Unidades Vendidas', 'Ingreso Subtotal']],
      body: salesRows,
    });

    let currentY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || 70;

    // Tabla de Cortesías
    if (courtesyData && courtesyData.length > 0) {
      const courtesyRows = courtesyData
        .sort((a, b) => b.cantidad - a.cantidad)
        .map(item => [
          item.name, 
          item.cantidad.toString()
        ]);
      
      autoTable(doc, {
        startY: currentY + 10,
        head: [['Sabor (Paletas de Cortesía)', 'Cantidad Regalada']],
        body: courtesyRows,
        headStyles: { fillColor: [33, 150, 243] }
      });
      currentY = doc.lastAutoTable.finalY;
    }

    // Mapeo iterativo del listado historico de transacciones diarias.
    const closureRows = closures.map(c => [
      new Date(c.cerrado_en + 'Z').toLocaleDateString(),
      `$${Number(c.total_esperado).toFixed(2)}`,
      `$${Number(c.efectivo_real).toFixed(2)}`,
      `$${Number(c.diferencia).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: currentY + 15,
      head: [['Fecha de Corte', 'Ventas (Sistema)', 'Dinero en Caja', 'Faltante / Sobrante']],
      body: closureRows,
    });

    // Desencadena la descarga del binario.
    doc.save(`cierre_mensual_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="mensual-container">
      <div className="mensual-header">
        <h3 className="mensual-title">Resumen Mensual de Ventas</h3>
        
        <div className="mensual-controls">
          <input 
            type="month" 
            className="month-picker"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
          <button 
            className="export-pdf-btn" 
            onClick={handleExportPDF} 
            disabled={isLoading || closures.length === 0}
          >
            {isLoading ? 'Cargando datos...' : 'Exportar PDF'}
          </button>
        </div>
      </div>
      
      <div className="cards-wrapper">
        <div className="summary-card">
          <h4>Ventas Totales</h4>
          <span className="card-value">${totalGrossIncome.toFixed(2)}</span>
        </div>
        <div className="summary-card" style={{ backgroundColor: '#fff3e0' }}>
          <h4>Inversión Total</h4>
          <span className="card-value" style={{ color: '#e65100' }}>${totalInvestments.toFixed(2)}</span>
        </div>
        
        {(() => {
          const ganancia = totalGrossIncome - totalInvestments;
          const isLoss = ganancia < 0;
          return (
            <div className={`summary-card`} style={{ backgroundColor: isLoss ? '#ffebee' : '#f1f8e9', border: `2px solid ${isLoss ? '#ef9a9a' : '#8bc34a'}` }}>
              <h4>{isLoss ? 'Pérdida Mensual' : 'Ganancia Neta'}</h4>
              <span className="card-value" style={{ color: isLoss ? '#c62828' : '#33691e' }}>
                ${Math.abs(ganancia).toFixed(2)}
              </span>
            </div>
          );
        })()}
        
        <div className={`summary-card ${totalGap < 0 ? 'deficit' : 'surplus'}`}>
          <h4>Desajuste de Caja</h4>
          <span className="card-value">${totalGap.toFixed(2)}</span>
        </div>
      </div>

      <div className="chart-wrapper">
        <h4>Frecuencia de Ventas por Sabor</h4>
        <div id="pdf-chart-node" style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '16px' }}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={salesData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                dataKey="cantidad"
              >
                {salesData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value, name, props) => {
                  const total = salesData.reduce((sum, item) => sum + item.cantidad, 0);
                  const percent = ((value / total) * 100).toFixed(1);
                  return [`${value} paletas (${percent}%)`, name];
                }}
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #eeeeee', color: '#333333', borderRadius: '8px' }} 
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {salesData.length > 0 && (
          <button 
            className="admin-action-btn"
            style={{ marginTop: '1rem', backgroundColor: '#e0e0e0', color: '#333', fontSize: '0.9rem', padding: '8px', width: '100%', maxWidth: '300px', alignSelf: 'center', display: 'block', margin: '1rem auto 0 auto' }}
            onClick={() => setShowDataTables(!showDataTables)}
          >
            {showDataTables ? 'Ocultar Datos' : 'Visualizar Datos'}
          </button>
        )}

        {showDataTables && salesData.length > 0 && (
          <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="summary-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.9rem', minWidth: '300px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'left' }}>Sabor de Paleta</th>
                    <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Unidades Vendidas</th>
                    <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'right' }}>Ingreso Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {[...salesData]
                    .sort((a, b) => b.cantidad - a.cantidad)
                    .map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{item.name}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'center' }}>{item.cantidad}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>${item.ingresos.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {courtesyData && courtesyData.length > 0 && (
              <>
                <h5 style={{ margin: '0 0 0.5rem 0', color: '#1565c0' }}>Paletas de Cortesía</h5>
                <table className="summary-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#e3f2fd' }}>
                      <th style={{ padding: '8px', borderBottom: '2px solid #90caf9', textAlign: 'left', color: '#1565c0' }}>Sabor (Cortesía)</th>
                      <th style={{ padding: '8px', borderBottom: '2px solid #90caf9', textAlign: 'center', color: '#1565c0' }}>Regaladas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...courtesyData]
                      .sort((a, b) => b.cantidad - a.cantidad)
                      .map((item, idx) => (
                      <tr key={`c-${idx}`}>
                        <td style={{ padding: '8px', borderBottom: '1px solid #bbdefb' }}>{item.name}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #bbdefb', textAlign: 'center' }}>{item.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {closures && closures.length > 0 && (
              <>
                <h5 style={{ margin: '1.5rem 0 0.5rem 0', color: '#555' }}>Historial de Cortes Diarios del Mes</h5>
                <div style={{ overflowX: 'auto' }}>
                  <table className="summary-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f5f5f5' }}>
                        <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'left' }}>Fecha</th>
                        <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'right' }}>Esperado</th>
                        <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'right' }}>En Caja</th>
                        <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'right' }}>Diferencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closures.map((c, idx) => {
                        const diff = Number(c.diferencia);
                        return (
                          <tr key={`cl-${idx}`}>
                            <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{new Date(c.cerrado_en + 'Z').toLocaleDateString()}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>${Number(c.total_esperado).toFixed(2)}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>${Number(c.efectivo_real).toFixed(2)}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'right', color: diff < 0 ? '#d32f2f' : (diff > 0 ? '#388e3c' : 'inherit'), fontWeight: diff !== 0 ? 'bold' : 'normal' }}>
                              ${diff.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
