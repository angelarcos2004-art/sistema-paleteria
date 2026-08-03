import { supabase } from '../supabaseClient';

// Funcion asincrona para persistir un nuevo arreglo de ventas en bloque (bulk insert).
// Recibe como parametro el arreglo de la cuenta actual.
export const registrarVentasBulk = async (currentBill) => {
  try {
    // Transformacion de la estructura local a la estructura esperada por la base de datos.
    // Se expande cada articulo segun su cantidad, generando una entrada individual por unidad vendida.
    const registrosInsertar = [];
    currentBill.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
        registrosInsertar.push({
          sabor: item.flavor,
          precio: item.price
        });
      }
    });

    // Se previene la ejecucion de la red si el arreglo esta vacio.
    if (registrosInsertar.length === 0) return null;

    // Ejecucion de la operacion de insercion masiva.
    const { data, error } = await supabase
      .from('ventas')
      .insert(registrosInsertar)
      .select();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch (err) {
    console.error('Fallo en la persistencia del bloque de ventas.', err);
    throw err;
  }
};
