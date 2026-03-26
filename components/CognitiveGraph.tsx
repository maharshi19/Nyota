
import React, { useMemo } from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Cell, ReferenceLine } from 'recharts';
import { RiskFactor, EnvironmentalReading } from '../types';
import { AlertTriangle, Wind, Thermometer } from 'lucide-react';

interface CognitiveGraphProps {
  facts: RiskFactor[];
  environmentalHistory?: EnvironmentalReading[];
}

const CognitiveGraph: React.FC<CognitiveGraphProps> = ({ facts, environmentalHistory }) => {
  // Determine if there are active environmental stressors
  const activeStressors = useMemo(() => {
    if (!environmentalHistory || environmentalHistory.length === 0) return { aqi: false, heat: false };
    const latest = environmentalHistory[environmentalHistory.length - 1];
    return {
      aqi: latest.airQuality > 100,
      heat: latest.heatIndex > 100,
      isHazardous: latest.airQuality > 100 || latest.heatIndex > 100
    };
  }, [environmentalHistory]);

  // Map factors to a jittered 2D space to visualize the "Load" in different quadrants
  const data = useMemo(() => {
    return facts.map((f, index) => {
      let baseX = 0;
      switch(f.category) {
        case 'history': baseX = 15; break;
        case 'clinical': baseX = 38; break;
        case 'environmental': baseX = 62; break;
        case 'sdoh': baseX = 85; break;
      }

      let baseY = 0;
      switch(f.significance) {
        case 'low': baseY = 15; break;
        case 'medium': baseY = 50; break;
        case 'high': baseY = 85; break;
      }

      // Dynamic Linking: If environmental stressors are high, 
      // boost the significance of related factors visually.
      let aggravated = false;
      let finalY = baseY;
      let finalSize = f.significance === 'high' ? 200 : f.significance === 'medium' ? 120 : 80;

      if (f.category === 'environmental' && activeStressors.isHazardous) {
        aggravated = true;
        // Shift upwards on the risk axis (Y) - dynamic significance increase
        finalY = Math.min(92, finalY + 15); 
        // Increase visual mass (Z)
        finalSize += 100;
      }

      // Add jitter to prevent overlap and create a "clump" effect
      const jitterX = (Math.random() - 0.5) * 8;
      const jitterY = (Math.random() - 0.5) * 8;

      return {
        ...f,
        x: baseX + jitterX,
        y: finalY + jitterY,
        z: finalSize,
        aggravated,
        id: index
      };
    });
  }, [facts, activeStressors]);

  const COLORS = {
    history: '#64748b',      // Slate
    clinical: '#0d9488',     // Teal
    environmental: '#10b981', // Emerald
    sdoh: '#d97706'          // Amber
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-teal-50 text-slate-800 text-[10px] p-2 rounded-lg shadow-xl border border-white/10 max-w-[160px]">
          <div className="flex justify-between items-center mb-1">
             <span className="font-bold uppercase tracking-wider text-white/50">{item.category}</span>
             <div className="flex items-center gap-1">
               {item.aggravated && <AlertTriangle className="w-2 h-2 text-rose-400" />}
               <span className={`px-1 rounded font-bold ${
                 item.significance === 'high' || item.aggravated ? 'text-rose-400 bg-rose-400/10' : 
                 item.significance === 'medium' ? 'text-amber-400 bg-amber-400/10' : 'text-slate-400 bg-slate-400/10'
               }`}>{item.aggravated ? 'Aggravated' : item.significance}</span>
             </div>
          </div>
          <p className="font-medium">{item.factor}</p>
          {item.aggravated && (
            <p className="text-[8px] text-rose-300 mt-1 italic border-t border-white/10 pt-1">
              Significance elevated by real-time environmental stress.
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full w-full bg-white rounded-xl border border-slate-100 relative overflow-hidden flex flex-col">
      <div className="p-3 border-b border-slate-50 flex justify-between items-center shrink-0">
        <div className="flex flex-col">
          <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Cognitive Load Distribution</h4>
          {activeStressors.isHazardous && (
            <div className="flex items-center gap-1.5 mt-0.5">
               <span className="relative flex h-1.5 w-1.5">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
               </span>
               <span className="text-[8px] font-bold text-rose-400 uppercase tracking-tighter">Stressors Aggravating Clinical Risk</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
           {Object.entries(COLORS).map(([cat, color]) => (
             <div key={cat} className="flex items-center gap-1">
               <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }}></div>
               <span className="text-[8px] text-slate-400 uppercase font-bold">{cat}</span>
             </div>
           ))}
        </div>
      </div>
      
      <div className="flex-1 relative">
        <div className="absolute inset-x-0 bottom-2 px-6 flex justify-between text-[8px] text-slate-300 font-bold uppercase tracking-tighter pointer-events-none">
          <span>History</span>
          <span>Clinical</span>
          <span>Environment</span>
          <span>SDoH</span>
        </div>
        <div className="absolute inset-y-0 left-2 py-6 flex flex-col justify-between text-[8px] text-slate-300 font-bold uppercase tracking-tighter vertical-text pointer-events-none">
          <span>High Risk</span>
          <span>Base Risk</span>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 15, right: 15, bottom: 15, left: 15 }}>
            <XAxis type="number" dataKey="x" domain={[0, 100]} hide />
            <YAxis type="number" dataKey="y" domain={[0, 100]} hide />
            <ZAxis type="number" dataKey="z" range={[50, 400]} />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#cbd5e1' }} />
            
            {/* Grid Dividers */}
            <ReferenceLine x={25} stroke="#f1f5f9" />
            <ReferenceLine x={50} stroke="#f1f5f9" />
            <ReferenceLine x={75} stroke="#f1f5f9" />
            <ReferenceLine y={50} stroke="#f1f5f9" />

            <Scatter name="Risk Factors" data={data}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[entry.category as keyof typeof COLORS]} 
                  stroke={entry.aggravated ? '#f43f5e' : 'none'}
                  strokeWidth={entry.aggravated ? 2 : 0}
                  className={`transition-all duration-300 hover:opacity-80 ${entry.aggravated ? 'animate-pulse' : ''}`}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Environmental Linkage Legend */}
      {activeStressors.isHazardous && (
        <div className="absolute bottom-10 right-3 flex flex-col items-end gap-1 pointer-events-none">
          <div className="bg-rose-50 border border-rose-100 px-2 py-1 rounded shadow-sm flex items-center gap-1.5">
            {activeStressors.aqi && <Wind className="w-2.5 h-2.5 text-rose-400" />}
            {activeStressors.heat && <Thermometer className="w-2.5 h-2.5 text-rose-400" />}
            <span className="text-[7px] font-bold text-rose-700 uppercase">Synergistic Morbidity Risk</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CognitiveGraph;
