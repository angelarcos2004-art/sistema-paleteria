import { supabase } from '../supabaseClient';

export const obtenerInventarioActual = async () => {
  try {
    // 1. Obtener todos los productos (catalogo)
    const { data: productosData, error: prodError } = await supabase
      .from('productos')
      .select('id, sabor');
    if (prodError) throw prodError;

    // 2. Obtener todas las compras registradas
    const { data: comprasData, error: compError } = await supabase
      .from('detalle_compras')
      .select('producto_id, cantidad_comprada');
    if (compError) throw compError;

    // 3. Obtener todas las ventas registradas
    const { data: ventasData, error: venError } = await supabase
      .from('ventas')
      .select('sabor');
    if (venError) throw venError;

    // Sumar compras por producto_id
    const comprasMap = {};
    comprasData.forEach(c => {
      if (!comprasMap[c.producto_id]) comprasMap[c.producto_id] = 0;
      comprasMap[c.producto_id] += c.cantidad_comprada;
    });

    // Sumar ventas por sabor
    const ventasMap = {};
    ventasData.forEach(v => {
      if (!ventasMap[v.sabor]) ventasMap[v.sabor] = 0;
      ventasMap[v.sabor] += 1;
    });

    // Construir el resultado combinando los datos
    const inventario = productosData.map(p => {
      const ingresadas = comprasMap[p.id] || 0;
      const vendidas = ventasMap[p.sabor] || 0;
      return {
        id: p.id,
        sabor: p.sabor,
        ingresadas: ingresadas,
        vendidas: vendidas,
        stock_actual: ingresadas - vendidas
      };
    });

    // Ordenar para que los de menor stock salgan primero (ayuda a ver qué se está acabando)
    inventario.sort((a, b) => a.stock_actual - b.stock_actual);

    return inventario;
  } catch (error) {
    console.error('Error al calcular el inventario actual', error);
    return [];
  }
};
