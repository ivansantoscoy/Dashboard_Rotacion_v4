import React, { useState, useRef, useEffect, useMemo } from 'react';
import { DashboardData, ParetoRecord, MotivoCategoryData, MotivoDetail, CorrectionsMap, TrendDataPoint, HistoricalYoYDataPoint, MotivosData } from '../types';
import Plot from './Plot';
import { PlotData, Layout } from 'plotly.js';
import { CATEGORIAS_16 } from '../services/analytics';


interface DashboardProps {
  data: DashboardData;
}

const KPICard: React.FC<{ title: string; value: string | number | null; helpText?: string }> = ({ title, value, helpText }) => (
  <div className="bg-white p-6 rounded-xl shadow-md flex flex-col justify-between">
    <div>
      <h3 className="text-sm font-medium text-gray-500 truncate">{title}</h3>
      <p className="mt-1 text-3xl font-semibold text-gray-900">{value === null || value === undefined ? 'N/A' : value}</p>
    </div>
    {helpText && <p className="text-xs text-gray-400 mt-2">{helpText}</p>}
  </div>
);

const DataTable: React.FC<{ headers: string[]; data: (string | number)[][]; title: string }> = ({ headers, data, title }) => (
    <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        {headers.map(header => (
                            <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((row, i) => (
                        <tr key={i}>
                            {row.map((cell, j) => (
                                <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{cell}</td>
                            ))}
                        </tr>
                    ))}
                    {data.length === 0 && (
                        <tr>
                            <td colSpan={headers.length} className="px-6 py-4 text-center text-sm text-gray-500">No hay datos disponibles.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

interface StagedMove {
    detail: MotivoDetail;
    oldCategory: string;
    newCategory: string;
}

const MotivoCard: React.FC<{
    card: MotivoCategoryData;
    onStageCorrection: (detail: MotivoDetail, oldCategory: string, newCategory: string) => void;
    stagedMoves: StagedMove[];
}> = ({ card, onStageCorrection, stagedMoves }) => {
    const [displayedRows, setDisplayedRows] = useState(5);
    const displayedDetails = card.details.slice(0, displayedRows);
    const hasMore = card.details.length > displayedRows;

    const [editingRow, setEditingRow] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const categories = Object.keys(CATEGORIAS_16);

    const handleLoadMore = () => {
        setDisplayedRows(card.details.length);
    };

    const handleEdit = (detail: MotivoDetail) => {
        setEditingRow(detail.empleado);
        setSelectedCategory(card.category);
    };

    const handleCancel = () => {
        setEditingRow(null);
    };

    const handleSave = (detail: MotivoDetail) => {
        if (selectedCategory && selectedCategory !== card.category) {
            onStageCorrection(detail, card.category, selectedCategory);
        }
        setEditingRow(null);
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col">
            <h4 className="font-bold text-base text-gray-800 mb-2">{card.category}</h4>
            <span className="inline-block bg-gray-900 text-white px-2 py-0.5 rounded-full text-xs font-semibold mb-3 self-start">
                Bajas: {card.count}
            </span>
            <div className="overflow-x-auto -mx-4 flex-grow">
                <table className="min-w-full text-xs">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-2 py-1.5 text-left font-medium text-gray-500">No. Empleado</th>
                            <th className="px-2 py-1.5 text-left font-medium text-gray-500">Nombre</th>
                            <th className="px-2 py-1.5 text-left font-medium text-gray-500">Fecha Baja</th>
                            <th className="px-2 py-1.5 text-left font-medium text-gray-500">Comentario</th>
                            <th className="px-2 py-1.5 text-left font-medium text-gray-500">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {displayedDetails.map((detail, index) => {
                           const pendingMove = stagedMoves.find(move => move.detail.empleado === detail.empleado);

                           return editingRow === detail.empleado ? (
                             <tr key={`${index}-editing`}>
                               <td colSpan={4} className="px-2 py-1.5 align-top">
                                  <select 
                                     value={selectedCategory}
                                     onChange={(e) => setSelectedCategory(e.target.value)}
                                     className="w-full p-1 border border-gray-300 rounded-md text-xs"
                                  >
                                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                  </select>
                               </td>
                               <td className="px-2 py-1.5 align-top whitespace-nowrap">
                                  <button onClick={() => handleSave(detail)} className="text-green-600 hover:text-green-800 font-semibold mr-2">Guardar</button>
                                  <button onClick={handleCancel} className="text-red-600 hover:red-800 font-semibold">Cancelar</button>
                               </td>
                             </tr>
                           ) : (
                            <tr key={index}>
                                <td className="px-2 py-1.5 align-top text-gray-800">{detail.empleado}</td>
                                <td className="px-2 py-1.5 align-top text-gray-800">{detail.nombre || '-'}</td>
                                <td className="px-2 py-1.5 align-top whitespace-nowrap text-gray-800">{detail.fecha_baja}</td>
                                <td className="px-2 py-1.5 align-top max-w-xs truncate text-gray-800" title={detail.comentario}>{detail.comentario}</td>
                                <td className="px-2 py-1.5 align-top text-gray-800">
                                   {pendingMove ? (
                                     <span className="text-xs font-semibold text-orange-600 italic">Pendiente: {pendingMove.newCategory}</span>
                                   ) : (
                                     <button onClick={() => handleEdit(detail)} className="text-indigo-600 hover:text-indigo-800 font-semibold">Reclasificar</button>
                                   )}
                                </td>
                            </tr>
                           )
                        })}
                    </tbody>
                </table>
            </div>
            {card.details.length > 0 && (
                <div className="flex justify-between items-center mt-2">
                    <p className="text-gray-500 text-xs">
                        Mostrando {displayedDetails.length} de {card.count} registros.
                    </p>
                    {hasMore && (
                        <button onClick={handleLoadMore} className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold">
                            Cargar más
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData>(data);
  const { clientName, period, kpis, pareto, km_global, survival_metrics, km_cond, surv_by_turno, surv_by_puesto, cohorts, motivos, trend, historicalYoY, aiSummary } = dashboardData;
  
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [stagedMoves, setStagedMoves] = useState<StagedMove[]>([]);
  const [trendView, setTrendView] = useState<'currentYear' | 'allTime'>('currentYear');
  const [yoyView, setYoyView] = useState<'currentYear' | 'allTime'>('currentYear');

  const InfoTooltip: React.FC<{ text: string }> = ({ text }) => (
    <div className="relative flex items-center group">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 hover:text-indigo-600 cursor-pointer" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
        {text}
      </div>
    </div>
  );

  const stageCorrection = (detail: MotivoDetail, oldCategory: string, newCategory: string) => {
    setStagedMoves(prevMoves => [
      // Remove any existing move for this employee to allow changing the decision
      ...prevMoves.filter(move => move.detail.empleado !== detail.empleado),
      { detail, oldCategory, newCategory }
    ]);
  };

  const handleApplyCorrections = () => {
    // 1. Update localStorage with staged corrections
    const storedCorrections = localStorage.getItem('gemini_corrections');
    const corrections: CorrectionsMap = storedCorrections ? JSON.parse(storedCorrections) : {};
    const newCorrections = stagedMoves.reduce((acc, move) => {
        acc[move.detail.comentario] = move.newCategory;
        return acc;
    }, corrections);
    localStorage.setItem('gemini_corrections', JSON.stringify(newCorrections));

    // 2. Apply the moves to the UI state
    setDashboardData(prevData => {
      const newMotivos = JSON.parse(JSON.stringify(prevData.motivos)); // Deep copy
      
      stagedMoves.forEach(move => {
        const { detail, oldCategory, newCategory } = move;
        const sourceCard = newMotivos.cards.find((c: MotivoCategoryData) => c.category === oldCategory);
        let destCard = newMotivos.cards.find((c: MotivoCategoryData) => c.category === newCategory);

        if (sourceCard) {
            const detailIndex = sourceCard.details.findIndex((d: MotivoDetail) => d.empleado === detail.empleado);
            if (detailIndex > -1) {
                const [movedDetail] = sourceCard.details.splice(detailIndex, 1);
                sourceCard.count -= 1;

                if (!destCard) {
                    destCard = { category: newCategory, count: 0, details: [] };
                    newMotivos.cards.push(destCard);
                }
                
                destCard.details.push(movedDetail);
                destCard.count += 1;
            }
        }
      });
        
      newMotivos.cards = newMotivos.cards
          .filter((c: MotivoCategoryData) => c.count > 0)
          .sort((a: MotivoCategoryData, b: MotivoCategoryData) => b.count - a.count);
      
      return { ...prevData, motivos: newMotivos };
    });
      
    // 3. Clear the staged moves
    setStagedMoves([]);
  };
  
  const handleDiscardCorrections = () => {
    setStagedMoves([]);
  };


  const formatDate = (date: Date) => date.toLocaleDateString('es-ES', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
  const formatMonthYear = (date: Date) => date.toLocaleDateString('es-ES', { timeZone: 'UTC', month: 'long', year: 'numeric' });

  // Figure definitions
  const paretoFig = (records: ParetoRecord[], category: string, title: string): { data: Partial<PlotData>[], layout: Partial<Layout> } => {
    if (!records || records.length === 0) return { data: [], layout: { title: { text: `${title} (sin datos)` } } };
    const x = records.map(r => r.value);
    const yBajas = records.map(r => r.bajas);
    const yCum = records.map(r => r.cumulative);
    const yPct = records.map(r => r.percentage);

    return {
      data: [
        { 
            x, 
            y: yBajas, 
            customdata: yPct,
            type: 'bar', 
            name: 'Bajas', 
            marker: { color: '#4f46e5' },
            hovertemplate: `<b>%{x}</b><br>Bajas: %{y}<br>% del Total: %{customdata:.1f}%<extra></extra>`
        },
        { 
            x, 
            y: yCum, 
            type: 'scatter', 
            mode: 'lines+markers', 
            name: '% Acumulado', 
            yaxis: 'y2', 
            marker: { color: '#db2777' },
            hovertemplate: `<b>%{x}</b><br>% Acumulado: %{y:.1f}%<extra></extra>`
        }
      ],
      layout: {
        title: { text: title },
        xaxis: { title: { text: category } },
        yaxis: { title: { text: 'Bajas' } },
        yaxis2: { title: { text: '% Acumulado' }, overlaying: 'y', side: 'right', range: [0, 100] },
        legend: { y: 1.2, orientation: 'h' }
      }
    };
  };

  const kmFig: { data: Partial<PlotData>[], layout: Partial<Layout> } = {
    data: [{
      x: km_global.map(p => p.t_dias),
      y: km_global.map(p => p.S),
      mode: 'lines',
      line: { shape: 'hv', color: '#4f46e5' },
      hovertemplate: `<b>Día: %{x}</b><br>Prob. Supervivencia: %{y:.3f}<extra></extra>`
    }],
    layout: {
      xaxis: { title: { text: 'Días desde ingreso' } },
      yaxis: { title: { text: 'S(t) - Prob. de Supervivencia' }, range: [0, 1.05] }
    }
  };
  
    const hazardFig: { data: Partial<PlotData>[], layout: Partial<Layout> } = {
      data: [{
          x: ["0-30 días", "31-60 días", "61-90 días"],
          y: [survival_metrics.haz_0_30, survival_metrics.haz_31_60, survival_metrics.haz_61_90].map(v => v ? (v*100) : 0),
          type: 'bar',
          marker: { color: ['#f43f5e', '#f97316', '#eab308'] },
          customdata: [
              'Un empleado nuevo tiene un',
              'Un empleado que superó los 30 días tiene un',
              'Un empleado que superó los 60 días tiene un'
          ],
          hovertemplate: '<b>Periodo: %{x}</b><br><br>' +
                         '%{customdata} <b>%{y:.2f}% de probabilidad</b><br>' +
                         'de causar baja en este intervalo.' +
                         '<extra></extra>'
      }],
      layout: {
          yaxis: { title: { text: 'Probabilidad Condicional (%)' }, ticksuffix: '%' },
          margin: { t: 20, b: 50, l: 60, r: 40 }
      }
  };

  const kmCondFig: { data: Partial<PlotData>[], layout: Partial<Layout> } = {
     data: [{
      x: km_cond.map(p => p.fecha),
      y: km_cond.map(p => p.S),
      mode: 'lines',
      line: { shape: 'hv', color: '#4f46e5' },
      hovertemplate: `<b>Fecha: %{x|%d-%b-%Y}</b><br>Prob. Supervivencia Cond.: %{y:.4f}<extra></extra>`
    }],
    layout: {
      xaxis: { title: { text: 'Fecha' } },
      yaxis: { title: { text: 'S(t) condicional' }, range: [Math.min(...km_cond.map(p => p.S), 1) * 0.99, 1.01] }
    }
  }

  const barFig = (chartData: any[], xCol: string, yCol: string, title_unused: string, hoverInfo?: { label: string, extraDataCol?: string, extraDataLabel?: string }): { data: Partial<PlotData>[], layout: Partial<Layout> } => {
      if(!chartData || chartData.length === 0) return { data: [], layout: { } };
      
      const hovertemplate = hoverInfo
        ? `<b>%{x}</b><br>${hoverInfo.label}: %{y:.2%}` + (hoverInfo.extraDataCol ? `<br>${hoverInfo.extraDataLabel}: %{customdata}` : '') + '<extra></extra>'
        : `<b>%{x}</b><br>${yCol}: %{y}<extra></extra>`;

      return {
          data: [{
              x: chartData.map(d => d[xCol]),
              y: chartData.map(d => d[yCol]),
              customdata: hoverInfo?.extraDataCol ? chartData.map(d => d[hoverInfo.extraDataCol]) : undefined,
              type: 'bar',
              marker: { color: '#10b981' },
              hovertemplate: hovertemplate,
          }],
          layout: { 
              xaxis: { title: { text: xCol }, type: 'category' }, 
              yaxis: { title: { text: yCol }, tickformat: yCol.startsWith('S(') ? '.0%' : undefined } 
          }
      }
  };
  
  const linearRegression = (x: number[], y: number[]): { m: number; b: number; r2: number } => {
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
  };

  const trendFigure = useMemo((): { data: Partial<PlotData>[]; layout: Partial<Layout> } => {
    if (!trend.hasData) return { data: [], layout: { title: { text: 'Tendencia Bajas Clase 1 (Datos insuficientes)' } } };
    
    const currentYearStr = String(period.end.getUTCFullYear());
    const historicalData = trendView === 'currentYear'
        ? trend.historical.filter(p => p.ym_str.startsWith(currentYearStr))
        : trend.historical;

    const viewTitle = trendView === 'currentYear' ? `Año ${currentYearStr}` : 'Histórico Completo';

    if (historicalData.length < 3) {
      return { data: [], layout: { title: { text: `Tendencia Bajas (${viewTitle}) – Datos insuficientes` } } };
    }
    
    const x = Array.from({ length: historicalData.length }, (_, i) => i);
    const y = historicalData.map(p => p.bajas);
    const { m, b } = linearRegression(x, y);
    const stats = { slope: m };
    
    const plotData: Partial<PlotData>[] = [
        { x: historicalData.map(p => p.ym_str), y: historicalData.map(p => p.bajas), mode: 'lines+markers', name: 'Bajas Históricas' },
    ];

    if (historicalData.length >= 2) {
        const fit = { x: historicalData.map(p => p.ym_str), y: x.map(val => m * val + b) };
        plotData.push({ x: fit.x, y: fit.y, mode: 'lines', name: 'Tendencia', line: { dash: 'dot', color: 'red' } });
    
        const forecasts: { x: string, y: number }[] = [];
        let [lastYear, lastMonth] = historicalData[historicalData.length - 1].ym_str.split('-').map(Number);
        for (let i = 1; i <= 2; i++) {
            lastMonth++;
            if (lastMonth > 12) { lastMonth = 1; lastYear++; }
            const nextYm = `${lastYear}-${String(lastMonth).padStart(2, '0')}`;
            forecasts.push({ x: nextYm, y: m * (historicalData.length + i - 1) + b });
        }
        if (forecasts.length > 0) {
            plotData.push({
                x: forecasts.map(p => p.x),
                y: forecasts.map(p => p.y),
                mode: 'markers',
                name: 'Pronóstico',
                marker: { symbol: 'diamond', size: 12, color: 'orange' }
            });
        }
    }
    
    return {
        data: plotData,
        layout: {
            title: { text: `Proyección de Bajas` },
            xaxis: { title: {text: 'Período (Año-Mes)'} },
            yaxis: { title: {text: 'Número de Bajas Clase 1'} },
            hovermode: 'x unified',
            legend: { orientation: 'h', yanchor: 'bottom', y: 1.02, xanchor: 'right', x: 1 }
        }
    };
  }, [trend.hasData, trend.historical, period.end, trendView]);

  const historicalYoYFig = useMemo((): { data: Partial<PlotData>[], layout: Partial<Layout> } => {
    const currentYearStr = String(period.end.getUTCFullYear());
    const dataForView = yoyView === 'currentYear'
        ? historicalYoY.filter(p => p.ym_str.startsWith(currentYearStr))
        : historicalYoY;
    
    const validData = dataForView.filter(p => p.variationPct !== null);

    if (validData.length === 0) {
        const viewTitle = yoyView === 'currentYear' ? `del Año ${currentYearStr}` : 'del Histórico';
        return { data: [], layout: { title: { text: `Comparativa Anual de Bajas (sin datos suficientes ${viewTitle})` } } };
    }

    const colors = validData.map(p => (p.variationPct || 0) > 0 ? '#ef4444' : '#22c55e');
    const customdata = validData.map(p => [p.previousYearMonthBajas, p.currentMonthBajas]);

    const monthNames = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const formatXLabel = (ym_str: string) => {
        const [year, month] = ym_str.split('-').map(Number);
        return `${monthNames[month]} ${year}`;
    };

    return {
        data: [{
            x: validData.map(p => formatXLabel(p.ym_str)),
            y: validData.map(p => p.variationPct),
            customdata: customdata,
            type: 'bar',
            marker: { color: colors },
            hovertemplate: '<b>%{x}</b><br><br>' +
                           'Bajas Año Anterior: %{customdata[0]}<br>' +
                           'Bajas Mes Actual: %{customdata[1]}<br>' +
                           '<b>Cambio: %{y:.1f}%</b>' +
                           '<extra></extra>' // Hides the trace name on hover
        }],
        layout: {
            title: { text: 'Comparativa Anual de Bajas (% vs Mismo Mes Año Anterior)' },
            xaxis: { title: { text: 'Periodo (Año-Mes)' } },
            yaxis: { title: { text: 'Cambio %' }, zeroline: true, zerolinewidth: 2, zerolinecolor: '#9ca3af', ticksuffix: '%' },
            showlegend: false
        }
    };
  }, [historicalYoY, period.end, yoyView]);

  const motivosBarFig = (): { data: Partial<PlotData>[], layout: Partial<Layout> } => {
    if (!motivos.hasData) return { data: [], layout: { title: { text: 'Motivos (texto) – Frecuencia (sin datos)'} } };
    return {
      data: [{
        x: motivos.barras.map(m => m.category),
        y: motivos.barras.map(m => m.bajas),
        type: 'bar'
      }],
      layout: { title: { text: 'Motivos (texto) – Frecuencia (16 categorías)' } }
    }
  };
    
  const survivalMetricsWithTooltips = [
    {
      name: 'S(30)',
      value: `${(survival_metrics.S30 * 100).toFixed(2)}%`,
      tooltip: 'Indica la probabilidad de que un nuevo empleado permanezca en la empresa por más de 30 días. Un valor del 95% significa que 95 de cada 100 empleados superan el primer mes.'
    },
    {
      name: 'S(60)',
      value: `${(survival_metrics.S60 * 100).toFixed(2)}%`,
      tooltip: 'Indica la probabilidad de que un nuevo empleado permanezca en la empresa por más de 60 días. Es una métrica clave para evaluar la adaptación inicial.'
    },
    {
      name: 'S(90)',
      value: `${(survival_metrics.S90 * 100).toFixed(2)}%`,
      tooltip: 'Indica la probabilidad de que un nuevo empleado permanezca en la empresa por más de 90 días. A menudo se considera el final del período de prueba y es un indicador crítico de retención temprana.'
    },
    {
      name: 'S(180)',
      value: `${(survival_metrics.S180 * 100).toFixed(2)}%`,
      tooltip: 'Indica la probabilidad de que un nuevo empleado permanezca en la empresa por más de 180 días (6 meses). Muestra la retención a mediano plazo.'
    },
    {
      name: 'S(365)',
      value: `${(survival_metrics.S365 * 100).toFixed(2)}%`,
      tooltip: 'Indica la probabilidad de que un nuevo empleado permanezca en la empresa por más de 365 días (1 año). Es el indicador principal de retención anual.'
    },
    {
      name: 'Mediana de Supervivencia',
      value: survival_metrics.mediana ? `${survival_metrics.mediana} días` : 'No alcanzada',
      tooltip: "Es el punto en el tiempo (en días) en el cual el 50% de los empleados ha causado baja. Si dice 'No alcanzada', significa que más de la mitad de los empleados permanecen en la empresa más allá del período observado."
    },
    {
      name: 'Riesgo Condicional del Mes',
      value: `${(survival_metrics.hazard_cond_mes * 100).toFixed(2)}%`,
      tooltip: "Mide la probabilidad de que un empleado que estaba activo al inicio del mes de análisis cause baja durante ese mes. Es un indicador de la 'presión' de rotación del mes actual."
    }
  ];

  const handleExportHTML = () => {
    const input = dashboardRef.current;
    if (!input) return;

    setIsExporting(true);

    try {
        // Clone the dashboard element to manipulate it without affecting the live view
        const clonedDashboard = input.cloneNode(true) as HTMLElement;

        // Find all plot containers and remove the min-height class for better static rendering
        clonedDashboard.querySelectorAll('.min-h-\\[450px\\]').forEach(el => {
            el.classList.remove('min-h-[450px]');
        });

        const dashboardContent = clonedDashboard.innerHTML;
        const title = `Dashboard Rotación - ${clientName} - ${formatMonthYear(period.start)}`;
        
        const fullHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { padding: 2rem; background-color: #f3f4f6; } /* bg-gray-100 */
        .container { max-width: 1280px; margin-left: auto; margin-right: auto; }
    </style>
</head>
<body class="bg-gray-100">
    <div class="container mx-auto">
        <div class="mb-8">
            <h2 class="text-3xl font-bold text-gray-800">Cliente: ${clientName}</h2>
            <p class="text-lg text-gray-500">Periodo de Análisis: ${formatDate(period.start)} a ${formatDate(period.end)}</p>
            <p class="text-sm text-gray-400 mt-2">Exportado el: ${formatDate(new Date())}</p>
        </div>
        <div class="space-y-8 bg-gray-100 p-px">
            ${dashboardContent}
        </div>
    </div>
</body>
</html>`;

        const blob = new Blob([fullHtml], { type: 'text/html' });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = `Dashboard_Rotacion_${clientName}_${formatMonthYear(period.start).replace(/ /g,'_')}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
    } catch (err) {
        console.error("Error generating HTML:", err);
        alert("Hubo un error al generar el archivo HTML.");
    } finally {
        setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    if (!window.XLSX) {
        alert("Excel library not found.");
        return;
    }
    try {
      const wb = window.XLSX.utils.book_new();
      
      const kpiData = [
          { Métrica: "Headcount ACTIVO Clase 1 (total)", Valor: kpis.HC_activos_c1 },
          { Métrica: "Bajas del mes (Clase 1: RV/BXF)", Valor: kpis.bajas_mes },
          { Métrica: "Rotación % del mes (Regla cliente)", Valor: kpis.rotacion_pct_cliente ? `${kpis.rotacion_pct_cliente.toFixed(2)}%` : 'N/A' },
          { Métrica: "Headcount inicio (3IRH-37)", Valor: kpis.HC_ini },
          { Métrica: "Headcount fin (3IRH-37)", Valor: kpis.HC_fin },
          { Métrica: "Headcount promedio (3IRH-37)", Valor: kpis.HC_prom.toFixed(2) },
          { Métrica: "Rotación % del mes (3IRH-37 referencia)", Valor: kpis.rotacion_pct_3irh37 ? `${kpis.rotacion_pct_3irh37.toFixed(2)}%` : 'N/A' },
      ];
      window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(kpiData), "KPIs del Mes");

      const createParetoSheet = (data: ParetoRecord[], name: string) => {
        if (!data || data.length === 0) return window.XLSX.utils.aoa_to_sheet([[`No hay datos para ${name}`]]);
        const mapped = data.map(r => ({ [name]: r.value, Bajas: r.bajas, '% Total': r.percentage, '% Acumulado': r.cumulative, Clasificación: r.classification }));
        return window.XLSX.utils.json_to_sheet(mapped);
      };
      window.XLSX.utils.book_append_sheet(wb, createParetoSheet(pareto.turno, 'Turno'), 'Pareto Turno');
      window.XLSX.utils.book_append_sheet(wb, createParetoSheet(pareto.puesto, 'Puesto'), 'Pareto Puesto');
      window.XLSX.utils.book_append_sheet(wb, createParetoSheet(pareto.area, 'Área'), 'Pareto Área');
      window.XLSX.utils.book_append_sheet(wb, createParetoSheet(pareto.supervisor, 'Supervisor'), 'Pareto Supervisor');
      window.XLSX.utils.book_append_sheet(wb, createParetoSheet(pareto.motivo_baja, 'Motivo de Baja'), 'Pareto Motivo');
      
      const survMetricsSheetData = survivalMetricsWithTooltips.map(({name, value}) => ({ Métrica: name, Valor: value }));
      survMetricsSheetData.push({Métrica: "Hazard 0-30", Valor: survival_metrics.haz_0_30 === null ? 'N/A' : survival_metrics.haz_0_30.toFixed(4) });
      survMetricsSheetData.push({Métrica: "Hazard 31-60", Valor: survival_metrics.haz_31_60 === null ? 'N/A' : survival_metrics.haz_31_60.toFixed(4) });
      survMetricsSheetData.push({Métrica: "Hazard 61-90", Valor: survival_metrics.haz_61_90 === null ? 'N/A' : survival_metrics.haz_61_90.toFixed(4) });
      window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(survMetricsSheetData), "Métricas Supervivencia");
      
      if(trend.hasData) {
        window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(trend.historical), "Tendencia Bajas Históricas");
      }
      if(motivos.hasData) {
        const motivoDetails = motivos.cards.flatMap(c => c.details.map(d => ({ Categoria: c.category, ...d })));
        window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(motivoDetails), "Detalle Motivos Texto");
      }

      window.XLSX.writeFile(wb, `Datos_Rotacion_${clientName}_${formatMonthYear(period.start).replace(/ /g,'_')}.xlsx`);
    } catch (err) {
      console.error("Error generating Excel file:", err);
      alert("Hubo un error al generar el archivo Excel.");
    }
  };

  const parsedSummary = useMemo(() => {
    if (!aiSummary?.summary) {
        return { summaryText: '', insights: [] };
    }
    const summaryString = aiSummary.summary.trim();

    // Split the entire string by bullet points (asterisk or dash).
    // The regex uses a positive lookahead (?=...) to split *before* the bullet,
    // keeping the bullet character in the resulting parts. This is crucial
    // for identifying which parts are list items.
    const parts = summaryString.split(/(?=\n?\s*[\*\-]\s)/).filter(p => p.trim());
    
    if (parts.length === 0) {
        return { summaryText: '', insights: [] };
    }

    if (parts.length === 1) {
        // No bullets found, so it's all a single summary text.
        return { summaryText: parts[0], insights: [] };
    }

    // Check if the first part is an introductory paragraph or just another bullet point.
    // An intro paragraph will not start with a bullet.
    const firstPartIsIntro = !parts[0].trim().startsWith('*') && !parts[0].trim().startsWith('-');
    
    const summaryText = firstPartIsIntro ? parts[0].trim() : '';
    const insightsRaw = firstPartIsIntro ? parts.slice(1) : parts;

    // Clean up the insights: remove the bullet point characters from the beginning of each.
    const insights = insightsRaw
      .map(insight => insight.trim().replace(/^[\*\-]\s*/, '').trim())
      .filter(Boolean); // Filter out any empty strings that might result

    return { summaryText, insights };

  }, [aiSummary?.summary]);

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Cliente: {clientName}</h2>
          <p className="text-lg text-gray-500">Periodo de Análisis: {formatDate(period.start)} a {formatDate(period.end)}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 mt-4 md:mt-0">
          <button onClick={handleExportHTML} disabled={isExporting} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition duration-300 flex items-center justify-center disabled:bg-gray-400 disabled:cursor-wait">
            {isExporting ? 'Exportando...' : 'Exportar a HTML'}
          </button>
          <button onClick={handleExportExcel} disabled={isExporting} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition duration-300 flex items-center justify-center disabled:bg-gray-400">
            Exportar a Excel
          </button>
        </div>
      </div>

      <div ref={dashboardRef} className="space-y-8 bg-gray-100 p-px">
        {/* KPIs Section */}
        <section id="kpis">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-2xl font-semibold text-gray-800">KPIs del Mes (Clase 1)</h3>
            <InfoTooltip text="Aquí se muestran los indicadores clave de rendimiento (KPIs) para el mes de análisis, enfocados en las bajas de 'Clase 1' (renuncias voluntarias y bajas por faltas). Permiten una vista rápida de la salud de la rotación." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard title="Rotación Mensual (Cliente)" value={kpis.rotacion_pct_cliente !== null ? `${kpis.rotacion_pct_cliente.toFixed(2)}%` : 'N/A'} helpText="Bajas / HC Activo Total" />
            <KPICard title="Bajas del Mes (RV/BXF)" value={kpis.bajas_mes} />
            <KPICard title="Headcount Activo Total" value={kpis.HC_activos_c1} />
            <KPICard title="Rotación (3IRH-37 Ref.)" value={kpis.rotacion_pct_3irh37 ? `${kpis.rotacion_pct_3irh37.toFixed(2)}%` : 'N/A'} helpText="Bajas / HC Activo Total" />
          </div>
        </section>

        {/* Trend Forecast Section */}
        <section id="forecast">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-semibold text-gray-800">Proyección de Bajas</h3>
                    <InfoTooltip text="Esta gráfica muestra la tendencia histórica de las bajas mensuales y utiliza un modelo de regresión lineal para proyectar el número de bajas en los próximos dos meses. La línea punteada representa la 'Tendencia', y los diamantes naranjas son el pronóstico." />
                </div>
                {trend.hasData && (
                    <button 
                        onClick={() => setTrendView(v => v === 'currentYear' ? 'allTime' : 'currentYear')}
                        className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-1 px-3 rounded-lg transition-colors"
                    >
                        {trendView === 'currentYear' ? 'Ver Histórico Completo' : 'Ver Año Actual'}
                    </button>
                )}
            </div>
            <div className="bg-white p-4 rounded-xl shadow-md min-h-[450px]">
                <Plot figure={trendFigure} id="plot-trend" />
            </div>
        </section>

        {/* Historical Year-over-Year Comparison Section */}
        <section id="historical-yoy">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-semibold text-gray-800">Comparativa Anual de Bajas</h3>
                    <InfoTooltip text="Compara las bajas de cada mes con las del mismo mes del año anterior. La barra roja indica un aumento en la rotación, mientras que la verde indica una disminución. Pasa el cursor sobre una barra para ver los detalles." />
                </div>
                 {historicalYoY.filter(p => p.variationPct !== null).length > 0 && (
                    <button 
                        onClick={() => setYoyView(v => v === 'currentYear' ? 'allTime' : 'currentYear')}
                        className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-1 px-3 rounded-lg transition-colors"
                    >
                        {yoyView === 'currentYear' ? 'Ver Histórico Completo' : 'Ver Año Actual'}
                    </button>
                )}
            </div>
            <div className="bg-white p-4 rounded-xl shadow-md min-h-[450px]">
                <Plot figure={historicalYoYFig} id="plot-historical-yoy" />
            </div>
        </section>

        {/* Motivos Section */}
        {motivos.hasData && (
          <section id="motivos">
            <div className="flex justify-between items-start mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-semibold text-gray-800">Análisis de Motivos de Baja (por Texto)</h3>
                <InfoTooltip text="Esta sección analiza los comentarios de baja para agruparlos en 16 categorías comunes. La gráfica de barras muestra las categorías más frecuentes. Las tarjetas de abajo detallan los empleados de cada categoría. Puedes usar el botón 'Reclasificar' para corregir la categoría asignada por la IA y mejorar análisis futuros." />
              </div>
              {stagedMoves.length > 0 && (
                <div className="flex items-center gap-3 mt-2 sm:mt-0">
                  <button
                    onClick={handleApplyCorrections}
                    className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition duration-300"
                  >
                    Re-entrenar Modelo ({stagedMoves.length})
                  </button>
                  <button
                    onClick={handleDiscardCorrections}
                    className="bg-gray-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition duration-300"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
            <div className="bg-blue-50 border-l-4 border-blue-400 text-blue-800 p-4 rounded-md mb-4">
                <p className="text-sm">
                    Análisis de comentarios de la columna: <span className="font-mono bg-blue-100 px-1 rounded">{motivos.textCol || 'No detectada'}</span>.
                </p>
                {motivos.analysisType === 'ml' ? (
                  <p className="text-sm font-semibold mt-1">
                    <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">✓ Análisis potenciado por Gemini</span>
                  </p>
                ) : (
                  <p className="text-xs mt-1">
                    <span className="font-bold text-yellow-600">!</span> No se pudo conectar a la API de IA. Se utilizó el método de <strong>palabras clave</strong> como alternativa.
                  </p>
                )}
            </div>
            <div className="space-y-6">
                <div className="bg-white p-4 rounded-xl shadow-md min-h-[450px]">
                    <Plot figure={motivosBarFig()} id="plot-motivos-bar" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {motivos.cards.map(card => <MotivoCard key={card.category} card={card} onStageCorrection={stageCorrection} stagedMoves={stagedMoves} />)}
                </div>
            </div>
          </section>
        )}

        {/* Pareto Section */}
        <section id="pareto">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-2xl font-semibold text-gray-800">Análisis Pareto 80/20 de Bajas</h3>
            <InfoTooltip text="El principio de Pareto sugiere que el 80% de los efectos provienen del 20% de las causas. Estas gráficas identifican los 'pocos vitales' (el 'Core 80') que causan la mayoría de las bajas en diferentes dimensiones (turno, puesto, etc.). La línea rosa muestra el porcentaje acumulado; donde cruza el 80% es el punto de corte." />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-xl shadow-md min-h-[450px]"><Plot figure={paretoFig(pareto.turno, 'Turno', 'Pareto por Turno')} id="plot-pareto-turno"/></div>
            <div className="bg-white p-4 rounded-xl shadow-md min-h-[450px]"><Plot figure={paretoFig(pareto.puesto, 'Puesto', 'Pareto por Puesto')} id="plot-pareto-puesto" /></div>
            <div className="bg-white p-4 rounded-xl shadow-md min-h-[450px]"><Plot figure={paretoFig(pareto.area, 'Área', 'Pareto por Área')} id="plot-pareto-area" /></div>
            <div className="bg-white p-4 rounded-xl shadow-md min-h-[450px]"><Plot figure={paretoFig(pareto.supervisor, 'Supervisor', 'Pareto por Supervisor')} id="plot-pareto-supervisor" /></div>
            <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-md min-h-[450px]">
              <Plot figure={paretoFig(pareto.motivo_baja, 'Motivo', 'Pareto por Motivo de Baja')} id="plot-pareto-motivo" />
            </div>
          </div>
        </section>
        
        {/* Survival Analysis Section */}
        <section id="survival">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-2xl font-semibold text-gray-800">Análisis de Supervivencia</h3>
            <InfoTooltip text="Este análisis mide la probabilidad de que un empleado permanezca en la empresa a lo largo del tiempo (Curva Kaplan-Meier). Valores más altos indican mayor retención. También se desglosa la supervivencia a 90 días por diferentes grupos (turno, puesto, cohorte) para identificar áreas de riesgo." />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-md min-h-[450px] flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Curva de Supervivencia Global (Kaplan-Meier)</h3>
                    <InfoTooltip text="La Curva de Kaplan-Meier muestra la probabilidad de que un empleado permanezca en la empresa a lo largo del tiempo. Una curva que desciende lentamente indica una buena retención. Pasa el cursor sobre la línea para ver la probabilidad de supervivencia en un día específico." />
                </div>
                <div className="flex-grow w-full h-full">
                  <Plot figure={kmFig} id="plot-km-global" />
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Métricas Clave de Supervivencia</h3>
                <ul className="space-y-4">
                  {survivalMetricsWithTooltips.map(metric => (
                    <li key={metric.name} className="flex justify-between items-center border-b border-gray-100 pb-2 last:border-b-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">{metric.name}</span>
                        <InfoTooltip text={metric.tooltip} />
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{metric.value}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-md flex flex-col min-h-[450px]">
                  <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">Riesgo de Baja Temprana</h3>
                      <InfoTooltip text="Esta gráfica muestra la probabilidad de que un empleado que ha superado un período de tiempo (ej. 30 días) cause baja en el siguiente período (ej. entre el día 31 y 60). Ayuda a identificar en qué momento el riesgo de renuncia es más alto." />
                  </div>
                  <div className="flex-grow w-full h-full">
                    <Plot figure={hazardFig} id="plot-hazard" />
                  </div>
              </div>

              <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-md min-h-[450px] flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">KM Condicional del Mes ({formatMonthYear(period.start)})</h3>
                  <InfoTooltip text="Esta curva analiza la 'supervivencia' de los empleados que estaban activos al inicio del mes. Muestra la probabilidad de que este grupo específico de empleados permanezca en la empresa durante el mes. Una caída pronunciada indica un mes con alta rotación para la plantilla existente." />
                </div>
                <div className="flex-grow w-full h-full">
                  <Plot figure={kmCondFig} id="plot-km-cond" />
                </div>
              </div>
              <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-md min-h-[450px] flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">S(90) por Turno</h3>
                      <InfoTooltip text="S(90) es la probabilidad de que un empleado permanezca en la empresa por más de 90 días. Esta gráfica compara el S(90) entre diferentes turnos. Barras más bajas indican turnos con mayor riesgo de rotación temprana. Pasa el cursor sobre una barra para ver el valor exacto y el número de empleados en el grupo." />
                  </div>
                  <div className="flex-grow w-full h-full">
                    <Plot figure={barFig(surv_by_turno, 'group', 'S(90)', 'S(90) por Turno', {label: 'S(90)', extraDataCol: 'n', extraDataLabel: 'Empleados'})} id="plot-s90-turno" />
                  </div>
              </div>
              <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-md min-h-[450px] flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">S(90) por Puesto (n≥20)</h3>
                      <InfoTooltip text="S(90) es la probabilidad de que un empleado permanezca en la empresa por más de 90 días. Esta gráfica compara el S(90) entre diferentes puestos. Barras más bajas indican puestos con mayor riesgo de rotación temprana. Pasa el cursor sobre una barra para ver el valor exacto y el número de empleados en el grupo." />
                  </div>
                  <div className="flex-grow w-full h-full">
                    <Plot figure={barFig(surv_by_puesto.filter(p=>p.n>=20), 'group', 'S(90)', 'S(90) por Puesto (n≥20)', {label: 'S(90)', extraDataCol: 'n', extraDataLabel: 'Empleados'})} id="plot-s90-puesto" />
                  </div>
              </div>
              <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-md min-h-[450px] flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">S(90) por Cohorte de Ingreso (Últimos 12)</h3>
                      <InfoTooltip text="S(90) es la probabilidad de que un empleado permanezca en la empresa por más de 90 días. Esta gráfica compara el S(90) entre diferentes cohortes de ingreso (mes de contratación). Permite ver si la retención temprana ha mejorado o empeorado con el tiempo. Pasa el cursor sobre una barra para ver el valor exacto y el tamaño de la cohorte." />
                  </div>
                  <div className="flex-grow w-full h-full">
                    <Plot figure={barFig(cohorts.slice(-12), 'Cohorte', 'S(90)', 'S(90) por Cohorte de Ingreso (Últimos 12)', {label: 'S(90)', extraDataCol: 'Tamaño', extraDataLabel: 'Tamaño Cohorte'})} id="plot-cohorts" />
                  </div>
              </div>
          </div>
        </section>

        {/* AI Summary Section */}
        {aiSummary && (aiSummary.summary || (aiSummary.actions && aiSummary.actions.length > 0)) && (
          <section id="ai-summary">
            <h3 className="text-2xl font-semibold text-gray-800 mb-4">Resumen y Plan de Acción</h3>
            <div className="bg-white p-8 rounded-xl shadow-md">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left side: Summary */}
                {aiSummary.summary && (
                  <div>
                    <h4 className="text-xl font-bold text-gray-800 mb-3">Diagnóstico</h4>
                    <p className="text-gray-600 leading-relaxed">{parsedSummary.summaryText}</p>
                    
                    {parsedSummary.insights.length > 0 && (
                      <ul className="mt-6 space-y-2">
                        {parsedSummary.insights.map((insight, index) => (
                          <li key={index} className="flex items-start">
                            <svg className="flex-shrink-0 h-5 w-5 text-indigo-600 mt-0.5 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-gray-700">{insight}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                
                {/* Right side: Action Plan */}
                {aiSummary.actions && aiSummary.actions.length > 0 && (
                  <div>
                    <h4 className="text-xl font-bold text-gray-800 mb-4">Plan de Acción Sugerido</h4>
                    <div className="space-y-4">
                      {aiSummary.actions.map((action, index) => (
                        <div key={index} className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm mt-1">
                            {index + 1}
                          </div>
                          <div className="flex-1 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <h5 className="font-bold text-indigo-700">{action.accion}</h5>
                            <p className="mt-2 text-sm text-gray-600">
                              <span className="font-semibold text-gray-800">Por qué:</span> {action.porque}
                            </p>
                            <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">
                              <span className="font-semibold text-gray-800">Cómo implementarlo:</span>
                              {`\n${action.como}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Dashboard;