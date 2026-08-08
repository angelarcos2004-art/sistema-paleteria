import { supabase } from '../supabaseClient';

// Funcion asincrona para obtener el catalogo completo de productos.
export const obtenerProductos = async () => {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('id, sabor, precio')
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`Fallo al leer productos: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error('Error de red al obtener productos', err);
    return [];
  }
};

// Funcion asincrona para modificar el producto existente y propagar el cambio de nombre.
export const actualizarProducto = async (id, oldSabor, nuevoSabor, nuevoPrecio) => {
  try {
    const { data, error } = await supabase
      .from('productos')
      .update({ sabor: nuevoSabor, precio: nuevoPrecio })
      .eq('id', id)
      .select();

    if (error) {
      throw new Error(`Fallo al actualizar producto: ${error.message}`);
    }

    // Si el nombre del sabor cambió, actualizar todo el historial de ventas
    if (oldSabor && oldSabor !== nuevoSabor) {
      const { error: salesError } = await supabase
        .from('ventas')
        .update({ sabor: nuevoSabor })
        .eq('sabor', oldSabor);
        
      if (salesError) {
        console.warn('Advertencia: No se pudo propagar el cambio de nombre al historial de ventas:', salesError.message);
      }
    }

    return data;
  } catch (err) {
    console.error('Error de red al actualizar producto', err);
    throw err;
  }
};

// Funcion asincrona para insertar un nuevo producto al catalogo.
export const agregarProducto = async (sabor, precio) => {
  try {
    const { data, error } = await supabase
      .from('productos')
      .insert([{ sabor, precio }])
      .select();

    if (error) {
      throw new Error(`Fallo al agregar producto: ${error.message}`);
    }
    return data[0];
  } catch (err) {
    console.error('Error de red al agregar producto', err);
    throw err;
  }
};

// Funcion asincrona para eliminar permanentemente un producto.
export const eliminarProducto = async (id) => {
  try {
    const { error } = await supabase
      .from('productos')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Fallo al eliminar producto: ${error.message}`);
    }
    return true;
  } catch (err) {
    console.error('Error de red al eliminar producto', err);
    throw err;
  }
};
