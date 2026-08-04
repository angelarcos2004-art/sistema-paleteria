import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchMonthlyClosures, fetchMonthlySalesByFlavor } from './services/cierreMensualService';
import './CierreMensual.css';

// Componente para la renderizacion de metricas agregadas mensuales y graficas de barras.
export default function CierreMensual() {
  const [closures, setClosures] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estado local para seleccionar el mes historico a analizar. Por defecto, mes en curso.
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Vector de mapeo hexadecimal para la paleta de colores del grafico de sectores.
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c', '#8dd1e1'];

  // Reduccion escalar de las matrices de datos recuperados para totalizacion de KPIs.
  const totalGrossIncome = closures.reduce((acc, row) => acc + Number(row.total_esperado), 0);
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
        const [closuresData, chartData] = await Promise.all([
          fetchMonthlyClosures(year, month),
          fetchMonthlySalesByFlavor(year, month)
        ]);
        setClosures(closuresData);
        setSalesData(chartData);
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
    doc.text(`Ingreso Bruto Mensual: $${totalGrossIncome.toFixed(2)}`, 14, 40);
    doc.text(`Total Efectivo Real: $${totalActualCash.toFixed(2)}`, 14, 47);
    doc.text(`Desfase Acumulado (Merma): $${totalGap.toFixed(2)}`, 14, 54);

    let startYPointer = 62;

    // Rasterizacion del nodo del DOM correspondiente a la grafica utilizando Canvas API.
    const chartElement = document.getElementById('pdf-chart-node');
    if (chartElement) {
      const canvas = await html2canvas(chartElement, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      // Coordenadas calculadas: X=14, Y=60, Ancho=180, Alto=Proporcional
      const imgProps = doc.getImageProperties(imgData);
      const pdfWidth = 180;
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      doc.addImage(imgData, 'PNG', 14, 60, pdfWidth, pdfHeight);
      startYPointer = 60 + pdfHeight + 10;
    }

    // Mapeo iterativo de la frecuencia de items.
    const salesRows = salesData.map(item => [
      item.name, 
      item.cantidad.toString(), 
      `$${item.ingresos.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: startYPointer,
      head: [['Sabor', 'Unidades Vendidas', 'Ingreso Subtotal']],
      body: salesRows,
    });

    // Mapeo iterativo del listado historico de transacciones diarias.
    const closureRows = closures.map(c => [
      new Date(c.cerrado_en).toLocaleDateString(),
      `$${Number(c.total_esperado).toFixed(2)}`,
      `$${Number(c.efectivo_real).toFixed(2)}`,
      `$${Number(c.diferencia).toFixed(2)}`
    ]);

    const currentY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || startYPointer;

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
          <h4>Ventas Registradas</h4>
          <span className="card-value">${totalGrossIncome.toFixed(2)}</span>
        </div>
        <div className="summary-card">
          <h4>Dinero Real en Caja</h4>
          <span className="card-value">${totalActualCash.toFixed(2)}</span>
        </div>
        <div className={`summary-card ${totalGap < 0 ? 'deficit' : 'surplus'}`}>
          <h4>Faltante o Sobrante</h4>
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
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="cantidad"
              >
                {salesData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #eeeeee', color: '#333333', borderRadius: '8px' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
