import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { obtenerProductos } from './services/productosService';
import { guardarCompraSemanal, obtenerResumenSemanal } from './services/finanzasService';
import { obtenerInventarioActual } from './services/inventarioService';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import CierreMensual from './CierreMensual';
import './ControlFinanciero.css';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF19A3', '#19FF5A', '#A319FF'];

export default function ControlFinanciero({ onClose }) {
  const [activeTab, setActiveTab] = useState('registrar'); // 'registrar' o 'resumen'
  
  // Estados para Registro de Compras
  const [productos, setProductos] = useState([]);
  const [gastoTotal, setGastoTotal] = useState('');
  const [saborSeleccionado, setSaborSeleccionado] = useState('');
  const [cantidadSabor, setCantidadSabor] = useState('');
  const [listaCompras, setListaCompras] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Estados para Resumen Semanal
  const [resumen, setResumen] = useState(null);
  const [isLoadingResumen, setIsLoadingResumen] = useState(false);
  const [showDataTables, setShowDataTables] = useState(false);

  // Estados para Inventario
  const [inventario, setInventario] = useState([]);
  const [isLoadingInventario, setIsLoadingInventario] = useState(false);

  // Estado para el modal de retroalimentación
  const [feedbackModal, setFeedbackModal] = useState({ isOpen: false, message: '', isError: false });
  const [targetWeek, setTargetWeek] = useState(() => {
    const d = new Date();
    const dateCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    dateCopy.setUTCDate(dateCopy.getUTCDate() + 4 - (dateCopy.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(dateCopy.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((dateCopy - yearStart) / 86400000) + 1) / 7);
    return `${dateCopy.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  });

  useEffect(() => {
    const cargarProductos = async () => {
      const data = await obtenerProductos();
      setProductos(data);
    };
    cargarProductos();
  }, []);

  // Cargar resumen e inventario cuando se cambia de pestaña
  useEffect(() => {
    if (activeTab === 'resumen') {
      const cargarResumen = async () => {
        setIsLoadingResumen(true);
        try {
          const data = await obtenerResumenSemanal(targetWeek);
          setResumen(data);
        } catch (error) {
          console.error("Error al cargar resumen", error);
        } finally {
          setIsLoadingResumen(false);
        }
      };
      cargarResumen();
    } else if (activeTab === 'inventario') {
      const cargarInventario = async () => {
        setIsLoadingInventario(true);
        try {
          const data = await obtenerInventarioActual();
          setInventario(data);
        } catch (error) {
          console.error("Error al cargar inventario", error);
        } finally {
          setIsLoadingInventario(false);
        }
      };
      cargarInventario();
    }
  }, [activeTab, targetWeek]);

  const agregarALista = () => {
    if (!saborSeleccionado || !cantidadSabor || cantidadSabor <= 0) return;
    
    const productoObj = productos.find(p => p.id === Number(saborSeleccionado));
    if (!productoObj) return;

    setListaCompras(prev => [
      ...prev, 
      { 
        producto_id: productoObj.id, 
        sabor: productoObj.sabor, 
        cantidad: Number(cantidadSabor) 
      }
    ]);
    
    // Limpiar campos
    setSaborSeleccionado('');
    setCantidadSabor('');
  };

  const quitarDeLista = (indexToRemove) => {
    setListaCompras(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleGuardarCompra = async () => {
    const totalNum = parseFloat(gastoTotal);
    if (isNaN(totalNum) || totalNum <= 0) {
      setFeedbackModal({ isOpen: true, message: 'Por favor ingresa un Gasto Total válido.', isError: true });
      return;
    }

    setIsSaving(true);
    try {
      await guardarCompraSemanal(totalNum, listaCompras);
      setFeedbackModal({ isOpen: true, message: '¡Compra registrada exitosamente!', isError: false });
      // Limpiar formulario
      setGastoTotal('');
      setListaCompras([]);
      
      // Si estaba en resumen, refrescar
      if (activeTab === 'resumen') {
        const data = await obtenerResumenSemanal();
        setResumen(data);
      }
    } catch (error) {
      setFeedbackModal({ isOpen: true, message: 'Hubo un error al guardar la compra.', isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  // Función para exportar a PDF (similar a CierreMensual)
  const handleExportPDF = async () => {
    if (!resumen) return;

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Resumen Financiero Semanal", 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Fecha de emisión: ${new Date().toLocaleString()}`, 14, 30);
    
    doc.text(`Inversión: $${resumen.totalInvertido.toFixed(2)}`, 14, 40);
    doc.text(`Ventas: $${resumen.totalIngresos.toFixed(2)}`, 14, 47);
    doc.text(`Ganancia: $${resumen.gananciaNeta.toFixed(2)}`, 14, 54);

    // Mapeo de ventas para tabla
    const salesRows = resumen.datosGrafica
      .sort((a, b) => b.value - a.value)
      .map(item => [
        item.name, 
        item.value.toString()
      ]);

    autoTable(doc, {
      startY: 65,
      head: [['Sabor de Paleta', 'Cantidad Vendida']],
      body: salesRows,
    });

    let currentY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || 65;

    if (resumen.courtesyData && resumen.courtesyData.length > 0) {
      const courtesyRows = resumen.courtesyData
        .sort((a, b) => b.value - a.value)
        .map(item => [
          item.name, 
          item.value.toString()
        ]);

      autoTable(doc, {
        startY: currentY + 10,
        head: [['Sabor (Paletas de Cortesía)', 'Cantidad Regalada']],
        body: courtesyRows,
        headStyles: { fillColor: [33, 150, 243] }
      });
      currentY = doc.lastAutoTable.finalY;
    }

    if (resumen.closures && resumen.closures.length > 0) {
      const closureRows = resumen.closures.map(c => [
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
    }

    doc.save(`resumen_semanal_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Estado para el Dropdown Personalizado
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Logica semáforo
  let bgColorSemaforo = '#f1f8e9'; // Verde claro
  let borderColorSemaforo = '#8bc34a'; // Verde borde
  let textColorTitle = '#558b2f';
  let textColorValue = '#33691e';
  let labelSemaforo = 'Ganancia Neta';

  if (resumen) {
    if (resumen.gananciaNeta < 0) {
      bgColorSemaforo = '#ffebee';
      borderColorSemaforo = '#ef9a9a';
      textColorTitle = '#c62828';
      textColorValue = '#b71c1c';
      labelSemaforo = 'Pérdida (Aún no recuperas inversión)';
    } else if (resumen.gananciaNeta === 0 && resumen.totalInvertido > 0) {
      bgColorSemaforo = '#fffde7';
      borderColorSemaforo = '#fff59d';
      textColorTitle = '#f57f17';
      textColorValue = '#e65100';
      labelSemaforo = 'Tablas (Venta = Inversión)';
    }
  }

  // Encontrar el nombre del sabor seleccionado para mostrarlo en el dropdown
  const saborSeleccionadoNombre = productos.find(p => p.id === saborSeleccionado)?.sabor || 'Seleccionar Sabor...';

  return (
    <div className="admin-overlay" style={{ zIndex: 1100 }}>
      <div className="admin-modal" style={{ maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="admin-header">
          <h2>Control Financiero e Inversiones</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div className="financial-tabs">
          <button 
            className={`tab-btn ${activeTab === 'registrar' ? 'active' : ''}`}
            onClick={() => setActiveTab('registrar')}
          >
            Registrar Compra
          </button>
          <button 
            className={`tab-btn ${activeTab === 'inventario' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventario')}
          >
            Control de Inventario
          </button>
          <button 
            className={`tab-btn ${activeTab === 'resumen' ? 'active' : ''}`}
            onClick={() => setActiveTab('resumen')}
          >
            Resumen Semanal
          </button>
          <button 
            className={`tab-btn ${activeTab === 'mensual' ? 'active' : ''}`}
            onClick={() => setActiveTab('mensual')}
          >
            Resumen Mensual
          </button>
        </div>

        <div className="admin-body">
          {activeTab === 'registrar' && (
            <div className="financial-section">
              <h3>Ingreso de Mercancía Semanal</h3>
              <p className="admin-description">Registra cuánto gastaste y qué paletas compraste.</p>
              
              <div className="input-group">
                <label>Gasto Total Semanal ($):</label>
                <input 
                  type="number" 
                  placeholder="Ej. 1500" 
                  className="custom-prompt-input"
                  value={gastoTotal}
                  onChange={(e) => setGastoTotal(e.target.value)}
                />
              </div>

              <div className="inventory-add-section" style={{ marginTop: '1.5rem' }}>
                <h4>Paletas Compradas:</h4>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                  
                  {/* Dropdown Personalizado Estilo Claymorphism */}
                  <div style={{ flex: 1, position: 'relative' }}>
                    <div 
                      className="custom-prompt-input" 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                      <span>{saborSeleccionadoNombre}</span>
                      <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>▼</span>
                    </div>
                    
                    {isDropdownOpen && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '8px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '16px',
                        boxShadow: '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 10,
                        border: '2px solid transparent', // para el borde interior
                        padding: '8px'
                      }}>
                        {productos.map(p => (
                          <div 
                            key={p.id}
                            style={{
                              padding: '10px 15px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              backgroundColor: saborSeleccionado === p.id ? '#e2e8f0' : 'transparent',
                              color: '#334155',
                              transition: 'background-color 0.2s',
                              fontWeight: saborSeleccionado === p.id ? 'bold' : 'normal'
                            }}
                            onMouseEnter={(e) => {
                              if (saborSeleccionado !== p.id) e.target.style.backgroundColor = '#f1f5f9';
                            }}
                            onMouseLeave={(e) => {
                              if (saborSeleccionado !== p.id) e.target.style.backgroundColor = 'transparent';
                            }}
                            onClick={() => {
                              setSaborSeleccionado(p.id);
                              setIsDropdownOpen(false);
                            }}
                          >
                            {p.sabor}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <input 
                    type="number" 
                    placeholder="Cant." 
                    className="custom-prompt-input" 
                    style={{ width: '80px' }} 
                    value={cantidadSabor}
                    onChange={(e) => setCantidadSabor(e.target.value)}
                  />
                  <button className="prompt-confirm-btn" style={{ padding: '0.5rem 1rem' }} onClick={agregarALista}>+</button>
                </div>
                
                <ul className="bill-list" style={{ marginTop: '1rem', border: '1px solid #ddd', padding: '10px', borderRadius: '8px', minHeight: '80px' }}>
                  {listaCompras.length === 0 ? (
                    <li style={{ color: '#888', textAlign: 'center', listStyle: 'none' }}>No se han agregado paletas.</li>
                  ) : (
                    listaCompras.map((item, idx) => (
                      <li key={idx} className="bill-item removable-item" onClick={() => quitarDeLista(idx)}>
                        <span className="item-name">{item.sabor}</span>
                        <span className="item-quantity">x{item.cantidad} <span className="remove-icon">Quitar</span></span>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <button 
                className="admin-action-btn cierre-btn" 
                style={{ marginTop: '2rem', opacity: isSaving ? 0.7 : 1 }}
                onClick={handleGuardarCompra}
                disabled={isSaving}
              >
                {isSaving ? 'Guardando...' : 'Guardar Compra Semanal'}
              </button>
            </div>
          )}

          {activeTab === 'resumen' && (
            <div className="financial-section">
              <div className="mensual-header" style={{ marginBottom: '1.5rem', marginTop: '-0.5rem' }}>
                <h3 className="mensual-title" style={{ fontSize: '1.2rem' }}>Resumen Semanal</h3>
                <div className="mensual-controls">
                  <input 
                    type="week" 
                    className="month-picker"
                    value={targetWeek}
                    onChange={(e) => setTargetWeek(e.target.value)}
                    style={{ padding: '0.4rem', fontSize: '0.9rem' }}
                  />
                  <button 
                    className="export-pdf-btn" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                    onClick={handleExportPDF} 
                    disabled={isLoadingResumen || !resumen}
                  >
                    {isLoadingResumen ? 'Cargando...' : 'Exportar PDF'}
                  </button>
                </div>
              </div>
              
              {isLoadingResumen || !resumen ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando datos financieros...</div>
              ) : (
                <>
                  {(() => {
                    const totalGap = (resumen.closures || []).reduce((acc, c) => acc + Number(c.diferencia), 0);
                    const isLoss = resumen.gananciaNeta < 0;
                    return (
                      <div className="cards-wrapper" style={{ marginTop: '1rem' }}>
                        <div className="summary-card">
                          <h4>Ventas Totales</h4>
                          <span className="card-value">${resumen.totalIngresos.toFixed(2)}</span>
                        </div>
                        <div className="summary-card" style={{ backgroundColor: '#fff3e0' }}>
                          <h4>Inversión Total</h4>
                          <span className="card-value" style={{ color: '#e65100' }}>${resumen.totalInvertido.toFixed(2)}</span>
                        </div>
                        <div className={`summary-card`} style={{ backgroundColor: isLoss ? '#ffebee' : '#f1f8e9', border: `2px solid ${isLoss ? '#ef9a9a' : '#8bc34a'}` }}>
                          <h4>{isLoss ? 'Pérdida Semanal' : 'Ganancia Neta'}</h4>
                          <span className="card-value" style={{ color: isLoss ? '#c62828' : '#33691e' }}>
                            ${Math.abs(resumen.gananciaNeta).toFixed(2)}
                          </span>
                        </div>
                        <div className={`summary-card ${totalGap < 0 ? 'deficit' : 'surplus'}`}>
                          <h4>Desajuste de Caja</h4>
                          <span className="card-value">${totalGap.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="chart-wrapper">
                    <h4>Frecuencia de Ventas por Sabor</h4>
                    {resumen.datosGrafica.length > 0 ? (
                      <div id="pdf-chart-semanal" style={{ width: '100%', height: 300, backgroundColor: '#ffffff', borderRadius: '16px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={resumen.datosGrafica}
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {resumen.datosGrafica.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value, name) => {
                                const total = resumen.datosGrafica.reduce((sum, item) => sum + item.value, 0);
                                const percent = ((value / total) * 100).toFixed(1);
                                return [`${value} paletas (${percent}%)`, name];
                              }}
                              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #eeeeee', color: '#333333', borderRadius: '8px' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p style={{ color: '#888', textAlign: 'center' }}>Aún no hay ventas registradas esta semana.</p>
                    )}                    
                    {resumen.datosGrafica.length > 0 && (
                      <button 
                        className="admin-action-btn"
                        style={{ marginTop: '1rem', backgroundColor: '#e0e0e0', color: '#333', fontSize: '0.9rem', padding: '8px' }}
                        onClick={() => setShowDataTables(!showDataTables)}
                      >
                        {showDataTables ? 'Ocultar Datos' : 'Visualizar Datos'}
                      </button>
                    )}

                    {showDataTables && resumen.datosGrafica.length > 0 && (
                      <div style={{ marginTop: '1rem', textAlign: 'left' }}>
                        <table className="summary-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f5f5f5' }}>
                              <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'left' }}>Sabor de Paleta</th>
                              <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>Cantidad Vendida</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...resumen.datosGrafica]
                              .sort((a, b) => b.value - a.value)
                              .map((item, idx) => (
                              <tr key={idx}>
                                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{item.name}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'center' }}>{item.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {resumen.courtesyData && resumen.courtesyData.length > 0 && (
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
                                {[...resumen.courtesyData]
                                  .sort((a, b) => b.value - a.value)
                                  .map((item, idx) => (
                                  <tr key={`c-${idx}`}>
                                    <td style={{ padding: '8px', borderBottom: '1px solid #bbdefb' }}>{item.name}</td>
                                    <td style={{ padding: '8px', borderBottom: '1px solid #bbdefb', textAlign: 'center' }}>{item.value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </>
                        )}

                        {resumen.closures && resumen.closures.length > 0 && (
                          <>
                            <h5 style={{ margin: '1.5rem 0 0.5rem 0', color: '#555' }}>Historial de Cortes Diarios</h5>
                            <div style={{ overflowX: 'auto' }}>
                              <table className="summary-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                                    <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'left' }}>Fecha</th>
                                    <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'right' }}>Esperado</th>
                                    <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'right' }}>Real</th>
                                    <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'right' }}>Diferencia</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {resumen.closures.map((c, idx) => {
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

                </>
              )}
            </div>
          )}

          {activeTab === 'inventario' && (
            <div className="financial-section">
              <h3>Control de Inventario en Tiempo Real</h3>
              <p className="admin-description">Calculado restando todas las ventas de todas las compras registradas.</p>
              
              {isLoadingInventario ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Calculando inventario...</div>
              ) : (
                <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f8e9', borderBottom: '2px solid #8bc34a' }}>
                        <th style={{ padding: '10px', color: '#33691e' }}>Sabor</th>
                        <th style={{ padding: '10px', color: '#33691e', textAlign: 'center' }}>Compradas</th>
                        <th style={{ padding: '10px', color: '#33691e', textAlign: 'center' }}>Vendidas</th>
                        <th style={{ padding: '10px', color: '#33691e', textAlign: 'center' }}>Stock Actual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventario.map(item => {
                        // Resaltar en rojo si el stock es negativo o 0
                        const isWarning = item.stock_actual <= 0;
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{item.sabor}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#555' }}>{item.ingresadas}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#555' }}>{item.vendidas}</td>
                            <td style={{ 
                              padding: '10px', 
                              textAlign: 'center', 
                              fontWeight: 'bold',
                              color: isWarning ? '#c62828' : '#2e7d32',
                              backgroundColor: isWarning ? '#ffebee' : 'transparent'
                            }}>
                              {item.stock_actual}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {inventario.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#888', marginTop: '1rem' }}>No hay productos en el catálogo.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'mensual' && (
            <div className="financial-section" style={{ padding: '0', backgroundColor: 'transparent', border: 'none', boxShadow: 'none' }}>
              <CierreMensual />
            </div>
          )}
        </div>
      </div>

      {feedbackModal.isOpen && (
        <div className="custom-prompt-overlay" style={{ zIndex: 1200 }}>
          <div className="custom-prompt-modal" style={{ border: feedbackModal.isError ? '2px solid #ef9a9a' : '2px solid #a5d6a7' }}>
            <h3 style={{ marginTop: 0, color: feedbackModal.isError ? '#d32f2f' : '#2e7d32' }}>
              {feedbackModal.isError ? 'Atención' : '¡Éxito!'}
            </h3>
            <p>{feedbackModal.message}</p>
            <div className="custom-prompt-actions">
              <button 
                className="prompt-confirm-btn" 
                style={{ backgroundColor: feedbackModal.isError ? '#ef9a9a' : '#a5d6a7', color: 'var(--text-dark)' }} 
                onClick={() => setFeedbackModal({ isOpen: false, message: '', isError: false })}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
