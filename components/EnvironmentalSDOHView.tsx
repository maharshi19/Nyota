
import React, { useState, useMemo } from 'react';
import { useData } from '../DataContext';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  Cell, AreaChart, Area, ScatterChart, Scatter, ZAxis,
  LineChart, Line, CartesianGrid
} from 'recharts';
import { 
  Wind, 
  Thermometer, 
  ShoppingBasket, 
  Bus, 
  MapPin, 
  AlertTriangle, 
  Zap, 
  ShieldCheck, 
  TrendingUp,
  Droplets,
  CloudSun,
  Factory,
  ArrowUpRight,
  Info,
  Layers,
  Search,
  Filter,
  Activity
} from 'lucide-react';
import EnvironmentalRiskMap from './EnvironmentalRiskMap';


const EnvironmentalSDOHView: React.FC = () => {
  const [activeOverlay, setActiveOverlay] = useState<'heat' | 'aqi' | 'deserts'>('heat');
  const { items } = useData();

  const triggerClimateInterventions = () => {
    // Create CSV data for climate interventions
    const csvData = [
      ['Member ID', 'Name', 'Location', 'Climate Risk', 'Intervention Type', 'Priority', 'Estimated Cost', 'Expected Impact'],
      ...CLIMATE_IMPACT_DATA.flatMap(group => 
        Array.from({ length: Math.min(group.smmRate, 20) }, (_, i) => {
          const interventions = [
            { type: 'Air Purifier Distribution', cost: 150, impact: 'Reduce Respiratory Issues' },
            { type: 'Heat Relief Support', cost: 200, impact: 'Prevent Heat-Related Complications' },
            { type: 'Food Access Program', cost: 100, impact: 'Address Food Insecurity' },
            { type: 'Transportation Support', cost: 250, impact: 'Improve Access to Care' }
          ];
          const intervention = interventions[i % interventions.length];
          return [
            `ENV-${group.group.replace(/\s+|\W/g, '')}-${String(i + 1).padStart(3, '0')}`,
            `Member ${group.group} ${i + 1}`,
            '38722', // Sample zip
            group.group,
            intervention.type,
            group.group === 'AQI > 100' ? 'High' : 'Medium',
            `$${intervention.cost}`,
            intervention.impact
          ];
        })
      )
    ];

    // Convert to CSV string
    const csvContent = csvData.map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `climate_interventions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ribbon metrics
  const envHighRiskLives = items.length;
  const activeClimateAlerts = useMemo(() => items.filter(i => {
    const env = i.caseData.environmental;
    return (env?.airQuality && Number(env.airQuality) > 100) || (env?.heatIndex && env.heatIndex > 100);
  }).length, [items]);
  const resourceStrainIndex = useMemo(() => {
    const vals = items.map(i => i.analysis?.tmahMetrics.resourceStrainIndex || 0);
    return vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : '0';
  }, [items]);
  const pmpmAvoidance = useMemo(() => items.reduce((sum, i) => sum + (i.estimatedSavings || 0), 0), [items]);

  // chart data
  const CLIMATE_IMPACT_DATA = useMemo(() => [
    { group: 'AQI > 100', smmRate: items.filter(i => {
        const env = i.caseData.environmental;
        return env?.airQuality && Number(env.airQuality) > 100;
      }).length,
      baseline: 18 },
    { group: 'Heat Wave', smmRate: items.filter(i => {
        const env = i.caseData.environmental;
        return env?.heatIndex && env.heatIndex > 100;
      }).length,
      baseline: 18 },
    { group: 'Food Desert', smmRate: items.filter(i => i.caseData.environmental?.foodDesertStatus).length, baseline: 18 },
    { group: 'Transport Gap', smmRate: items.filter(i => i.caseData.environmental?.transportationDesertStatus).length, baseline: 18 },
  ], [items]);

  const SDOH_CORRELATION = useMemo(() => {
    // simplistic scatter: life count vs risk index if any
    return items.map((i, idx) => ({
      x: i.caseData.vitals ? i.caseData.vitals.length * 5 : 0,
      y: i.caseData.environmental?.heatIndex || 0,
      z: 1,
      name: i.name,
    }));
  }, [items]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8 space-y-8 custom-scrollbar">
      
      {/* 1. MODULE B HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-extrabold text-emerald-600 uppercase tracking-[0.2em]">
            <CloudSun className="w-3.5 h-3.5" />
            Module B: Environmental & SDOH Intelligence
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">Environmental Risk Command</h2>
          <p className="text-sm text-slate-500 max-w-3xl font-medium leading-relaxed">
            Eliminating the <span className="text-emerald-600 font-bold">87% Environmental Blind Spot</span>. 
            Correlating "Environmental Vital Signs" (Heat, Air, Nutrition, Transit) with mandated TMaH clinical outcomes.
          </p>
        </div>
        <div className="flex gap-2">
           <button className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all">
             <Filter className="w-4 h-4 text-slate-400" />
             Overlay Layers
           </button>
           <button className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-black uppercase tracking-widest hover:bg-emerald-500 transition-all" onClick={triggerClimateInterventions}>
             <Zap className="w-4 h-4 text-emerald-200" />
             Trigger Climate Interventions
           </button>
        </div>
      </div>

      {/* 2. ENVIRONMENTAL KPI RIBBON */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <MetricBox label="Env. High Risk Lives" value={envHighRiskLives} sub="87% Assessment Complete" icon={<Activity className="text-emerald-500" />} />
         <MetricBox label="Active Climate Alerts" value={activeClimateAlerts} sub="Heat/AQI alerts" icon={<Thermometer className="text-rose-400 animate-pulse" />} highlight="text-rose-400" />
         <MetricBox label="Resource Strain Index" value={`${resourceStrainIndex}/10`} sub="HEDIS Impact Risk" icon={<ShoppingBasket className="text-amber-500" />} />
         <MetricBox label="PMPM Avoidance" value={`$${(pmpmAvoidance/1000).toFixed(1)}k`} sub="Climate Mitigation" icon={<TrendingUp className="text-teal-500" />} />
      </div>

      {/* 3. CORE WORKSPACE: GIS & CORRELATION */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* LEFT: GIS OVERLAY MAP */}
        <div className="xl:col-span-7 flex flex-col gap-6">
           <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-[500px] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h3 className="text-lg font-black text-slate-900">Live Stressor Overlay</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Correlating ZIP-level stressors with member risk</p>
                 </div>
                 <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                    <OverlayTab active={activeOverlay === 'heat'} onClick={() => setActiveOverlay('heat')} label="Heat" icon={<Thermometer className="w-3 h-3" />} />
                    <OverlayTab active={activeOverlay === 'aqi'} onClick={() => setActiveOverlay('aqi')} label="AQI" icon={<Wind className="w-3 h-3" />} />
                    <OverlayTab active={activeOverlay === 'deserts'} onClick={() => setActiveOverlay('deserts')} label="Deserts" icon={<MapPin className="w-3 h-3" />} />
                 </div>
              </div>
              <div className="flex-1 rounded-2xl overflow-hidden border border-slate-100">
                 <EnvironmentalRiskMap />
              </div>
           </div>

           {/* CLIMATE-CLINICAL CORRELATION BAR CHART */}
           <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                 <ArrowUpRight className="w-5 h-5 text-rose-400" />
                 Climate-Clinical Correlation (SMM Rates)
              </h3>
              <div className="h-64">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={CLIMATE_IMPACT_DATA} margin={{ left: -20 }}>
                       <XAxis dataKey="group" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}} />
                       <YAxis hide />
                       <Tooltip cursor={{fill: '#f8fafc'}} />
                       <Bar dataKey="baseline" stackId="a" fill="#f1f5f9" radius={[4, 4, 0, 0]} barSize={40} />
                       <Bar dataKey="smmRate" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={40}>
                          {CLIMATE_IMPACT_DATA.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={entry.smmRate > 35 ? '#f43f5e' : '#fb7185'} />
                          ))}
                       </Bar>
                    </BarChart>
                 </ResponsiveContainer>
              </div>
              <div className="mt-4 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                 <span>Baseline Risk (Network)</span>
                 <span className="text-rose-400">Environmental Risk Multiplier</span>
              </div>
           </div>
        </div>

        {/* RIGHT: SDOH CLUSTERS & PRESCRIPTIVE INTERVENTIONS */}
        <div className="xl:col-span-5 space-y-6">
           {/* SDOH RISK SCATTER (87% Assessment Visualization) */}
           <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">SDOH Stressor Clustering</h4>
              <div className="flex-1 relative">
                 <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                       <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                       <XAxis type="number" dataKey="x" name="Clinical Severity" hide />
                       <YAxis type="number" dataKey="y" name="Environmental Stress" hide />
                       <ZAxis type="number" dataKey="z" range={[100, 1000]} name="Lives Impacted" />
                       <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                       <Scatter name="Risk Clusters" data={SDOH_CORRELATION} fill="#10b981" fillOpacity={0.6}>
                          {SDOH_CORRELATION.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={entry.z > 80 ? '#f43f5e' : '#10b981'} />
                          ))}
                       </Scatter>
                    </ScatterChart>
                 </ResponsiveContainer>
                 {/* Visual Label Overlays for the Scatter */}
                 <div className="absolute top-2 right-2 text-[8px] font-black text-rose-400 uppercase">Critical Intersection</div>
                 <div className="absolute bottom-2 left-2 text-[8px] font-black text-emerald-600 uppercase">Manageable Baseline</div>
              </div>
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-4 italic">
                Mapping the intersection of high-risk clinical factors and critical environmental gaps.
              </p>
           </div>

           {/* MODULE B PRESCRIPTIVE ENGINE (Environmental Workflows) */}
           <div className="bg-emerald-900 rounded-3xl p-8 text-white relative overflow-hidden group">
              <div className="relative z-10">
                 <div className="flex items-center gap-3 mb-6">
                    <div className="bg-emerald-500/20 p-2 rounded-xl border border-white/10">
                       <Zap className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h4 className="text-sm font-black uppercase tracking-widest">Climate-Triggered Interventions</h4>
                 </div>
                 <div className="space-y-4">
                    <EnvWorkflowItem 
                      icon={<Thermometer className="w-4 h-4" />}
                      title="Heat Crisis Dispatch"
                      status="4 Active"
                      desc="Dispatching portable AC/Cooling units to high-risk HTN members in Zip 30310."
                      color="rose"
                    />
                    <EnvWorkflowItem 
                      icon={<ShoppingBasket className="w-4 h-4" />}
                      title="Food Desert Subsidy"
                      status="14 Enrolled"
                      desc="Authorized home delivery of therapeutic groceries for high-BMI members."
                      color="amber"
                    />
                    <EnvWorkflowItem 
                      icon={<Bus className="w-4 h-4" />}
                      title="Transit Bridge Activation"
                      status=" Ready"
                      desc="Uber Health vouchers triggered for PND-E follow-up window (Day 30)."
                      color="teal"
                    />
                 </div>
              </div>
              <CloudSun className="absolute -right-10 -bottom-10 w-48 h-48 text-white/5 group-hover:scale-110 transition-transform duration-700" />
           </div>

           <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-start gap-4">
              <div className="bg-teal-50 p-3 rounded-2xl border border-teal-100 shadow-inner">
                 <ShieldCheck className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                 <h5 className="text-xs font-black text-slate-900 uppercase">TMaH Pillar 3 Compliance</h5>
                 <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">
                   Module B logic executes the mandated "Environmental Risk Assessment" for 100% of the population, automating data submission to the State Medicaid Agency.
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const MetricBox = ({ label, value, sub, icon, highlight = 'text-slate-900' }: any) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group hover:border-emerald-300 transition-all">
     <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl group-hover:bg-white transition-colors">{icon}</div>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
     </div>
     <div className={`text-2xl font-black tracking-tighter ${highlight}`}>{value}</div>
     <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{sub}</div>
  </div>
);

const OverlayTab = ({ active, onClick, label, icon }: any) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all
      ${active ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
  >
    {icon}
    {label}
  </button>
);

const EnvWorkflowItem = ({ icon, title, status, desc, color }: any) => (
  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl group/item hover:bg-white/10 transition-colors">
     <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-3">
           <div className={`p-1.5 rounded-lg ${color === 'rose' ? 'bg-rose-500/20 text-rose-400' : color === 'amber' ? 'bg-amber-500/20 text-amber-400' : 'bg-teal-500/20 text-teal-400'}`}>
              {icon}
           </div>
           <span className="text-xs font-black uppercase tracking-tight">{title}</span>
        </div>
        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{status}</span>
     </div>
     <p className="text-[10px] text-white/50 leading-relaxed font-medium group-hover/item:text-white/80 transition-colors">
        {desc}
     </p>
  </div>
);

export default EnvironmentalSDOHView;
