import { supabase } from '../supabaseClient';

// Extrae el balance de todos los cierres diarios del mes especificado para la vista administrativa.
export const fetchMonthlyClosures = async (year, month) => {
  try {
    // Determinacion algoritmica de limites temporales. El parametro 0 en el dia infiere el ultimo dia real del mes.
    const firstDay = new Date(year, month, 1).toISOString();
    const lastDay = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from('cierres_diarios')
      .select('total_esperado, efectivo_real, diferencia, cerrado_en')
      .gte('cerrado_en', firstDay)
      .lte('cerrado_en', lastDay);

    if (error) throw new Error(error.message);
    return data;
  } catch (err) {
    console.error('Fallo en fetchMonthlyClosures', err);
    return [];
  }
};

// Genera un vector con las cantidades vendidas por sabor en el mes especificado, compatible con Recharts.
export const fetchMonthlySalesByFlavor = async (year, month) => {
  try {
    const firstDay = new Date(year, month, 1).toISOString();
    const lastDay = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from('ventas')
      .select('sabor, precio')
      .gte('creado_en', firstDay)
      .lte('creado_en', lastDay);

    if (error) throw new Error(error.message);

    // Reduce map para totalizar frecuencia e ingresos segmentados.
    const aggregatedData = data.reduce((acc, row) => {
      const flavorStr = row.sabor;
      if (!acc[flavorStr]) {
        acc[flavorStr] = { name: flavorStr, cantidad: 0, ingresos: 0 };
      }
      acc[flavorStr].cantidad += 1;
      acc[flavorStr].ingresos += Number(row.precio);
      return acc;
    }, {});

    return Object.values(aggregatedData);
  } catch (err) {
    console.error('Fallo en fetchMonthlySalesByFlavor', err);
    return [];
  }
};
