import { supabase } from '../supabaseClient';

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
  return weekNo;
}

// Guarda una compra semanal y sus detalles
export const guardarCompraSemanal = async (montoTotal, detalles) => {
  try {
    const fecha = new Date();
    const semana = getWeekNumber(fecha);
    const mes = fecha.getMonth() + 1; // 1-12

    // 1. Insertar la compra general
    const { data: compraData, error: compraError } = await supabase
      .from('compras_semanales')
      .insert([{ 
        monto_total_invertido: montoTotal, 
        semana_del_ano: semana, 
        mes: mes 
      }])
      .select();

    if (compraError) throw compraError;

    const compraId = compraData[0].id;

    // 2. Insertar los detalles (paletas compradas)
    if (detalles && detalles.length > 0) {
      const detallesAInsertar = detalles.map(d => ({
        compra_id: compraId,
        producto_id: d.producto_id,
        cantidad_comprada: d.cantidad
      }));

      const { error: detallesError } = await supabase
        .from('detalle_compras')
        .insert(detallesAInsertar);

      if (detallesError) throw detallesError;
    }

    return true;
  } catch (error) {
    console.error('Error al guardar la compra semanal', error);
    throw error;
  }
};

// Obtiene los datos del resumen semanal (inversion, ingresos, grafica)
export const obtenerResumenSemanal = async (targetDate = null) => {
  try {
    let lunes, domingo, semanaActual;

    if (targetDate) {
      // targetDate format: "2026-W32"
      const [yearStr, weekStr] = targetDate.split('-W');
      const year = parseInt(yearStr, 10);
      const week = parseInt(weekStr, 10);
      semanaActual = week;
      
      // Encontrar el lunes de la semana ISO
      const simple = new Date(year, 0, 1 + (week - 1) * 7);
      const dow = simple.getDay() || 7;
      const ISOweekStart = new Date(simple);
      ISOweekStart.setDate(simple.getDate() - dow + 1);
      
      lunes = new Date(ISOweekStart);
      lunes.setHours(0, 0, 0, 0);
      
      domingo = new Date(lunes.getTime());
      domingo.setDate(lunes.getDate() + 6);
      domingo.setHours(23, 59, 59, 999);
    } else {
      const fechaActual = new Date();
      semanaActual = getWeekNumber(fechaActual);
      
      const day = fechaActual.getDay();
      const diff = fechaActual.getDate() - day + (day === 0 ? -6 : 1);
      lunes = new Date(fechaActual.getTime());
      lunes.setDate(diff);
      lunes.setHours(0, 0, 0, 0);
      
      domingo = new Date(lunes.getTime());
      domingo.setDate(lunes.getDate() + 6);
      domingo.setHours(23, 59, 59, 999);
    }

    // 1. Obtener total invertido esta semana
    const { data: comprasData, error: comprasError } = await supabase
      .from('compras_semanales')
      .select('monto_total_invertido')
      .eq('semana_del_ano', semanaActual);

    if (comprasError) throw comprasError;

    const totalInvertido = comprasData.reduce((acc, curr) => acc + Number(curr.monto_total_invertido), 0);

    // 2. Obtener ventas de esta semana (para ingresos totales y grafica)
    const { data: ventasData, error: ventasError } = await supabase
      .from('ventas')
      .select('sabor, precio')
      .gte('creado_en', lunes.toISOString())
      .lte('creado_en', domingo.toISOString());

    if (ventasError) throw ventasError;

    const totalIngresos = ventasData.reduce((acc, curr) => acc + Number(curr.precio), 0);
    
    // 3. Agrupar ventas por sabor para la grafica de pastel y separar cortesías
    const ventasPorSaborMap = {};
    const courtesyMap = {};
    
    ventasData.forEach(v => {
      const isCourtesy = Number(v.precio) === 0;
      
      if (isCourtesy) {
        if (courtesyMap[v.sabor]) {
          courtesyMap[v.sabor].value += 1;
        } else {
          courtesyMap[v.sabor] = { name: v.sabor, value: 1 };
        }
      } else {
        if (ventasPorSaborMap[v.sabor]) {
          ventasPorSaborMap[v.sabor].value += 1; // Usamos 'value' que es el estandar para PieCharts
        } else {
          ventasPorSaborMap[v.sabor] = { name: v.sabor, value: 1 };
        }
      }
    });
    
    const datosGrafica = Object.values(ventasPorSaborMap);
    const courtesyData = Object.values(courtesyMap);

    // 4. Obtener cortes diarios (cierres_diarios) de esta semana
    const { data: closuresData, error: closuresError } = await supabase
      .from('cierres_diarios')
      .select('*')
      .gte('cerrado_en', lunes.toISOString())
      .lte('cerrado_en', domingo.toISOString())
      .order('cerrado_en', { ascending: true });

    if (closuresError) throw closuresError;

    return {
      totalInvertido,
      totalIngresos,
      gananciaNeta: totalIngresos - totalInvertido,
      datosGrafica,
      courtesyData,
      closures: closuresData || []
    };

  } catch (error) {
    console.error('Error al obtener el resumen semanal', error);
    throw error;
  }
};
