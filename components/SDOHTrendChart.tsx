
import React from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend
} from 'recharts';
import { SDOHReading } from '../types';
import { ShoppingBasket, Bus, Home } from 'lucide-react';

interface SDOHTrendChartProps {
  history: SDOHReading[];
}

const SDOHTrendChart: React.FC<SDOHTrendChartProps> = ({ history }) => {
  if (!history || history.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100 text-[10px] text-slate-400 font-bold uppercase">
        Waiting for SDoH stream...
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-white/10 p-3 rounded-lg shadow-xl text-[10px]">
          <div className="text-white/50 font-bold uppercase mb-2">{label}</div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <ShoppingBasket className="w-3 h-3 text-amber-400" />
                <span className="text-white/70">Food Stress</span>
              </div>
              <span className="text-white font-bold">{payload[0].value}%</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Bus className="w-3 h-3 text-teal-400" />
                <span className="text-white/70">Transport Stress</span>
              </div>
              <span className="text-white font-bold">{payload[1].value}%</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Home className="w-3 h-3 text-slate-400" />
                <span className="text-white/70">Housing Stress</span>
              </div>
              <span className="text-white font-bold">{payload[2].value}%</span>
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
          SDoH Stress Index Velocity
        </h4>
        <div className="flex gap-2">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
            <span className="text-[7px] text-slate-400 font-bold uppercase">Food</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div>
            <span className="text-[7px] text-slate-400 font-bold uppercase">Transit</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
            <span className="text-[7px] text-slate-400 font-bold uppercase">Housing</span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="timestamp" 
              axisLine={false} 
              tickLine={false} 
              tick={{fontSize: 8, fill: '#94a3b8'}} 
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{fontSize: 8, fill: '#94a3b8'}} 
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="foodStress" 
              stroke="#d97706" 
              strokeWidth={2} 
              dot={{ r: 2, fill: '#d97706' }}
              activeDot={{ r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="transportStress" 
              stroke="#4f46e5" 
              strokeWidth={2} 
              dot={{ r: 2, fill: '#4f46e5' }}
              activeDot={{ r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="housingStress" 
              stroke="#64748b" 
              strokeWidth={2} 
              dot={{ r: 2, fill: '#64748b' }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SDOHTrendChart;
