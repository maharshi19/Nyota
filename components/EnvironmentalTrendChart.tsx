
import React from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceArea,
  ReferenceLine
} from 'recharts';
import { EnvironmentalReading } from '../types';
import { Wind, Thermometer } from 'lucide-react';

interface EnvironmentalTrendChartProps {
  history: EnvironmentalReading[];
}

const getAQIClassification = (aqi: number) => {
  if (aqi <= 50) return { label: 'Good', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
  if (aqi <= 100) return { label: 'Moderate', color: 'text-amber-500', bg: 'bg-amber-500/10' };
  if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', color: 'text-orange-500', bg: 'bg-orange-500/10' };
  if (aqi <= 200) return { label: 'Unhealthy', color: 'text-rose-400', bg: 'bg-rose-500/10' };
  return { label: 'Very Unhealthy', color: 'text-teal-600', bg: 'bg-teal-500/10' };
};

const EnvironmentalTrendChart: React.FC<EnvironmentalTrendChartProps> = ({ history }) => {
  if (!history || history.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100 text-[10px] text-slate-400 font-bold uppercase">
        Waiting for environmental stream...
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const aqi = payload[0].value;
      const classification = getAQIClassification(aqi);
      return (
        <div className="bg-white border border-white/10 p-3 rounded-lg shadow-xl text-[10px] min-w-[140px]">
          <div className="text-white/50 font-bold uppercase mb-2">{label}</div>
          <div className="space-y-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Wind className="w-3 h-3 text-emerald-400" />
                <span className="text-white font-medium">AQI: {aqi}</span>
              </div>
              <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase inline-block ${classification.bg} ${classification.color}`}>
                {classification.label}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-white/5">
              <Thermometer className="w-3 h-3 text-rose-400" />
              <span className="text-white font-medium">Heat Index: {payload[1].value}°F</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full w-full bg-white rounded-xl border border-slate-100 overflow-hidden flex flex-col">
      <div className="p-3 border-b border-slate-50 flex justify-between items-center shrink-0">
        <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          Environmental Stressor Velocity
        </h4>
        <div className="flex gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-0.5 bg-emerald-500"></div>
            <span className="text-[8px] text-slate-400 font-bold uppercase">Air Quality</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-0.5 bg-rose-500"></div>
            <span className="text-[8px] text-slate-400 font-bold uppercase">Heat Index</span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 p-2 relative">
        <div className="absolute top-2 right-4 flex flex-col items-end gap-1 z-10 pointer-events-none opacity-40">
           <span className="text-[7px] font-bold text-rose-400 uppercase">Unhealthy (150+)</span>
           <span className="text-[7px] font-bold text-orange-600 uppercase">Sensitive (100+)</span>
        </div>
        
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="timestamp" 
              axisLine={false} 
              tickLine={false} 
              tick={{fontSize: 8, fill: '#94a3b8'}} 
            />
            <YAxis 
              yAxisId="left"
              axisLine={false} 
              tickLine={false} 
              tick={{fontSize: 8, fill: '#10b981'}} 
              domain={[0, 200]}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              axisLine={false} 
              tickLine={false} 
              tick={{fontSize: 8, fill: '#f43f5e'}} 
              domain={[60, 120]}
              hide
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* AQI Categories Background Layers */}
            {/* Good 0-50 */}
            <ReferenceArea yAxisId="left" y1={0} y2={50} />
            {/* Moderate 51-100 */}
            <ReferenceArea yAxisId="left" y1={51} y2={100} />
            {/* Sensitive 101-150 */}
            <ReferenceArea yAxisId="left" y1={101} y2={150} />
            {/* Unhealthy 151-200 */}
            <ReferenceArea yAxisId="left" y1={151} y2={200} />
            
            {/* Divider lines for standard categories */}
            <ReferenceLine yAxisId="left" y={50} stroke="#10b981" strokeOpacity={0.1} strokeWidth={1} />
            <ReferenceLine yAxisId="left" y={100} stroke="#f97316" strokeOpacity={0.1} strokeWidth={1} />
            <ReferenceLine yAxisId="left" y={150} stroke="#ef4444" strokeOpacity={0.1} strokeWidth={1} />

            <Area 
              yAxisId="left"
              type="monotone" 
              dataKey="airQuality" 
              fill="#10b981" 
              fillOpacity={0.05} 
              stroke="#065f46" 
              strokeWidth={1.5}
              dot={{ r: 2, fill: '#10b981', strokeWidth: 0 }}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="heatIndex" 
              stroke="#f43f5e" 
              strokeWidth={2} 
              strokeDasharray="4 4"
              dot={{ r: 2, fill: '#f43f5e', strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default EnvironmentalTrendChart;
