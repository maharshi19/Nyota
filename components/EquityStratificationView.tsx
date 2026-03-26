import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../DataContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart, 
  Pie,
  LineChart,
  Line,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { 
  Scale, 
  Target, 
  Map, 
  AlertCircle, 
  TrendingUp, 
  Users, 
  ShieldCheck, 
  Fingerprint, 
  FileJson, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  Eye,
  Activity
} from 'lucide-react';

const EquityStratificationView: React.FC = () => {
  const [activeMetric, setActiveMetric] = useState<'SMM' | 'Prenatal' | 'Postpartum'>('SMM');
  const [liveTimestamp, setLiveTimestamp] = useState(new Date().toLocaleTimeString());
  const { items } = useData();

  // derive hotspots from item zips
  const hotspots = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach(i => {
      const zip = i.caseData.environmental?.zipCode;
      if (zip) counts[zip] = (counts[zip] || 0) + 1;
    });
    return Object.entries(counts).map(([zip, cnt]) => ({ zip, count: cnt }));
  }, [items]);

  // sample stratification by a generic demographic field if present
  const raceStratification = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach(i => {
      const grp: any = (i.caseData as any).race || 'Unknown';
      counts[grp] = (counts[grp] || 0) + 1;
    });
    return Object.entries(counts).map(([group, count]) => ({ group, rate: count, color: '#3a8c81' }));
  }, [items]);

  const gapVelocity = useMemo(() => {
    // placeholder: could compute trend over time if items have timestamps
    return [] as any[];
  }, [items]);

  useEffect(() => {
    const timer = setInterval(() => setLiveTimestamp(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8 space-y-8 custom-scrollbar">
      
      {/* REAL-TIME EQUITY HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full text-[10px] font-black border border-rose-100 uppercase animate-pulse">
              <Activity className="w-3 h-3" />
              Live Disparity Monitor
            </div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last Sync: {liveTimestamp}
            </div>
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            Real-Time Equity Stratification
          </h2>
          <p className="text-sm text-slate-500 max-w-2xl font-medium leading-relaxed">
            Direct State Surveillance: Identifying clinical disparities correlating live encounter data with mandated TMaH strata.
          </p>
        </div>
        <div className="flex gap-2">
           <button className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all">
             <Eye className="w-4 h-4 text-teal-500" />
             Public Dashboard
           </button>
           <button className="bg-teal-50 text-slate-800 px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold hover:bg-teal-100 transition-all">
             <FileJson className="w-4 h-4 text-teal-400" />
             Submit Mandated Report
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard icon={<Scale />} title="Current Systemic Gap" value="14.2%" trend="+0.2% today" trendDir="up" detail="Variance in SMM outcomes." />
        <StatCard icon={<Map />} title="Active Disparity Hotspots" value="3" trend="Geographic Zones" detail="Regions exceeding State thresholds." color="bg-teal-50 text-slate-800" />
        <StatCard icon={<ShieldCheck />} title="Reporting Readiness" value="98%" trend="Sync Complete" detail="Percentage of valid Race/Ethnicity coding." />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-8 space-y-8">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[450px]">
            <div className="flex justify-between items-center mb-8">
               <div>
                  <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                    <Fingerprint className="w-5 h-5 text-teal-600" />
                    Mandated Strata: Race Disparity
                  </h3>
               </div>
            </div>
            
            <div className="flex-1">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={raceStratification} layout="vertical" margin={{ left: 40, right: 40 }}>
                     <XAxis type="number" hide />
                     <YAxis dataKey="group" type="category" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#1e293b', fontWeight: '900'}} width={100} />
                     <Tooltip />
                     <Bar dataKey="rate" radius={[0, 8, 8, 0]} barSize={32}>
                        {raceStratification.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                     </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[350px]">
              <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 mb-6">
                 <TrendingUp className="w-4 h-4 text-emerald-500" />
                 Live Gap Velocity
              </h3>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={gapVelocity} margin={{ left: -20, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#94a3b8'}} domain={[14, 15]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="gap" stroke="#3a8c81" strokeWidth={3} dot={{ r: 4 }} />
                    <ReferenceLine y={14.3} stroke="#10b981" strokeDasharray="3 3" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[350px]">
              <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 mb-4">
                 <Users className="w-4 h-4 text-teal-500" />
                 Mandated Strata: Ethnicity
              </h3>
              <div className="flex-1 flex items-center justify-center relative">
                 <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-900">28.4</span>
                    <span className="text-[8px] text-slate-400 font-bold uppercase">Hispanic SMM</span>
                 </div>
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie data={[{ name: 'Hispanic', value: 28.4 }, { name: 'Non-Hispanic', value: 22.1 }]} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value">
                          <Cell fill="#3a8c81" />
                          <Cell fill="#f1f5f9" />
                       </Pie>
                    </PieChart>
                 </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 space-y-8">
           <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-6">TMaH Compliance Audit</h4>
              <div className="space-y-4">
                 <AuditItem label="Race Strata Accuracy" status="99.2%" type="emerald" />
                 <AuditItem label="Ethnicity Coding" status="97.4%" type="emerald" />
                 <AuditItem label="Geocoding Precision" status="92.1%" type="amber" />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, title, value, trend, detail, color = "bg-white" }: any) => (
  <div className={`${color} p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group`}>
    <div className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-60">{title}</div>
    <div className="flex items-baseline gap-2">
      <span className="text-4xl font-black tracking-tighter">{value}</span>
      <span className="text-xs font-bold opacity-80">{trend}</span>
    </div>
    <p className="text-[10px] font-medium mt-2 opacity-60">{detail}</p>
    <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
      {React.cloneElement(icon, { className: 'w-8 h-8' })}
    </div>
  </div>
);

const AuditItem = ({ label, status, type }: any) => {
  const colorClass = type === 'emerald' ? 'bg-emerald-500 text-emerald-600' : 'bg-amber-500 text-amber-600';
  return (
    <div className="flex justify-between items-center">
      <span className="text-[11px] font-bold text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
         <div className="w-8 h-1 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full ${colorClass.split(' ')[0]}`} style={{ width: status }}></div>
         </div>
         <span className={`text-[11px] font-black ${colorClass.split(' ')[1]}`}>{status}</span>
      </div>
    </div>
  );
}

export default EquityStratificationView;