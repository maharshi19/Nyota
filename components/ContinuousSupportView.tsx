
import React, { useState, useEffect } from 'react';
import { BoardItem } from '../types';
import { useAuth } from '../AuthContext';
import { useData } from '../DataContext';
import { 
  Users, 
  CalendarCheck, 
  ShieldCheck, 
  TrendingUp, 
  MapPin, 
  HeartHandshake, 
  Zap, 
  Activity,
  ArrowRight,
  Target,
  UserCheck
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';

interface ContinuousSupportViewProps {
  selectedMember: BoardItem | null;
}

const ContinuousSupportView: React.FC<ContinuousSupportViewProps> = ({ selectedMember }) => {
  const { token } = useAuth();
  const { items } = useData();
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!token) return;
    fetch('/api/careforce', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setRoleCounts(d.roleCounts || {}); })
      .catch(err => console.error('ContinuousSupport careforce fetch:', err));
  }, [token]);

  const ROLE_META: Record<string, { color: string; target: number }> = {
    Midwives: { color: '#10b981', target: 50 },
    Doulas:   { color: '#ec4899', target: 60 },
    CHWs:     { color: '#3a8c81', target: 50 },
    Nurses:   { color: '#0d9488', target: 40 },
    MDs:      { color: '#6366f1', target: 20 },
  };

  const aggregateMetrics = Object.entries(roleCounts).map(([name, value]) => ({
    name,
    value: value as number,
    color: ROLE_META[name]?.color ?? '#94a3b8',
    target: ROLE_META[name]?.target ?? Math.round((value as number) * 1.25),
  }));

  // Support advantage derived from board items
  const withoutSupport = items.filter(i =>
    !i.caseData?.communityAccess?.doulaAvailable &&
    !i.caseData?.communityAccess?.midwifeAvailable &&
    !i.caseData?.communityAccess?.chwAssigned
  );
  const criticalWithout = withoutSupport.length
    ? Math.round(withoutSupport.filter(i => i.status === 'Critical').length / withoutSupport.length * 100)
    : 0;

  const disparityReduction = [
    {
      group: 'Doula Assigned',
      withSupport: (() => {
        const s = items.filter(i => i.caseData?.communityAccess?.doulaAvailable);
        return s.length ? Math.round(s.filter(i => i.status === 'Critical').length / s.length * 100) : 0;
      })(),
      withoutSupport: criticalWithout,
    },
    {
      group: 'CHW Assigned',
      withSupport: (() => {
        const s = items.filter(i => i.caseData?.communityAccess?.chwAssigned);
        return s.length ? Math.round(s.filter(i => i.status === 'Critical').length / s.length * 100) : 0;
      })(),
      withoutSupport: criticalWithout,
    },
    {
      group: 'Midwife Avail.',
      withSupport: (() => {
        const s = items.filter(i => i.caseData?.communityAccess?.midwifeAvailable);
        return s.length ? Math.round(s.filter(i => i.status === 'Critical').length / s.length * 100) : 0;
      })(),
      withoutSupport: criticalWithout,
    },
  ];

  const criticalWithoutSupportByZip = withoutSupport
    .filter(i => i.status === 'Critical')
    .reduce<Record<string, number>>((acc, item) => {
      const zip = item.caseData?.environmental?.zipCode || 'Unknown';
      acc[zip] = (acc[zip] || 0) + 1;
      return acc;
    }, {});

  const [priorityZip = 'N/A', priorityZipDeficit = 0] = Object.entries(criticalWithoutSupportByZip)
    .sort((a, b) => b[1] - a[1])[0] || [];

  const doulaCurrent = roleCounts.Doulas || 0;
  const doulaTarget = ROLE_META.Doulas.target;
  const doulaGrowthPct = doulaCurrent > 0
    ? Math.max(0, Math.round(((doulaTarget - doulaCurrent) / doulaCurrent) * 100))
    : 0;

  const highRiskMembers = items.filter(i => i.status === 'Critical' || i.status === 'Reviewing');
  const coveredHighRisk = highRiskMembers.filter(i =>
    i.caseData?.communityAccess?.doulaAvailable ||
    i.caseData?.communityAccess?.midwifeAvailable ||
    i.caseData?.communityAccess?.chwAssigned
  ).length;
  const coverageGoalPct = highRiskMembers.length
    ? Math.round((coveredHighRisk / highRiskMembers.length) * 100)
    : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8 space-y-8 custom-scrollbar">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-extrabold text-teal-600 uppercase tracking-[0.2em]">
            <CalendarCheck className="w-3.5 h-3.5" />
            Population Care Force Intelligence
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            {selectedMember ? `Support Map: ${selectedMember.name}` : "Collective Support Perspective"}
          </h2>
          <p className="text-sm text-slate-500 max-w-2xl font-medium leading-relaxed">
            {selectedMember 
              ? `Real-time support synchronization for MRN ${selectedMember.mrn}. Analyzing the clinical impact of ${selectedMember.caseData.communityAccess?.doulaAvailable ? 'active' : 'missing'} continuous support.`
              : "State-wide analysis of continuous support adequacy (Midwives, Doulas, CHWs). Measuring the clinical and economic impact of community care interventions on SMM outcomes."}
          </p>
        </div>
      </div>

      {selectedMember ? (
        // INDIVIDUAL PERSPECTIVE
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-8 space-y-8">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
               <div className="flex items-center gap-4 mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-teal-600 flex items-center justify-center text-white text-2xl font-black">
                     {selectedMember.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">{selectedMember.name}</h3>
                    <div className="text-sm text-slate-400 font-bold uppercase tracking-widest">Active Member Record</div>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <SupportStatusCard 
                    label="Certified Midwife" 
                    status={selectedMember.caseData.communityAccess?.midwifeAvailable ? 'Connected' : 'Unmapped'} 
                    type="midwife"
                  />
                  <SupportStatusCard 
                    label="Birth Doula" 
                    status={selectedMember.caseData.communityAccess?.doulaAvailable ? 'Active' : 'Missing'} 
                    type="doula"
                  />
                  <SupportStatusCard 
                    label="Community Health" 
                    status={selectedMember.caseData.communityAccess?.chwAssigned ? 'Assigned' : 'Reviewing'} 
                    type="chw"
                  />
               </div>

               <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Support Intervention Narrative</h4>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium">
                    {selectedMember.analysis?.cognitiveContext?.communitySupportNote || "Waiting for diagnostic model to evaluate support adequacy based on environmental and clinical stressors."}
                  </p>
               </div>
            </div>

            <div className="bg-teal-50 text-slate-800 p-8 rounded-3xl shadow-xl relative overflow-hidden">
               <div className="relative z-10">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-teal-400" />
                    Predictive Support Impact
                  </h3>
                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-5xl font-black text-teal-400 tracking-tighter">18.4%</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Risk Mitigation Value</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                    By providing continuous support (specifically Doula + Midwife coordination) for this member, we project a significant reduction in the likelihood of a high-cost NICU event.
                  </p>
               </div>
               <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl"></div>
            </div>
          </div>

          <div className="xl:col-span-4 space-y-6">
             <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Required Dispatch Actions</h4>
                <div className="space-y-3">
                   {selectedMember.analysis?.prescriptiveIntelligence?.filter(p => p.interventionType.includes('Doula') || p.interventionType.includes('CHW')).map((p, i) => (
                     <div key={i} className="flex gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="bg-white p-2 rounded-lg"><UserCheck className="w-4 h-4 text-teal-500" /></div>
                        <div>
                          <div className="text-[11px] font-black text-slate-800 leading-tight mb-1">{p.action}</div>
                          <div className="text-[9px] font-bold text-emerald-600">Avoidance: ${p.potentialSavings.toLocaleString()}</div>
                        </div>
                     </div>
                   ))}
                   {!selectedMember.analysis && <div className="text-[10px] text-slate-400 italic">Analyze case to see required dispatch actions.</div>}
                </div>
             </div>
          </div>
        </div>
      ) : (
        // COLLECTIVE PERSPECTIVE
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
           <div className="xl:col-span-8 space-y-8">
              {/* SUPPORT ADEQUACY GRID */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                 <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">Network Support Adequacy</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active vs Target Utilization</p>
                    </div>
                    <div className="flex gap-4">
                       <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400"><div className="w-3 h-3 rounded-sm bg-slate-200"></div> Target</div>
                       <div className="flex items-center gap-2 text-[10px] font-bold text-teal-600"><div className="w-3 h-3 rounded-sm bg-teal-700"></div> Active</div>
                    </div>
                 </div>
                 
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={aggregateMetrics} margin={{ left: -20, bottom: 0 }}>
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                          <YAxis hide />
                          <Tooltip cursor={{fill: '#f8fafc'}} />
                          <Bar dataKey="target" fill="#f1f5f9" radius={[4, 4, 0, 0]} barSize={40} />
                          <Bar dataKey="value" fill="#3a8c81" radius={[4, 4, 0, 0]} barSize={40}>
                             {aggregateMetrics.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={entry.color} />
                             ))}
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              {/* CLINICAL IMPACT: SMM REDUCTION VIA SUPPORT */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                 <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">The "Support Advantage"</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">SMM Rates Stratified by Continuous Support Access</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {disparityReduction.map((d, i) => {
                      const ratio = d.withoutSupport > 0 ? d.withSupport / d.withoutSupport : 1;
                      const reductionPct = Math.round((1 - ratio) * 100);
                      const clipPct = Math.max(0, Math.min(100, 100 - ratio * 100));
                      return (
                      <div key={i} className="flex flex-col items-center">
                        <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                           <div className="absolute inset-0 rounded-full border-8 border-slate-50"></div>
                           <div className="absolute inset-0 rounded-full border-8 border-teal-600" style={{ clipPath: `inset(0 0 ${clipPct}% 0)` }}></div>
                           <div className="flex flex-col items-center">
                             <span className="text-xl font-black text-slate-900">{reductionPct >= 0 ? `-${reductionPct}%` : `+${Math.abs(reductionPct)}%`}</span>
                             <span className="text-[8px] font-bold text-slate-400 uppercase">SMM Risk</span>
                           </div>
                        </div>
                        <div className="text-center">
                           <div className="text-xs font-black text-slate-800">{d.group}</div>
                           <div className="text-[10px] text-slate-400 font-medium">With vs. Without Support</div>
                        </div>
                      </div>
                    )})}
                 </div>
              </div>
           </div>

           <div className="xl:col-span-4 space-y-6">
              <div className="bg-teal-50 text-slate-800 p-6 rounded-3xl shadow-xl">
                 <h4 className="text-[10px] font-black text-teal-400 uppercase tracking-widest mb-6">MCO Action: Dispatch Gaps</h4>
                 <div className="space-y-6">
                    <div className="flex gap-4">
                       <div className="p-2 bg-white/10 rounded-xl"><MapPin className="w-5 h-5 text-rose-400" /></div>
                       <div>
                         <div className="text-xs font-black">Zip {priorityZip}: CHW Deficit</div>
                         <div className="text-[10px] text-slate-400">{priorityZipDeficit} high-risk members unmapped to CHW.</div>
                       </div>
                    </div>
                    <div className="flex gap-4">
                       <div className="p-2 bg-white/10 rounded-xl"><HeartHandshake className="w-5 h-5 text-teal-400" /></div>
                       <div>
                         <div className="text-xs font-black">Doula Network Expansion</div>
                         <div className="text-[10px] text-slate-400">Targeting {doulaGrowthPct}% capacity increase to hit network target.</div>
                       </div>
                    </div>
                 </div>
                 <button className="w-full mt-8 py-3 bg-teal-600 text-[10px] font-black text-white uppercase tracking-widest rounded-xl">
                   Dispatch Mobile Care Force
                 </button>
              </div>

              <div className="bg-teal-50 border border-teal-100 p-6 rounded-3xl">
                 <div className="flex items-center gap-3 mb-4">
                    <Target className="w-5 h-5 text-teal-600" />
                    <h4 className="text-xs font-black text-teal-900 uppercase">TMaH Performance Goal</h4>
                 </div>
                 <div className="text-2xl font-black text-slate-900 mb-2">{coverageGoalPct}% Coverage</div>
                 <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                   Live goal progress: {coveredHighRisk} of {highRiskMembers.length} high-risk members currently mapped to continuous support.
                 </p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const SupportStatusCard = ({ label, status, type }: any) => {
  const icons = {
    midwife: <ShieldCheck className="w-5 h-5" />,
    doula: <HeartHandshake className="w-5 h-5" />,
    chw: <Users className="w-5 h-5" />
  };
  const colors = {
    midwife: 'text-emerald-500',
    doula: 'text-teal-600',
    chw: 'text-teal-500'
  };

  return (
    <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl group hover:bg-white hover:border-teal-100 transition-all">
       <div className={`p-2 rounded-xl mb-3 w-fit ${colors[type as keyof typeof colors]} bg-white shadow-sm`}>
          {icons[type as keyof typeof icons]}
       </div>
       <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
       <div className={`text-sm font-black ${status === 'Active' || status === 'Connected' || status === 'Assigned' ? 'text-slate-900' : 'text-slate-400 italic'}`}>
         {status}
       </div>
    </div>
  );
};

export default ContinuousSupportView;
