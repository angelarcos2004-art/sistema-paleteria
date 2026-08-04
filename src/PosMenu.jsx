import React, { useState, useEffect } from 'react';
import { registrarVentasBulk } from './services/ventasService';
import { obtenerProductos, actualizarPrecioProducto, agregarProducto, eliminarProducto } from './services/productosService';
import AdminPanel from './AdminPanel';
import './PosMenu.css';

export default function PosMenu() {
  // Estado local para almacenar la cuenta actual.
  // Consiste en un arreglo de objetos con la estructura: { flavor: string, quantity: number, price: number }
  const [currentBill, setCurrentBill] = useState([]);
  
  // Estado local para almacenar los productos traidos desde la base de datos.
  const [catalog, setCatalog] = useState([]);
  
  // Estado local para filtrar sabores mediante búsqueda.
  const [searchQuery, setSearchQuery] = useState('');

  // Bandera de estado para alternar la funcionalidad de los botones (cobro vs actualizacion).
  // Inicializada desde sessionStorage para persistir ante recargas de pagina.
  const [isEditMode, setIsEditMode] = useState(() => {
    return sessionStorage.getItem('paleteria_edit_mode') === 'true';
  });

  // Sincronizar el estado de isEditMode con sessionStorage cada vez que cambie.
  useEffect(() => {
    sessionStorage.setItem('paleteria_edit_mode', isEditMode);
  }, [isEditMode]);
  
  // Estado local para prevenir iteraciones de red multiples durante el guardado o edicion.
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Bandera de estado para desplegar la vista de panel administrativo.
  // Bandera de estado para desplegar la vista de panel administrativo.
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Estados locales para gobernar los modales personalizados de edicion, creacion y eliminacion.
  const [editModalConfig, setEditModalConfig] = useState({ isOpen: false, itemDef: null, inputValue: '' });
  const [addModalConfig, setAddModalConfig] = useState({ isOpen: false, flavor: '', price: '' });
  const [deleteConfirmConfig, setDeleteConfirmConfig] = useState({ isOpen: false, itemDef: null });

  // Hook de ciclo de vida para montar el catalogo en la primera renderizacion.
  useEffect(() => {
    const loadCatalog = async () => {
      const data = await obtenerProductos();
      const sortedData = data.sort((a, b) => Number(a.precio) - Number(b.precio));
      setCatalog(sortedData);
    };
    loadCatalog();
  }, []);

  // Funcion orquestadora del click de los botones de la cuadricula.
  // Redirige el flujo hacia actualizacion de DB o hacia acumulacion de la cuenta local.
  const handleFlavorClick = async (itemDef) => {
    if (isEditMode) {
      // Apertura del modal customizado inyectando el valor actual del articulo.
      setEditModalConfig({ isOpen: true, itemDef, inputValue: itemDef.precio });
    } else {
      setCurrentBill((prevBill) => {
        const existingItemIndex = prevBill.findIndex(item => item.flavor === itemDef.sabor);
        
        if (existingItemIndex >= 0) {
          // Se crea una copia del arreglo anterior para mantener la inmutabilidad de React.
          const updatedBill = [...prevBill];
          
          // Se incrementa la cantidad del elemento encontrado en el indice correspondiente.
          updatedBill[existingItemIndex] = {
            ...updatedBill[existingItemIndex],
            quantity: updatedBill[existingItemIndex].quantity + 1
          };
          
          return updatedBill;
        } else {
          // Asignacion del precio especifico definido en el catalogo durante la instanciacion.
          return [...prevBill, { flavor: itemDef.sabor, quantity: 1, price: itemDef.precio }];
        }
      });
    }
  };

  // Funcion para decrementar o eliminar un articulo directamente de la cuenta.
  const handleRemoveItem = (flavorToRemove) => {
    setCurrentBill((prevBill) => {
      const existingItemIndex = prevBill.findIndex(item => item.flavor === flavorToRemove);
      if (existingItemIndex === -1) return prevBill;

      const updatedBill = [...prevBill];
      if (updatedBill[existingItemIndex].quantity > 1) {
        // Decremento de cantidad manteniendo el registro.
        updatedBill[existingItemIndex] = {
          ...updatedBill[existingItemIndex],
          quantity: updatedBill[existingItemIndex].quantity - 1
        };
        return updatedBill;
      } else {
        // Eliminacion absoluta del registro de la cuenta si la cantidad es unitaria.
        return updatedBill.filter((_, index) => index !== existingItemIndex);
      }
    });
  };

  // Funcion auxiliar para derivar el total de articulos iterando sobre el estado actual.
  const getTotalItems = () => {
    return currentBill.reduce((total, item) => total + item.quantity, 0);
  };

  // Funcion auxiliar para derivar el costo total.
  const getTotalCost = () => {
    return currentBill.reduce((total, item) => total + (item.quantity * item.price), 0);
  };

  // Funcion asincrona encargada de orquestar el guardado de la cuenta en la base de datos.
  const handleCheckout = async () => {
    if (currentBill.length === 0) return;
    
    setIsProcessing(true);
    try {
      await registrarVentasBulk(currentBill);
      // Reinicio de los estados una vez que la red confirme el procesamiento exitoso.
      setCurrentBill([]);
    } catch (error) {
      console.error('Error durante el proceso de cobro.', error);
    } finally {
      // Restauracion de los controles de la interfaz interactiva independientemente del resultado.
      setIsProcessing(false);
    }
  };

  // Funcion delegada para consolidar el guardado del nuevo precio desde el modal.
  const handleEditConfirm = async () => {
    const { itemDef, inputValue } = editModalConfig;
    const parsedPrice = parseFloat(inputValue);
    
    if (!isNaN(parsedPrice) && parsedPrice >= 0) {
      setIsProcessing(true);
      try {
        await actualizarPrecioProducto(itemDef.id, parsedPrice);
        setCatalog(prev => {
          const updatedCatalog = prev.map(p => p.id === itemDef.id ? { ...p, precio: parsedPrice } : p);
          return updatedCatalog.sort((a, b) => Number(a.precio) - Number(b.precio));
        });
      } catch (error) {
        console.error('Error al actualizar precio en base de datos', error);
      } finally {
        setIsProcessing(false);
      }
    }
    // Restablecimiento del estado local incondicional.
    setEditModalConfig({ isOpen: false, itemDef: null, inputValue: '' });
  };

  const handleEditCancel = () => {
    setEditModalConfig({ isOpen: false, itemDef: null, inputValue: '' });
  };

  // Intercepta el intento de eliminacion para renderizar el modal de advertencia personalizado.
  const handleDeleteRequest = () => {
    setDeleteConfirmConfig({ isOpen: true, itemDef: editModalConfig.itemDef });
    setEditModalConfig({ isOpen: false, itemDef: null, inputValue: '' });
  };

  // Funcion delegada para eliminar permanentemente un articulo una vez confirmada la advertencia.
  const handleDeleteConfirm = async () => {
    const { itemDef } = deleteConfirmConfig;
    setIsProcessing(true);
    try {
      await eliminarProducto(itemDef.id);
      setCatalog(prev => prev.filter(p => p.id !== itemDef.id));
    } catch (error) {
      console.error('Error al eliminar producto', error);
    } finally {
      setIsProcessing(false);
    }
    setDeleteConfirmConfig({ isOpen: false, itemDef: null });
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmConfig({ isOpen: false, itemDef: null });
  };

  // Funcion delegada para insertar un nuevo articulo desde el modal de creacion.
  const handleAddConfirm = async () => {
    const { flavor, price } = addModalConfig;
    const parsedPrice = parseFloat(price);
    
    if (flavor.trim() !== '' && !isNaN(parsedPrice) && parsedPrice >= 0) {
      setIsProcessing(true);
      try {
        const nuevoProducto = await agregarProducto(flavor.trim(), parsedPrice);
        setCatalog(prev => {
          const updatedCatalog = [...prev, nuevoProducto];
          return updatedCatalog.sort((a, b) => Number(a.precio) - Number(b.precio));
        });
      } catch (error) {
        console.error('Error al crear nuevo producto', error);
      } finally {
        setIsProcessing(false);
      }
    }
    setAddModalConfig({ isOpen: false, flavor: '', price: '' });
  };

  const handleAddCancel = () => {
    setAddModalConfig({ isOpen: false, flavor: '', price: '' });
  };

  return (
    <div className="pos-container">
      <section className="bill-section">
        <div className="bill-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img 
              src="/images/logo.png" 
              alt="Logo Paletería" 
              style={{ width: '80px', height: '80px', objectFit: 'contain' }} 
              onError={(e) => e.target.style.display = 'none'} 
            />
            <h2>Cuenta Actual</h2>
          </div>
        </div>
        <p className="summary-text">
          <span>Paletas: {getTotalItems()}</span>
          <span>Total: ${getTotalCost().toFixed(2)}</span>
        </p>
        <ul className="bill-list">
          {currentBill.map((item) => (
            <li 
              key={item.flavor} 
              className="bill-item removable-item" 
              onClick={() => handleRemoveItem(item.flavor)}
              title="Quitar un artículo"
            >
              <span className="item-name">{item.flavor}</span>
              <span className="item-quantity">x{item.quantity} <span className="remove-icon">Quitar</span></span>
            </li>
          ))}
        </ul>
        {currentBill.length > 0 && (
          <button 
            className="checkout-button"
            onClick={handleCheckout}
            disabled={isProcessing}
          >
            {isProcessing ? 'Cobrando...' : 'Cobrar Cuenta'}
          </button>
        )}
      </section>

      <section className="grid-section">
        <div className="grid-header">
          <input
            type="text"
            className="search-input"
            placeholder="Buscar sabor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button 
            className="settings-icon-btn"
            onClick={() => setIsAdminOpen(true)}
            aria-label="Abrir panel de administracion"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
        <div className={`flavor-grid ${isEditMode ? 'edit-mode' : ''}`}>
          {catalog.filter(item => item.sabor.toLowerCase().includes(searchQuery.toLowerCase())).map((itemDef) => (
            <button 
              key={itemDef.id} 
              className="flavor-button"
              onClick={() => handleFlavorClick(itemDef)}
              disabled={isProcessing}
            >
              <img 
                src={`/images/${itemDef.sabor.toLowerCase().replace(/\s+/g, '_')}.png`} 
                alt={itemDef.sabor}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/images/default_flavor.png';
                }}
                className="flavor-image"
              />
              <span className="flavor-name-label">{itemDef.sabor}</span>
              <span className="flavor-price-label">${Number(itemDef.precio).toFixed(2)}</span>
            </button>
          ))}
          {isEditMode && (
            <button 
              className="flavor-button flavor-add-button"
              onClick={() => setAddModalConfig({ isOpen: true, flavor: '', price: '' })}
              disabled={isProcessing}
            >
              <span className="flavor-name-label" style={{ fontSize: '2rem' }}>+</span>
              <span className="flavor-price-label">Añadir Sabor</span>
            </button>
          )}
        </div>
      </section>

      {isAdminOpen && (
        <AdminPanel 
          onClose={() => setIsAdminOpen(false)} 
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
        />
      )}

      {editModalConfig.isOpen && (
        <div className="custom-prompt-overlay">
          <div className="custom-prompt-modal">
            <h3 style={{ marginTop: 0 }}>Actualizar Precio</h3>
            <p>Ingrese el nuevo precio para <strong>{editModalConfig.itemDef.sabor}</strong>:</p>
            <input 
              type="number" 
              className="custom-prompt-input"
              value={editModalConfig.inputValue}
              onChange={(e) => setEditModalConfig({ ...editModalConfig, inputValue: e.target.value })}
              autoFocus
            />
            <div className="custom-prompt-actions">
              <button className="prompt-delete-btn" onClick={handleDeleteRequest}>Eliminar</button>
              <button className="prompt-cancel-btn" onClick={handleEditCancel}>Cancelar</button>
              <button className="prompt-confirm-btn" onClick={handleEditConfirm}>Aceptar</button>
            </div>
          </div>
        </div>
      )}

      {addModalConfig.isOpen && (
        <div className="custom-prompt-overlay">
          <div className="custom-prompt-modal">
            <h3 style={{ marginTop: 0 }}>Nuevo Sabor</h3>
            <input 
              type="text" 
              className="custom-prompt-input"
              placeholder="Nombre del Sabor"
              style={{ marginBottom: '0.5rem' }}
              value={addModalConfig.flavor}
              onChange={(e) => setAddModalConfig({ ...addModalConfig, flavor: e.target.value })}
              autoFocus
            />
            <input 
              type="number" 
              className="custom-prompt-input"
              placeholder="Precio"
              style={{ marginTop: '0.5rem' }}
              value={addModalConfig.price}
              onChange={(e) => setAddModalConfig({ ...addModalConfig, price: e.target.value })}
            />
            <div className="custom-prompt-actions">
              <button className="prompt-cancel-btn" onClick={handleAddCancel}>Cancelar</button>
              <button className="prompt-confirm-btn" onClick={handleAddConfirm}>Crear</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmConfig.isOpen && (
        <div className="custom-prompt-overlay">
          <div className="custom-prompt-modal" style={{ border: '1px solid #dc3545' }}>
            <h3 style={{ marginTop: 0, color: '#dc3545' }}>Advertencia de Seguridad</h3>
            <p>¿Estás seguro de que deseas eliminar permanentemente <strong>{deleteConfirmConfig.itemDef?.sabor}</strong>?</p>
            <p style={{ fontSize: '0.9rem', color: '#aaaaaa', marginBottom: '1.5rem' }}>Esta acción borrará el producto del menú y no se puede deshacer.</p>
            <div className="custom-prompt-actions">
              <button className="prompt-cancel-btn" onClick={handleDeleteCancel}>Cancelar</button>
              <button className="prompt-delete-btn" onClick={handleDeleteConfirm}>Sí, Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
