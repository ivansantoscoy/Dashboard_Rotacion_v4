import { EmployeeRecord, DashboardData, KMPoint, ParetoRecord, KMConditionalPoint, KMGroupData, CohortData, TrendAnalysisData, MotivosData, CorrectionsMap, HistoricalYoYDataPoint, AISummary } from '../types';
import { GoogleGenAI, Type } from '@google/genai';

// --- 0) Utilities & Parameters ---
const SPANISH_MONTHS: { [key: string]: number } = {
  "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
  "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9,
  "octubre": 10, "noviembre": 11, "diciembre": 12
};

const getSpanishMonthName = (monthNumber: number): string => {
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return monthNames[monthNumber - 1] || '';
};

const CANDIDATES: Record<string, string[]> = {
    "empleado": ["empleado", "empleado_", "empleado_#", "empleado#", "id_empleado", "no_empleado", "identificador", "num_empleado", "numero_empleado", "employee_id"],
    "nombre": ["nombre", "nombre_empleado", "empleado_nombre", "nombre_completo", "employee_name", "name", "nombre_trabajador"],
    "fecha_ingreso": ["fecha_ingreso", "fecha_de_ingreso", "fecha_contratacion", "fecha_de_alta", "f_alta", "alta", "fecha_alta", "fecha_de_alta_en_el_sistema"],
    "fecha_baja": ["fecha_baja", "fecha_de_baja", "fecha_de_baja_en_el_sistema", "fecha_ultimo_dia", "fecha_de_ultimo_dia_de_trabajo_udt", "f_baja", "fecha_evento_baja", "baja"],
    "clase": ["clase", "clase_personal", "clase_de_personal", "categoria", "class", "clasificacion", "clasificacion_personal", "grupo", "nivel"],
    "turno": ["turno", "shift"],
    "puesto": ["puesto", "posicion", "position", "job_title", "cargo"],
    "area": ["area", "área", "departamento", "depto", "dept", "area_depto"],
    "supervisor": ["supervisor", "jefe", "lider", "lead", "manager"],
    "tipo_baja": ["tipo_baja", "tipo_de_baja_en_el_sistema", "clasificacion_baja", "tipo", "causa_baja_tipo"],
    "motivo_baja": ["motivo_baja", "razon_de_renuncia", "motivo", "causa_baja", "razon_baja", "razon_capturada_en_sistema"]
};

const unidecode = (str: string): string => {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const parseExcelDate = (excelDate: number): Date | null => {
    if (typeof excelDate !== 'number' || isNaN(excelDate)) return null;
    const date = new Date(Date.UTC(1899, 11, 30, 0, 0, 0, 0) + excelDate * 86400000);
    return new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
};

const robustParseDate = (value: any): Date | null => {
    if (value === null || value === undefined) return null;
    if (value instanceof Date && !isNaN(value.getTime())) return value;
    if (typeof value === 'number') return parseExcelDate(value);
    if (typeof value === 'string') {
        const d = new Date(value);
        if (!isNaN(d.getTime())) return d;
    }
    return null;
}

const normalizeCols = (record: EmployeeRecord): EmployeeRecord => {
    const newRecord: EmployeeRecord = {};
    for (const key in record) {
        let newKey = key.trim().toLowerCase();
        newKey = newKey.replace(/[áä]/g, 'a').replace(/[éë]/g, 'e').replace(/[íï]/g, 'i').replace(/[óö]/g, 'o').replace(/[úü]/g, 'u').replace(/ñ/g, 'n');
        newKey = newKey.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        newRecord[newKey] = record[key];
    }
    return newRecord;
};

const mapColumns = (records: EmployeeRecord[]): EmployeeRecord[] => {
    if (!records || records.length === 0) return [];
    
    const firstRecordKeys = Object.keys(normalizeCols(records[0]));
    const mapping: { [key: string]: string } = {};

    for (const canon in CANDIDATES) {
        for (const opt of CANDIDATES[canon]) {
            if (firstRecordKeys.includes(opt)) {
                mapping[opt] = canon;
                break;
            }
        }
    }

    return records.map(rec => {
        const normalizedRec = normalizeCols(rec);
        const newRec: EmployeeRecord = {};
        for(const key in normalizedRec) {
            newRec[mapping[key] || key] = normalizedRec[key];
        }
        return newRec;
    });
};

const isClass1 = (val: any): boolean => {
    if (val === null || val === undefined) return false;
    const s = String(val).trim().toUpperCase();
    if (["1", "01", "CLASE 1", "CLASE1"].includes(s)) return true;
    try {
        return String(Math.floor(Number(s))) === "1";
    } catch {
        return false;
    }
};

const canonicalTipoBaja = (x: any): string => {
    const s = String(x || '').trim().toUpperCase().replace(/\./g, "");
    if (s.includes("RENUNCIA") || s === "RV") return "RV";
    if (s.includes("FALTA") || s === "BXF" || s.includes("CONSECUTIV")) return "BXF";
    return "OTRO";
};

const monthNameToNum = (s: string): number | null => {
  const lowerS = (s || "").trim().toLowerCase();
  return SPANISH_MONTHS[lowerS] || null;
}

const getMonthLastDay = (year: number, month: number): Date => new Date(Date.UTC(year, month + 1, 0));


// --- Survival Analysis Functions ---
const kmCurve = (times: number[], events: number[]): KMPoint[] => {
  const data = times.map((t, i) => ({ t, d: events[i] })).sort((a, b) => a.t - b.t);
  const eventTimes = [...new Set(data.filter(p => p.d === 1).map(p => p.t))].sort((a, b) => a - b);

  let S = 1.0;
  const curve: KMPoint[] = [{ t_dias: 0, S: 1.0 }];

  for (const t of eventTimes) {
      const atRisk = data.filter(p => p.t >= t).length;
      const nEvents = data.filter(p => p.t === t && p.d === 1).length;
      if (atRisk > 0) {
          S *= (1 - nEvents / atRisk);
          curve.push({ t_dias: t, S });
      }
  }
  return curve;
};

const sAt = (curve: KMPoint[], day: number): number => {
  const sub = curve.filter(p => p.t_dias <= day);
  return sub.length ? sub[sub.length - 1].S : 1.0;
};

const hazardBinRobusta = (km_base_df: EmployeeRecord[], t1: number, t2: number): number | null => {
    if (!km_base_df || km_base_df.length === 0) return null;
    const n_riesgo = km_base_df.filter(r => r.tiempo_dias >= t1).length;
    if (n_riesgo === 0) return null;
    const e_ventana = km_base_df.filter(r => r.evento === 1 && r.tiempo_dias > t1 && r.tiempo_dias <= t2).length;
    return e_ventana / n_riesgo;
};

// --- Other Calculation Functions ---
const paretoTable = (series: any[], label: string): ParetoRecord[] => {
    const counts: { [key: string]: number } = {};
    series.forEach(item => {
        const key = item === null || item === undefined || String(item).trim() === '' ? 'SIN DATO' : String(item).trim();
        counts[key] = (counts[key] || 0) + 1;
    });
    const total = series.length;
    if (total === 0) return [];
    let cumulative = 0;
    return Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .map(([value, bajas]) => {
            const percentage = (bajas / total) * 100;
            cumulative += percentage;
            return {
                value, bajas,
                percentage: parseFloat(percentage.toFixed(2)),
                cumulative: parseFloat(cumulative.toFixed(2)),
                classification: cumulative <= 80.01 ? 'Core 80' : 'Cola 20'
            };
        });
};

const safeBetween = (records: EmployeeRecord[], col: string, start: Date, end: Date): EmployeeRecord[] => {
    if(!records || records.length === 0) return [];
    return records.filter(r => {
        const d = r[col];
        return d instanceof Date && d >= start && d <= end;
    });
};

const kmConditionalMonth = (spells: EmployeeRecord[], eventsDf: EmployeeRecord[], startD: Date, endD: Date): KMConditionalPoint[] => {
    const atRisk = spells.filter(s => s.fecha_ingreso && s.fecha_ingreso <= startD && (!s.fecha_baja || s.fecha_baja > startD));
    if (atRisk.length === 0) return [];

    const eventMap = new Map<string, Date>();
    eventsDf.forEach(e => eventMap.set(String(e.empleado), e.fecha_baja));
    
    const monthlyEvents = atRisk
        .map(ar => ({...ar, event_date: eventMap.get(String(ar.empleado)) }))
        .filter(ar => ar.event_date && ar.event_date >= startD && ar.event_date <= endD);

    const perDay: Record<string, number> = {};
    monthlyEvents.forEach(ev => {
        if(ev.event_date) {
            const dateStr = ev.event_date.toISOString().split('T')[0];
            perDay[dateStr] = (perDay[dateStr] || 0) + 1;
        }
    });

    const dates: Date[] = [];
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) { dates.push(new Date(d)); }

    let n = atRisk.length;
    let S = 1.0;
    const rows: KMConditionalPoint[] = [{ fecha: new Date(startD.getTime() - 86400000), S:1.0, at_risk: n, events: 0 }];

    for (const d of dates) {
        const dateStr = d.toISOString().split('T')[0];
        const e = perDay[dateStr] || 0;
        if (n > 0 && e > 0) {
            S *= (1 - e / n);
            n -= e;
        }
        rows.push({ fecha: d, S, at_risk: n, events: e });
    }
    return rows;
}

// --- Motivos (Text Analysis) ---

export const CATEGORIAS_16: Record<string, string[]> = {
    "Mejor Oportunidad Salarial / Laboral": ["mejor oportunidad", "mejor oferta", "ofrecieron mas", "otro trabajo", "otra empresa", "empleo mejor pagado", "mejor pagado", "paga mejor", "sube sueldo", "cambio por salario", "cambio por sueldo", "cambio laboral"],
    "Problemas con el supervisor": ["jefe", "jefa", "supervisor", "lider", "coordinador", "gerente", "mando", "maltrato", "gritos", "humillacion", "falta de respeto", "prepotencia", "favoritismo", "injusticia", "represalias", "amenazas", "acoso laboral", "hostigamiento", "mal liderazgo", "abuso autoridad"],
    "Horarios / Turnos": ["turno", "rolar", "nocturno", "noche", "jornada", "horario", "horas extra", "descanso", "fin de semana", "12x12", "4x3", "disponibilidad", "entrada", "salida"],
    "Problemas con el área": ["area", "departamento", "depto", "linea", "no me gusta el area", "cambio de area", "me cambiaron de area"],
    "Falta de herramientas": ["falta de herramienta", "no hay herramientas", "equipo insuficiente", "equipo defectuoso", "no hay material", "insumos insuficientes"],
    "No le gusto el trabajo": ["no me gusto el trabajo", "no me gusto el puesto", "no era lo que esperaba", "no me adapte", "no me acostumbre", "no me convence"],
    "Problemas de salud": ["salud", "enfermo", "enfermedad", "operacion", "lesion", "dolor", "consulta medica", "medico", "terapia", "hospital", "incapacidad", "embarazo"],
    "Problema de transporte": ["transporte", "camion", "ruta", "retrasos transporte", "traslado", "distancia", "lejos", "no hay transporte"],
    "Problemas legales": ["legal", "proceso legal", "demanda", "cita judicial", "carcel", "policia", "detenido"],
    "Escuela": ["estudios", "escuela", "universidad", "prepa", "clases", "tareas", "examen", "horario escolar"],
    "Cuidado de hijos / Familiar enfermo": ["cuidado de hijos", "hijo enfermo", "familiar enfermo", "cuidar a mi mama", "cuidar a mi papa", "guarderia"],
    "Cambio de residencia / ciudad": ["mudanza", "cambio de residencia", "cambio de ciudad", "me voy a otra ciudad", "regreso a mi ciudad"],
    "Muerte de familiar": ["fallecimiento", "muerte de", "luto", "duelo", "funeral"],
    "Atender asuntos fuera de la ciudad": ["viaje", "salir de la ciudad", "fuera de la ciudad", "asuntos personales fuera"],
    "Ambiente laboral": ["ambiente", "clima", "equipo", "companeros", "conflictos", "chismes", "pleitos", "bullying", "discriminacion", "estres", "toxico", "mal ambiente"],
    "Capacitacion": ["capacitacion", "falta de capacitacion", "no me capacitaron", "entrenamiento", "no me ensenaron", "poca capacitacion"]
};

const assign_closed_set_local = (text: any): string => {
    if (!text || typeof text !== 'string') return "Otros/Revisar";
    const t = unidecode(text.toLowerCase().trim());
    if (t.length < 5) return "Otros/Revisar";
    for (const cat in CATEGORIAS_16) {
        for (const keyword of CATEGORIAS_16[cat]) {
            if (new RegExp(`\\b${unidecode(keyword)}\\b`, 'i').test(t)) return cat;
        }
    }
    return "Otros/Revisar";
};

// NEW: Function to call the Gemini API
async function analyzeMotivosWithML(comments: string[], corrections: CorrectionsMap): Promise<{ categories: string[], type: 'ml' | 'keywords' }> {
  // Helper function to centralize fallback logic and provide clear, contextual logging.
  const fallbackToKeywords = (reason: string, error?: any): { categories: string[], type: 'keywords' } => {
    console.warn(`[Fallback] ${reason}. Using keyword-based analysis.`);
    if (error) {
        // Log the full error object for detailed debugging.
        console.error("[Fallback Details]", error);
    }
    const fallbackCategories = comments.map(comment => assign_closed_set_local(comment));
    return { categories: fallbackCategories, type: 'keywords' };
  };

  if (!process.env.API_KEY) {
    return fallbackToKeywords("API_KEY environment variable not set");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const categoriesList = Object.keys(CATEGORIAS_16);
    const categoryDescriptions = categoriesList.map(cat => {
        return `- "${cat}": Relacionado con temas como: ${CATEGORIAS_16[cat].join(', ')}.`;
    }).join('\n');

    const systemInstruction = `Eres un analista experto en Recursos Humanos. Tu tarea es clasificar los comentarios de salida de empleados en una de las 16 categorías predefinidas. Debes devolver una categoría para CADA comentario, incluso si no estás seguro o el comentario es ambiguo. Analiza cuidadosamente el texto para encontrar la razón principal. Si un comentario menciona múltiples razones, basa tu clasificación en la primera o la más clara. La categoría "Otros/Revisar" no es una opción válida; debes elegir la mejor opción de la lista proporcionada.`;

    let examplesPrompt = '';
    if (Object.keys(corrections).length > 0) {
        const examples = Object.entries(corrections)
            .map(([comment, category]) => `- Comentario: "${comment}" -> Categoría Correcta: "${category}"`)
            .join('\n');
        examplesPrompt = `Para mejorar tu precisión, aquí tienes algunos ejemplos de clasificaciones correctas realizadas por un humano. Úsalos como guía:\n${examples}\n\n---\n\n`;
    }

    const prompt = `${examplesPrompt}Clasifica los siguientes ${comments.length} comentarios de salida de empleados. Para cada uno, asigna la categoría más apropiada de la lista a continuación.

**Categorías Disponibles (Usa el nombre exacto):**
${categoryDescriptions}

**Instrucciones de formato:**
Devuelve tu respuesta como un objeto JSON con una única clave "categorized_comments", que es un array de strings. El array debe tener exactamente ${comments.length} elementos, donde cada string es la categoría asignada para el comentario correspondiente en el mismo orden.

**Comentarios a clasificar:**
${JSON.stringify(comments)}`;
    
    console.log("[Gemini] Sending request to analyze comments...");
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    categorized_comments: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.STRING,
                        },
                    },
                },
                required: ['categorized_comments'],
            },
        },
    });

    const jsonText = response.text?.trim();
    if (!jsonText) {
        return fallbackToKeywords("Gemini API returned an empty text response.");
    }
    
    let parsed;
    try {
        parsed = JSON.parse(jsonText);
    } catch (parseError) {
        return fallbackToKeywords("Failed to parse JSON response from Gemini API", { parseError, responseText: jsonText });
    }
    
    if (!parsed.categorized_comments || !Array.isArray(parsed.categorized_comments) || parsed.categorized_comments.length !== comments.length) {
      return fallbackToKeywords("Gemini API response format is invalid or does not match expected structure.", { parsedResponse: parsed });
    }
    
    console.log("[Gemini] Successfully analyzed comments with Gemini AI.");
    return { categories: parsed.categorized_comments, type: 'ml' };

  } catch (apiError) {
    return fallbackToKeywords("An error occurred during the Gemini API call", apiError);
  }
}


async function generateAISummary(data: DashboardData): Promise<AISummary | null> {
    if (!process.env.API_KEY) {
        console.warn("API key not found. Skipping AI summary generation.");
        return null;
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const systemInstruction = "Actúa como un Director de Recursos Humanos y consultor de negocios, especializado en la industria de manufactura (maquiladoras) bajo un modelo de shelter. Tu análisis debe ser cuantitativo, directo y orientado a la acción. Traduce los datos en insights de negocio y recomienda soluciones prácticas y de bajo costo que el equipo de RH en planta pueda implementar. El tono debe ser profesional y de alto nivel.";

        let dataSummary = `Análisis de Rotación de Personal para ${data.clientName}
Periodo: ${data.period.start.toLocaleDateString('es-ES')} - ${data.period.end.toLocaleDateString('es-ES')}

**1. Situación General (KPIs):**
- Rotación Mensual: ${data.kpis.rotacion_pct_cliente?.toFixed(2) ?? 'N/A'}%
- Bajas del Mes (Clase 1): ${data.kpis.bajas_mes}
- Headcount Activo (Clase 1): ${data.kpis.HC_activos_c1}
`;

        if (data.trend.stats) {
            dataSummary += `- Tendencia de Bajas: ${data.trend.stats.slope > 0.1 ? 'En aumento' : data.trend.stats.slope < -0.1 ? 'En disminución' : 'Estable'}.\n`;
        }
        const lastYoY = data.historicalYoY[data.historicalYoY.length - 1];
        if (lastYoY && lastYoY.variationPct !== null) {
            dataSummary += `- Comparativa Anual: Este mes tuvo un ${Math.abs(lastYoY.variationPct).toFixed(1)}% ${lastYoY.variationPct > 0 ? 'más' : 'menos'} bajas que el mismo mes del año anterior.\n`;
        }

        dataSummary += `
**2. Diagnóstico de Causa Raíz (¿Dónde y por qué?):**
- **Puntos Críticos (Pareto):**
  - Turno con más bajas: ${data.pareto.turno[0]?.value ?? 'N/A'} (${data.pareto.turno[0]?.bajas ?? 0} bajas, ${data.pareto.turno[0]?.percentage?.toFixed(1) ?? 'N/A'}% del total).
  - Puesto con más bajas: ${data.pareto.puesto[0]?.value ?? 'N/A'} (${data.pareto.puesto[0]?.bajas ?? 0} bajas, ${data.pareto.puesto[0]?.percentage?.toFixed(1) ?? 'N/A'}% del total).
  - Supervisor con más bajas: ${data.pareto.supervisor[0]?.value ?? 'N/A'} (${data.pareto.supervisor[0]?.bajas ?? 0} bajas, ${data.pareto.supervisor[0]?.percentage?.toFixed(1) ?? 'N/A'}% del total).
- **Principales Motivos de Renuncia (Comentarios de empleados):**
  1. ${data.motivos.barras[0]?.category ?? 'N/A'} (${data.motivos.barras[0]?.bajas ?? 0} casos)
  2. ${data.motivos.barras[1]?.category ?? 'N/A'} (${data.motivos.barras[1]?.bajas ?? 0} casos)
  3. ${data.motivos.barras[2]?.category ?? 'N/A'} (${data.motivos.barras[2]?.bajas ?? 0} casos)
`;

        dataSummary += `
**3. Diagnóstico de Retención (¿Cuándo se van?):**
- **Retención a 90 días (S90):** ${(data.survival_metrics.S90 * 100).toFixed(1)}%. (Esto significa que de cada 100 empleados nuevos, se espera que ${(100 - (data.survival_metrics.S90 * 100)).toFixed(0)} causen baja antes de cumplir 3 meses).
- **Riesgo de Baja Temprana (Probabilidad de renuncia para un nuevo ingreso):**
  - En los primeros 30 días: ${data.survival_metrics.haz_0_30 ? (data.survival_metrics.haz_0_30 * 100).toFixed(1) : 'N/A'}%.
  - Entre el día 31 y 60: ${data.survival_metrics.haz_31_60 ? (data.survival_metrics.haz_31_60 * 100).toFixed(1) : 'N/A'}%.
- **Mediana de Supervivencia:** ${data.survival_metrics.mediana ? `${data.survival_metrics.mediana} días` : 'No alcanzada (más del 50% permanece más allá del periodo observado)'}.
`;

        const prompt = `
Basado ESTRICTAMENTE en los siguientes datos, genera un "Diagnóstico" y un "Plan de Acción Sugerido".

**DATOS:**
${dataSummary}

**INSTRUCCIONES DE SALIDA:**
1.  **Diagnóstico:**
    - Escribe un párrafo introductorio corto (2-3 líneas), directo y específico que resuma la situación general de la rotación.
    - Después del párrafo, añade una lista de viñetas (usando '*' al inicio de cada línea) con los insights más importantes.
    - **IMPORTANTE:** Evita frases genéricas y redundantes como "exige acción inmediata", "es un área de oportunidad crítica" o "necesidad urgente de intervención". Sé directo y cuantitativo.
    - Cada viñeta debe ser un hallazgo específico basado en los datos.
    - Conecta el 'dónde' (Pareto), el 'por qué' (Motivos) y el 'cuándo' (Supervivencia).
    - Incluye insights predictivos basados en los datos de retención. Por ejemplo: "La probabilidad de que un nuevo empleado renuncie en su primer mes es del X%".

2.  **Plan de Acción Sugerido:**
    - Genera una lista de 3 a 4 acciones concretas, priorizadas y factibles para un equipo de RH en una planta de maquila.
    - Para cada acción, detalla el 'QUÉ' (la acción), 'POR QUÉ' (el dato que la justifica), y 'CÓMO' (pasos prácticos para implementarla).
    - Las soluciones deben ser de bajo costo y alto impacto, enfocadas en mejorar la supervisión, el proceso de onboarding y la comunicación.
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        diagnostico: { type: Type.STRING, description: "Un resumen de la rotación, comenzando con un párrafo introductorio seguido de una lista de viñetas con insights cuantitativos y predictivos." },
                        plan_de_accion: {
                            type: Type.ARRAY,
                            items: { 
                                type: Type.OBJECT,
                                properties: {
                                    accion: { type: Type.STRING, description: "El título de la acción. Ej: 'Intervención Focalizada con Supervisor X'." },
                                    porque: { type: Type.STRING, description: "El dato clave que justifica esta acción." },
                                    como: { type: Type.STRING, description: "Pasos prácticos y detallados para implementar la acción en planta, usando saltos de línea para listar los pasos." }
                                },
                                required: ['accion', 'porque', 'como']
                            },
                            description: "Una lista de 3 a 4 acciones específicas, detallando QUÉ, POR QUÉ y CÓMO."
                        }
                    },
                    required: ['diagnostico', 'plan_de_accion']
                }
            }
        });

        const jsonText = response.text.trim();
        const parsed = JSON.parse(jsonText);
        
        if (!parsed.diagnostico || !parsed.plan_de_accion) {
            throw new Error("Invalid response from AI model.");
        }
        
        return {
            summary: parsed.diagnostico,
            actions: parsed.plan_de_accion
        };

    } catch (error) {
        console.error("Error generating AI summary:", error);
        return null;
    }
}

const detectTextCol = (records: EmployeeRecord[]): string | null => {
    if (!records || records.length === 0) return null;
    const columns = Object.keys(records[0]);
    const priority = [/encuesta.*salida.*4frh/, /4frh.*encuesta.*salida/, /encuesta.*salida/];
    
    for (const p of priority) {
        const found = columns.find(c => p.test(unidecode(c.toLowerCase())));
        if (found) return found;
    }
    
    const candidates = columns.filter(c => /encuesta|salida|coment|observac|motivo/i.test(unidecode(c.toLowerCase())));
    return candidates[0] || null;
}

// --- Trend Analysis ---
const linearRegression = (x: number[], y: number[]): { m: number, b: number, r2: number } => {
    const n = x.length;
    if (n < 2) return { m: 0, b: y[0] || 0, r2: 0 };
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += x[i]; sumY += y[i]; sumXY += x[i] * y[i]; sumX2 += x[i] * x[i];
    }
    const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const b = (sumY - m * sumX) / n;
    
    let ssTot = 0, ssRes = 0;
    const yMean = sumY / n;
    for (let i = 0; i < n; i++) {
        ssTot += (y[i] - yMean) ** 2;
        ssRes += (y[i] - (m * x[i] + b)) ** 2;
    }
    const r2 = ssTot === 0 ? 1 : 1 - (ssRes / ssTot);
    return { m, b, r2 };
}

// --- Main Processing Function ---
async function readFile(file: File): Promise<EmployeeRecord[]> {
    return new Promise((resolve, reject) => {
        if (!window.XLSX) {
            return reject(new Error("XLSX library not loaded"));
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = window.XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = window.XLSX.utils.sheet_to_json(worksheet, { defval: null });
                resolve(json as EmployeeRecord[]);
            } catch (err) { reject(err); }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}

export async function processFiles(
  activoFile: File,
  bajasFile: File,
  matrizFile: File,
  corrections: CorrectionsMap = {}
): Promise<DashboardData> {
    // 1) File Reading and Name Parsing
    let clientName: string = "Cliente";
    let mesNombre: string | undefined;

    [activoFile, bajasFile, matrizFile].forEach(f => {
        const clean = f.name.toLowerCase().replace(/\s*\(\d+\)\s*/, '').replace(/\.xlsx$|\.xls$/, '');
        if (clean.startsWith("activo_")) clientName = clean.replace(/^activo_/, '');
        else if (clean.startsWith("bajas_")) clientName = clean.replace(/^bajas_/, '');
        else if (clean.startsWith("matrizrotacion_")) {
            const parts = clean.replace(/^matrizrotacion_/, '').split('_');
            if (parts.length >= 2) {
                if (clientName === 'Cliente') clientName = parts[0];
                mesNombre = parts[parts.length - 1];
            }
        }
    });
    clientName = clientName.charAt(0).toUpperCase() + clientName.slice(1);

    const [rawAct, rawBaj, rawMat] = await Promise.all([readFile(activoFile), readFile(bajasFile), readFile(matrizFile)]);
    
    // 2) Data Cleaning and Standardization
    const cleanAndMap = (df: EmployeeRecord[], name: string): EmployeeRecord[] => {
        if (df.length === 0) return [];
        let mapped = mapColumns(df);
        if (!mapped.some(r => r && r.empleado !== undefined)) { mapped.forEach((r, i) => r.empleado = `temp_${name}_${i + 1}`); }
        if (!mapped.some(r => r && r.clase !== undefined)) { mapped.forEach(r => r.clase = "1"); }
        return mapped.map(r => ({
            ...r,
            empleado: String(r.empleado || '').trim(),
            clase: String(r.clase || '1').trim(),
            fecha_ingreso: robustParseDate(r.fecha_ingreso),
            fecha_baja: robustParseDate(r.fecha_baja),
        }));
    };
    
    let act = cleanAndMap(rawAct, 'act');
    let baj = cleanAndMap(rawBaj, 'baj');
    let mat = cleanAndMap(rawMat, 'mat');

    // 2.1) Enrich Bajas with Matriz
    const matForJoin = new Map<string, EmployeeRecord>();
    mat.forEach(r => {
        if (r.empleado && r.fecha_baja instanceof Date) {
            const key = `${r.empleado}_${r.fecha_baja.toISOString().split('T')[0]}`;
            matForJoin.set(key, r);
        }
    });

    let baj_enrich = baj.map(r => {
        const enriched = {...r};
        if(r.empleado && r.fecha_baja instanceof Date) {
            const key = `${r.empleado}_${r.fecha_baja.toISOString().split('T')[0]}`;
            const matRec = matForJoin.get(key);
            if(matRec) {
                for (const col of ["tipo_baja", "motivo_baja", "turno", "puesto", "area", "supervisor", "nombre"]) {
                    if ((enriched[col] === undefined || enriched[col] === null || String(enriched[col]).trim() === '') && matRec[col]) {
                        enriched[col] = matRec[col];
                    }
                }
            }
        }
        enriched.tipo_baja = canonicalTipoBaja(enriched.tipo_baja);
        return enriched;
    });
    
    const hasRvBxf = baj_enrich.some(r => ["RV", "BXF"].includes(r.tipo_baja));
    const matHasTipoBaja = mat.some(r => r.tipo_baja !== undefined && r.tipo_baja !== null);

    if (!hasRvBxf && matHasTipoBaja) {
        const matRvBxfByEmp = new Map<string, string>();
        mat.forEach(r => {
            const tipo = canonicalTipoBaja(r.tipo_baja);
            if (r.empleado && ["RV", "BXF"].includes(tipo)) {
                if (!matRvBxfByEmp.has(String(r.empleado))) {
                    matRvBxfByEmp.set(String(r.empleado), tipo);
                }
            }
        });

        if (matRvBxfByEmp.size > 0) {
            baj_enrich = baj_enrich.map(r => {
                if (!["RV", "BXF"].includes(r.tipo_baja)) {
                    const matTipo = matRvBxfByEmp.get(String(r.empleado));
                    if (matTipo) {
                        return { ...r, tipo_baja: matTipo };
                    }
                }
                return r;
            });
        }
    }

    // 3) Period Definition
    const today = new Date();
    let mnum = mesNombre ? monthNameToNum(mesNombre) : null;
    let year = today.getUTCFullYear();
    
    if (!mnum) {
        const maxBajaDate = [...baj_enrich, ...mat]
            .map(r => r.fecha_baja)
            .filter((d): d is Date => d instanceof Date)
            .reduce((max, d) => d > max ? d : max, new Date(0));
        
        if (maxBajaDate.getTime() > 0) {
            mnum = maxBajaDate.getUTCMonth() + 1;
            year = maxBajaDate.getUTCFullYear();
        } else {
            mnum = today.getUTCMonth() + 1;
        }
    }
    
    const periodStart = new Date(Date.UTC(year, mnum - 1, 1));
    const periodEnd = getMonthLastDay(year, mnum - 1);

    // 4) Filtering
    const act_c1 = act.filter(r => isClass1(r.clase));
    const baj_c1_all_types = baj_enrich.filter(r => isClass1(r.clase)); 
    let baj_c1 = baj_c1_all_types.filter(r => ["RV", "BXF"].includes(canonicalTipoBaja(r.tipo_baja)));
    let mat_c1 = mat.filter(r => isClass1(r.clase) && ["RV", "BXF"].includes(canonicalTipoBaja(r.tipo_baja)));
    
    const spells_c1_map = new Map<string, EmployeeRecord>();
    act_c1.forEach(r => spells_c1_map.set(r.empleado, r));
    baj_c1.forEach(r => { 
        const existing = spells_c1_map.get(r.empleado);
        if (!existing || !existing.fecha_baja) {
            spells_c1_map.set(r.empleado, { ...existing, ...r });
        }
    });
    const spells_c1 = Array.from(spells_c1_map.values());

    // 5) KPI Calculation
    const headcountAt = (spells: EmployeeRecord[], d: Date): number =>
        spells.filter(r => r.fecha_ingreso && r.fecha_ingreso <= d && (!r.fecha_baja || r.fecha_baja > d)).length;
    
    const HC_ini = headcountAt(spells_c1, periodStart);
    const HC_fin = headcountAt(spells_c1, new Date(periodEnd.getTime() + 86400000));
    const HC_prom = (HC_ini + HC_fin) / 2;
    
    const bajas_mes_df = safeBetween(baj_c1, 'fecha_baja', periodStart, periodEnd);
    const bajas_mes = bajas_mes_df.length;
    const HC_activos_c1 = new Set(act_c1.map(r => r.empleado)).size;

    const rotacion_pct_cliente = HC_activos_c1 > 0 ? (bajas_mes / HC_activos_c1 * 100) : null;
    const rotacion_pct_3irh37 = HC_activos_c1 > 0 ? (bajas_mes / HC_activos_c1 * 100) : null;
    
    // 6) Pareto (except for motivo_baja, which is handled after ML analysis)
    const mat_mes = safeBetween(mat_c1, 'fecha_baja', periodStart, periodEnd);
    
    // Create lookup maps for both sources for efficient merging.
    const bajasMesMap = new Map<string, EmployeeRecord>();
    bajas_mes_df.forEach(r => r.empleado && bajasMesMap.set(String(r.empleado), r));

    const matMesMap = new Map<string, EmployeeRecord>();
    mat_mes.forEach(r => r.empleado && matMesMap.set(String(r.empleado), r));

    // Combine all unique employee IDs from both lists to ensure no one is missed.
    const allEmployeeIds = new Set([...bajasMesMap.keys(), ...matMesMap.keys()]);

    // Build a unified and enriched data source for Pareto analysis.
    const paretoSource = Array.from(allEmployeeIds).map(empId => {
        const bajaRecord = bajasMesMap.get(empId) || {};
        const matRecord = matMesMap.get(empId) || {};
        
        // Merge records by starting with the Matriz data and overwriting with Bajas data.
        // This prioritizes the Bajas file for columns present in both, addressing the
        // user's issue where 'Turno' is correct in Bajas but missing in Matriz.
        return { ...matRecord, ...bajaRecord };
    });

    const pareto: DashboardData['pareto'] = {
        turno: paretoTable(paretoSource.map(r => r.turno), 'turno'),
        puesto: paretoTable(paretoSource.map(r => r.puesto), 'puesto'),
        area: paretoTable(paretoSource.map(r => r.area), 'area'),
        supervisor: paretoTable(paretoSource.map(r => r.supervisor), 'supervisor'),
        motivo_baja: [], // Will be populated after text analysis
    };
    
    // 7) Survival Analysis
    const FECHA_CORTE = new Date();
    const buildKmFrame = (spells: EmployeeRecord[]) => {
        return spells.map(r => {
            const evento = (r.fecha_baja && ["RV", "BXF"].includes(canonicalTipoBaja(r.tipo_baja))) ? 1 : 0;
            const t_evento = r.fecha_baja || FECHA_CORTE;
            const tiempo_dias = r.fecha_ingreso ? Math.floor((t_evento.getTime() - r.fecha_ingreso.getTime()) / 86400000) : -1;
            return {...r, evento, tiempo_dias};
        }).filter(r => r.tiempo_dias >= 0);
    };

    const km_base = buildKmFrame(spells_c1);
    const km_global = kmCurve(km_base.map(r => r.tiempo_dias), km_base.map(r => r.evento));
    
    const mediana = km_global.find(p => p.S <= 0.5)?.t_dias || null;
    const km_cond = kmConditionalMonth(spells_c1, bajas_mes_df, periodStart, periodEnd);
    const S_end_cond = km_cond.length > 0 ? km_cond[km_cond.length - 1].S : 1;

    const survival_metrics: DashboardData['survival_metrics'] = {
      S30: sAt(km_global, 30), S60: sAt(km_global, 60), S90: sAt(km_global, 90),
      S180: sAt(km_global, 180), S365: sAt(km_global, 365),
      mediana,
      haz_0_30: hazardBinRobusta(km_base, 0, 30),
      haz_31_60: hazardBinRobusta(km_base, 30, 60),
      haz_61_90: hazardBinRobusta(km_base, 60, 90),
      S_end_cond: S_end_cond,
      hazard_cond_mes: 1 - S_end_cond,
    };
    
    const kmGroup = (df: EmployeeRecord[], by: string): KMGroupData[] => {
        const groups: Record<string, EmployeeRecord[]> = df.reduce((acc, r) => {
            const key = r[by] || 'SIN DATO';
            if (!acc[key]) acc[key] = [];
            acc[key].push(r);
            return acc;
        }, {});

        return Object.entries(groups)
            .filter(([, sub]) => sub.length >= 5)
            .map(([g, sub]) => {
                const cur = kmCurve(sub.map(r => r.tiempo_dias), sub.map(r => r.evento));
                return { group: g, n: sub.length, 'S(30)': sAt(cur, 30), 'S(60)': sAt(cur, 60), 'S(90)': sAt(cur, 90), 'S(180)': sAt(cur, 180), 'S(365)': sAt(cur, 365) };
            }).sort((a,b) => a['S(90)'] - b['S(90)']);
    };
    
    const surv_by_turno = kmGroup(km_base, 'turno');
    const surv_by_puesto = kmGroup(km_base, 'puesto');

    const cohortGroups: Record<string, EmployeeRecord[]> = spells_c1.reduce((acc, r) => {
        if (r.fecha_ingreso) {
            const key = `${r.fecha_ingreso.getUTCFullYear()}-${String(r.fecha_ingreso.getUTCMonth()+1).padStart(2,'0')}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(r);
        }
        return acc;
    }, {});

    const cohorts: CohortData[] = Object.entries(cohortGroups).map(([coh, sub]) => {
        if (sub.length < 5) return null;
        const tmp = buildKmFrame(sub);
        const cur = kmCurve(tmp.map(r => r.tiempo_dias), tmp.map(r => r.evento));
        return { Cohorte: coh, Tamaño: sub.length, 'S(90)': sAt(cur, 90) };
    }).filter((c): c is CohortData => c !== null).sort((a,b) => a.Cohorte.localeCompare(b.Cohorte));
    
    // 8) Trend Analysis
    let trend: TrendAnalysisData = { historical: [], fit: null, forecasts: [], stats: null, hasData: false };
    const monthlyData: Record<string, number> = baj_c1_all_types.filter(r => r.fecha_baja)
      .reduce((acc, r) => {
        const ym = `${r.fecha_baja.getUTCFullYear()}-${String(r.fecha_baja.getUTCMonth()+1).padStart(2,'0')}`;
        acc[ym] = (acc[ym] || 0) + 1;
        return acc;
      }, {});
    
    const sortedMonths = Object.keys(monthlyData).sort();
    if (sortedMonths.length >= 3) {
        trend.hasData = true;
        trend.historical = sortedMonths.map(ym => ({ ym_str: ym, bajas: monthlyData[ym] }));
        const x = Array.from({ length: sortedMonths.length }, (_, i) => i);
        const y = sortedMonths.map(ym => monthlyData[ym]);
        const { m, b, r2 } = linearRegression(x, y);
        trend.stats = { slope: m, r2: r2, periods: sortedMonths.length, totalBajas: y.reduce((s, c) => s + c, 0) };
        trend.fit = { x: sortedMonths, y: x.map(val => m * val + b) };

        let [lastYear, lastMonth] = sortedMonths[sortedMonths.length - 1].split('-').map(Number);
        for (let i = 1; i <= 2; i++) {
            lastMonth++;
            if (lastMonth > 12) { lastMonth = 1; lastYear++; }
            const nextYm = `${lastYear}-${String(lastMonth).padStart(2, '0')}`;
            trend.forecasts.push({ x: nextYm, y: m * (sortedMonths.length + i - 1) + b });
        }
    }

    // 9) Historical Year-over-Year Comparison
    let historicalYoY: HistoricalYoYDataPoint[] = [];
    if (trend.hasData) {
        const historicalMap = new Map(trend.historical.map(p => [p.ym_str, p.bajas]));
        
        for (const point of trend.historical) {
            const [year, month] = point.ym_str.split('-').map(Number);
            const prevYearYmStr = `${year - 1}-${String(month).padStart(2, '0')}`;
            const previousYearMonthBajas = historicalMap.get(prevYearYmStr) || null;
            
            let variationPct: number | null = null;
            if (previousYearMonthBajas !== null) {
                if (previousYearMonthBajas > 0) {
                    variationPct = ((point.bajas / previousYearMonthBajas) - 1) * 100;
                } else {
                    variationPct = point.bajas > 0 ? Infinity : 0; // Handle division by zero
                }
            }
            
            historicalYoY.push({
                ym_str: point.ym_str,
                currentMonthBajas: point.bajas,
                previousYearMonthBajas: previousYearMonthBajas,
                variationPct: variationPct
            });
        }
    }


    // 10) Motivos Analysis and Unified Pareto for Motivos
    let motivos: MotivosData = { barras: [], barrasLinea: { data: [], turnoDominante: '' }, stacked: { data: [], turnos: [] }, cards: [], hasData: false, textCol: null, analysisType: 'keywords' };
    const textDataSource = paretoSource;
    
    const textCol = detectTextCol(textDataSource);
    
    if (textDataSource.length > 0 && textCol) {
        motivos.textCol = textCol;
        
        const commentsToAnalyze = textDataSource
            .filter(r => r[textCol] && String(r[textCol]).trim().length >= 5)
            .map(r => String(r[textCol]));
        
        if (commentsToAnalyze.length > 0) {
            const { categories, type } = await analyzeMotivosWithML(commentsToAnalyze, corrections);
            motivos.analysisType = type;
            
            let commentIndex = 0;
            const filteredDataSource = textDataSource.filter(r => r[textCol] && String(r[textCol]).trim().length >= 5);

            // Create a map of employee profiles for easy lookup
            const spellsMap = new Map<string, EmployeeRecord>(spells_c1.map(r => [r.empleado, r]));

            const df_txt = filteredDataSource.map((r): EmployeeRecord & { motivo_canonico_texto: string } => {
                const fullProfile = spellsMap.get(String(r.empleado)) || {};
                const commentText = String(r[textCol] || '');
                const correctedCategory = corrections[commentText];
                
                return {
                    ...fullProfile, // Base profile with name, etc.
                    ...r,           // Overwrite with specific data from comment source (e.g., more accurate fecha_baja)
                    motivo_canonico_texto: correctedCategory || categories[commentIndex++]
                };
            });


            if (df_txt.length > 0) {
                motivos.hasData = true;
                const groupedByCategory = df_txt.reduce((acc, r) => {
                    const category = r.motivo_canonico_texto;
                    if (!acc[category]) {
                        acc[category] = [];
                    }
                    acc[category].push(r);
                    return acc;
                }, {} as Record<string, typeof df_txt>);

                motivos.barras = Object.entries(groupedByCategory)
                    .map(([category, records]) => ({ category: category, bajas: records.length }))
                    .sort((a, b) => b.bajas - a.bajas);
                
                motivos.cards = motivos.barras.slice(0, 12).map(({ category }) => {
                    const recordsForCategory = groupedByCategory[category] || [];
                    return {
                        category: category,
                        count: recordsForCategory.length,
                        details: recordsForCategory
                            .sort((a, b) => (b.fecha_baja?.getTime() || 0) - (a.fecha_baja?.getTime() || 0))
                            .map(r => ({
                                empleado: String(r.empleado || ''),
                                nombre: String(r.nombre || ''),
                                fecha_baja: r.fecha_baja?.toISOString().split('T')[0] || 'N/A',
                                comentario: String(r[textCol] || '')
                            }))
                    };
                });

                // Populate the Pareto for 'motivo_baja' using the ML-classified results
                pareto.motivo_baja = paretoTable(df_txt.map(r => r.motivo_canonico_texto), 'motivo_baja');
            }
        }
    }
    
    // Fallback: If Pareto for 'motivo_baja' was not populated by ML analysis, use the raw data.
    if (pareto.motivo_baja.length === 0) {
        pareto.motivo_baja = paretoTable(paretoSource.map(r => r.motivo_baja), 'motivo_baja');
    }

    // 11) Generate AI Summary
    const dashboardDataWithoutSummary: DashboardData = {
        clientName,
        period: { start: periodStart, end: periodEnd },
        kpis: { HC_activos_c1, bajas_mes, rotacion_pct_cliente, HC_ini, HC_fin, HC_prom, rotacion_pct_3irh37 },
        pareto,
        km_global,
        survival_metrics,
        km_cond,
        surv_by_turno,
        surv_by_puesto,
        cohorts,
        trend,
        motivos,
        historicalYoY,
        aiSummary: null
    };

    const aiSummary = await generateAISummary(dashboardDataWithoutSummary);

    return {
        ...dashboardDataWithoutSummary,
        aiSummary,
    };
}