import { supabase } from '../supabaseClient';

// Retorna el valor total monetario de las ventas pendientes de cierre.
export const fetchExpectedTotal = async () => {
  try {
    const { data, error } = await supabase
      .from('ventas')
      .select('precio')
      .is('cierre_diario_id', null);

    if (error) {
      throw new Error(`Error recuperando ventas pendientes: ${error.message}`);
    }

    // Calcula la suma escalar iterando sobre la proyeccion de resultados.
    const expectedTotal = data.reduce((sum, row) => sum + Number(row.precio), 0);
    return expectedTotal;
  } catch (err) {
    console.error('Fallo en fetchExpectedTotal:', err);
    throw err;
  }
};

// Orquesta la persistencia del cierre diario y la actualizacion en cascada de los registros de venta.
export const executeDailyClose = async (expectedTotal, actualCash, difference) => {
  try {
    // Fase 1: Insercion del registro maestro del cierre.
    const { data: cierreData, error: insertError } = await supabase
      .from('cierres_diarios')
      .insert([
        {
          total_esperado: expectedTotal,
          efectivo_real: actualCash,
          diferencia: difference
        }
      ])
      .select('id');

    if (insertError) {
      throw new Error(`Error en persistencia de cierre: ${insertError.message}`);
    }

    if (!cierreData || cierreData.length === 0) {
      throw new Error('No se generó el ID referencial para el cierre');
    }

    const generatedCloseId = cierreData[0].id;

    // Fase 2: Mapeo de la llave foranea en los registros dependientes.
    const { error: updateError } = await supabase
      .from('ventas')
      .update({ cierre_diario_id: generatedCloseId })
      .is('cierre_diario_id', null);

    if (updateError) {
      throw new Error(`Error vinculando ventas al cierre: ${updateError.message}`);
    }

    return generatedCloseId;
  } catch (err) {
    console.error('Fallo en executeDailyClose:', err);
    throw err;
  }
};

// Retorna el desglose de ventas asociadas a un identificador de cierre especifico.
export const fetchSalesByCloseId = async (closeId) => {
  try {
    const { data, error } = await supabase
      .from('ventas')
      .select('sabor, precio')
      .eq('cierre_diario_id', closeId);

    if (error) {
      throw new Error(`Error leyendo desglose: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error('Fallo en fetchSalesByCloseId:', err);
    return [];
  }
};

// Retorna el historial reciente de cierres para auditoría
export const fetchRecentClosures = async (limitNum = 30) => {
  try {
    const { data, error } = await supabase
      .from('cierres_diarios')
      .select('*')
      .order('cerrado_en', { ascending: false })
      .limit(limitNum);

    if (error) {
      throw new Error(`Error recuperando historial: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error('Fallo en fetchRecentClosures:', err);
    return [];
  }
};

// Retorna las ventas actuales que aún no forman parte de ningún corte.
export const fetchPendingSales = async () => {
  try {
    const { data, error } = await supabase
      .from('ventas')
      .select('id, sabor, precio, creado_en')
      .is('cierre_diario_id', null)
      .order('creado_en', { ascending: false });

    if (error) {
      throw new Error(`Error recuperando ventas pendientes: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error('Fallo en fetchPendingSales:', err);
    return [];
  }
};

// Elimina una venta específica que aún no ha sido cerrada.
export const deletePendingSale = async (id) => {
  try {
    const { error } = await supabase
      .from('ventas')
      .delete()
      .eq('id', id)
      .is('cierre_diario_id', null);

    if (error) {
      throw new Error(`Fallo al eliminar venta: ${error.message}`);
    }
    return true;
  } catch (err) {
    console.error('Error de red al eliminar venta', err);
    throw err;
  }
};
