import React, { useEffect, useRef } from 'react';
import { Data, Layout } from 'plotly.js';

// Make Plotly and other CDN libraries available on the window object
declare global {
    interface Window {
        Plotly: any;
        XLSX: any;
    }
}

interface PlotProps {
  figure: {
    data: Data[];
    layout: Partial<Layout>;
  };
  id: string;
}

const Plot: React.FC<PlotProps> = ({ figure, id }) => {
  const plotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentRef = plotRef.current;
    if (currentRef && window.Plotly) {
      // Use react method to create/update plot
      window.Plotly.react(currentRef, figure.data, {
        ...figure.layout,
        // Ensure axis labels are not cut off by automatically adjusting margins
        xaxis: { ...figure.layout.xaxis, automargin: true },
        yaxis: { ...figure.layout.yaxis, automargin: true },
        yaxis2: { ...figure.layout.yaxis2, automargin: true },
        margin: { t: 50, b: 50, l: 60, r: 40 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: {
            family: 'sans-serif',
            size: 12,
            color: '#374151' // gray-700
        },
        autosize: true
      }, { responsive: true });
    }
    
    // Cleanup on unmount
    return () => {
        if(currentRef && window.Plotly) {
            window.Plotly.purge(currentRef);
        }
    };
  }, [figure]);
  
  return (
    <div id={id} ref={plotRef} style={{ width: '100%', height: '100%' }} />
  );
};

export default Plot;