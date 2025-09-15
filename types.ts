export type EmployeeRecord = Record<string, any>;

export interface ParetoRecord {
  value: string;
  bajas: number;
  percentage: number;
  cumulative: number;
  classification: 'Core 80' | 'Cola 20';
}

export interface ParetoData {
  turno: ParetoRecord[];
  puesto: ParetoRecord[];
  area: ParetoRecord[];
  supervisor: ParetoRecord[];
  motivo_baja: ParetoRecord[];
}

export interface KMPoint {
  t_dias: number;
  S: number;
}

export interface KMConditionalPoint {
  fecha: Date;
  S: number;
  at_risk: number;
  events: number;
}

export interface SurvivalMetrics {
    S30: number;
    S60: number;
    S90: number;
    S180: number;
    S365: number;
    mediana: number | null;
    haz_0_30: number | null;
    haz_31_60: number | null;
    haz_61_90: number | null;
    S_end_cond: number;
    hazard_cond_mes: number;
}

export interface KMGroupData {
  group: string;
  n: number;
  'S(30)': number;
  'S(60)': number;
  'S(90)': number;
  'S(180)': number;
  'S(365)': number;
}

export interface CohortData {
  Cohorte: string;
  Tamaño: number;
  'S(90)': number;
}

// New Types for v4.4
export interface TrendDataPoint {
    ym_str: string;
    bajas: number;
}

export interface TrendFitData {
    x: string[];
    y: number[];
}

export interface TrendForecastPoint {
    x: string;
    y: number;
}

export interface TrendAnalysisData {
    historical: TrendDataPoint[];
    fit: TrendFitData | null;
    forecasts: TrendForecastPoint[];
    stats: {
        slope: number;
        r2: number;
        periods: number;
        totalBajas: number;
    } | null;
    hasData: boolean;
}

export interface HistoricalYoYDataPoint {
    ym_str: string;
    currentMonthBajas: number;
    previousYearMonthBajas: number | null;
    variationPct: number | null;
}

export interface MotivoDetail {
    empleado: string;
    nombre: string;
    fecha_baja: string; // formatted date
    comentario: string;
}

export interface MotivoCategoryData {
    category: string;
    count: number;
    details: MotivoDetail[];
}

export interface MotivosBarData {
    category: string;
    bajas: number;
}

export interface MotivosBarLineData {
    category: string;
    bajas: number;
    in_turno_pct: number;
}

export interface MotivosStackedData {
    category: string;
    [turno: string]: number | string;
}

export interface MotivosData {
    barras: MotivosBarData[];
    barrasLinea: {
        data: MotivosBarLineData[];
        turnoDominante: string;
    };
    stacked: {
        data: MotivosStackedData[];
        turnos: string[];
    };
    cards: MotivoCategoryData[];
    hasData: boolean;
    textCol: string | null;
    analysisType: 'ml' | 'keywords'; // To show the user which method was used
}

export interface ActionItem {
    accion: string;
    porque: string;
    como: string;
}

export interface AISummary {
    summary: string;
    actions: ActionItem[];
}

export interface DashboardData {
  clientName: string;
  period: { start: Date; end: Date };
  kpis: {
    // New main KPI
    HC_activos_c1: number;
    bajas_mes: number;
    rotacion_pct_cliente: number | null;
    // Old 3IRH-37 KPIs for reference
    HC_ini: number;
    HC_fin: number;
    HC_prom: number;
    rotacion_pct_3irh37: number | null;
  };
  pareto: ParetoData;
  km_global: KMPoint[];
  km_cond: KMConditionalPoint[];
  survival_metrics: SurvivalMetrics;
  surv_by_turno: KMGroupData[];
  surv_by_puesto: KMGroupData[];
  cohorts: CohortData[];
  // New sections
  motivos: MotivosData;
  trend: TrendAnalysisData;
  historicalYoY: HistoricalYoYDataPoint[];
  aiSummary: AISummary | null;
}

export type CorrectionsMap = Record<string, string>;