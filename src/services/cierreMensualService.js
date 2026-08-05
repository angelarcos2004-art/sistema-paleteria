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

    // Reduce map para totalizar frecuencia e ingresos segmentados, separando cortesías.
    const aggregatedSales = {};
    const aggregatedCourtesy = {};

    data.forEach((row) => {
      const flavorStr = row.sabor;
      const isCourtesy = Number(row.precio) === 0;

      if (isCourtesy) {
        if (!aggregatedCourtesy[flavorStr]) aggregatedCourtesy[flavorStr] = { name: flavorStr, cantidad: 0 };
        aggregatedCourtesy[flavorStr].cantidad += 1;
      } else {
        if (!aggregatedSales[flavorStr]) aggregatedSales[flavorStr] = { name: flavorStr, cantidad: 0, ingresos: 0 };
        aggregatedSales[flavorStr].cantidad += 1;
        aggregatedSales[flavorStr].ingresos += Number(row.precio);
      }
    });

    return {
      salesData: Object.values(aggregatedSales),
      courtesyData: Object.values(aggregatedCourtesy)
    };
  } catch (err) {
    console.error('Fallo en fetchMonthlySalesByFlavor', err);
    return { salesData: [], courtesyData: [] };
  }
};

// Obtiene el total invertido en el mes
export const fetchMonthlyInvestments = async (year, month) => {
  try {
    const numericMonth = month + 1; // Supabase guardó el mes como 1-12
    const { data, error } = await supabase
      .from('compras_semanales')
      .select('monto_total_invertido')
      .eq('mes', numericMonth);
      // Faltaría el año, pero por ahora en la tabla no hay columna de año explícita, solo fechas
      // Si la tabla crece a varios años, esto debería refactorizarse para usar gte/lte en 'fecha_registro'

    if (error) throw new Error(error.message);

    const totalInvertido = data.reduce((acc, row) => acc + Number(row.monto_total_invertido), 0);
    return totalInvertido;
  } catch (err) {
    console.error('Fallo en fetchMonthlyInvestments', err);
    return 0;
  }
};
