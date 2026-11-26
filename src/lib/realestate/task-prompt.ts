// Texto de la tarea programada de Cowork. Sin datos personales: las zonas y los precios
// los lee la propia tarea del dashboard con get_search_context.

export function taskPrompt(dashboardUrl: string): string {
  return `Cazador diario de pisos (inversión para alquiler de larga duración)

Usa el conector de mi dashboard (el mismo del cerebro).

1. Llama a get_search_context. Ahí están mis zonas por prioridad, el rango de precio, el tope excepcional, la aportación máxima (entrada + ITP), el ROI con apalancamiento objetivo, la rentabilidad bruta mínima y los anuncios que ya conoces.
2. Haz una búsqueda web nueva y real en portales públicos (Idealista, Fotocasa, Habitaclia, pisos.com, agencias locales y otras fuentes) en esas zonas y precios. No inventes anuncios ni datos.
3. Revisa los anuncios conocidos que sigan en juego: si ha cambiado el precio u otro dato, vuelve a guardarlos con save_listing; si ya no están publicados, márcalos con mark_removed.
4. Guarda con save_listing hasta 10 anuncios nuevos que merezcan la pena. Datos, no cálculos:
   - enlace directo, portal, municipio, barrio, precio y precio anterior si hubo rebaja, m², habitaciones, baños, planta, ascensor, estado, certificado energético, fecha de publicación y foto si la hay;
   - alquiler conservador (renta legal: índice de referencia o renta anterior), base y optimista a partir de comparables reales con enlace (rent_comparables). Comprueba si la zona está tensionada en Cataluña y, si lo está, pon la renta máxima legal en rent_cap con la explicación. No confundas el alquiler anunciado con la renta legalmente cobrable ni infles rentas;
   - comparables de venta, el €/m² de mercado de la zona y su revalorización anual estimada (appreciation, con la fuente);
   - coste estimado de reforma y de mobiliario para alquilarlo, y la comunidad y el IBI si aparecen;
   - precio objetivo solo si hay evidencia para negociar (tiempo publicado, rebajas, comparables), explicada en negotiation_evidence;
   - puntuación de 0 a 10 de demanda de alquiler, revalorización y seguridad (jurídica, técnica y de liquidez);
   - de dónde sale cada dato (verificado, anunciante o estimado), confianza alta, media o baja, una tesis breve, riesgos, lo pendiente de validar, documentos a pedir y próximos pasos. Si es el mismo piso en otro portal, pon esas URL en duplicates.
   No calcules rentabilidades, cuotas, cash flow, capital ni puntuaciones totales: los calcula el dashboard con mis supuestos.
5. No guardes los que tengan problemas jurídicos, de ocupación, de habitabilidad o de estructura sin solución verificable, ni los que dependan de usos potencialmente ilegales.
6. Termina con save_run_summary: anuncios examinados, guardados y 2 o 3 frases sobre la búsqueda de hoy.
7. En el chat responde solo con tres líneas: anuncios nuevos, rebajas o retirados, y el enlace ${dashboardUrl}/tareas/inmuebles. Si no tienes acceso a internet o no hay fuentes suficientes, dilo y no simules la búsqueda.`;
}
