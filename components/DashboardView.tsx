
import React, { useState, useMemo } from 'react';
import { BoardGroup, BoardItem } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  Cell, AreaChart, Area, PieChart, Pie, Legend
} from 'recharts';
import { 
  ShieldAlert, Globe, Banknote, Zap, Activity, Calculator, 
  Thermometer, Percent, TrendingUp, Target, Users, Building2, 
  HeartHandshake, AlertTriangle, ArrowUpRight, ArrowDownRight, 
  MapPin, Wind, Search, ChevronRight, FileText, Clock, 
  ZapOff, Filter, ShoppingBasket, Bus, MoreHorizontal, UserCheck
} from 'lucide-react';
import EnvironmentalRiskMap from './EnvironmentalRiskMap';
import { dashboardTheme } from '../utils/dashboardTheme';

interface DashboardViewProps {
  groups: BoardGroup[];
}

const DashboardView: React.FC<DashboardViewProps> = ({ groups }) => {
  const palette = dashboardTheme;

  const allItems = useMemo(() => groups.flatMap(g => g.items), [groups]);
  const [mapOverlay, setMapOverlay] = useState<'clinical' | 'environmental' | 'resource'>('environmental');
  const [mapViewMode, setMapViewMode] = useState<'canvas' | 'map'>('canvas');

  // Filter items based on selected overlay
  const filteredItems = useMemo(() => {
    switch (mapOverlay) {
      case 'clinical':
        return allItems.filter(item => 
          item.caseData?.hypertension || 
          item.caseData?.diabetes || 
          item.smmCondition
        );
      case 'environmental':
        return allItems.filter(item => 
          item.caseData?.heatIslandIndex !== undefined || 
          item.caseData?.aqi !== undefined
        );
      case 'resource':
        return allItems.filter(item => 
          item.caseData?.foodDesert || 
          item.caseData?.transportationAccess === false
        );
      default:
        return allItems;
    }
  }, [allItems, mapOverlay]);

  // 1. EXECUTIVE PULSE CALCULATIONS
  const criticalFlags = filteredItems.filter(i => i.status === 'Critical').length;
  const phiScore = filteredItems.length > 0
    ? Math.round((filteredItems.length - criticalFlags) / filteredItems.length * 100)
    : 0; // simple PHI: % non-critical
  const qtdSavings = filteredItems.reduce((sum, i) => sum + (i.caseData?.estimatedSavings || 0), 0);
  const tmahStatus = criticalFlags > 0 ? 'red' : 'green';

  // 4. FINANCIAL FORECAST DATA – group by category so charts have meaningful bars
  // NICU funnel: aggregate count + avg probability per category
  const nicuFunnelData = (() => {
    const categoryMap: Record<string, { count: number; totalProb: number }> = {};
    filteredItems.forEach(i => {
      const cat = i.nicuCategory && i.nicuCategory !== 'Unknown' ? i.nicuCategory : null;
      if (!cat) return;
      if (!categoryMap[cat]) categoryMap[cat] = { count: 0, totalProb: 0 };
      categoryMap[cat].count += 1;
      categoryMap[cat].totalProb += Number(i.nicuProbability || 0);
    });
    const colorMap: Record<string, string> = {
      'High Prob': palette.critical,
      'Rising Prob': palette.warning,
      'Low Prob': palette.teal,
    };
    return Object.entries(categoryMap)
      .map(([name, { count, totalProb }]) => ({
        name,
        value: count,
        avgProb: Math.round(totalProb / count),
        color: colorMap[name] || palette.teal,
      }))
      .sort((a, b) => b.value - a.value);
  })();

  const smmTrackerData = filteredItems.reduce((acc, i) => {
      const condition = i.smmCondition;
      // Skip blank, None, and Unknown entries
      if (!condition || condition === 'None' || condition === 'Unknown') return acc;
      const entry = acc.find(e => e.name === condition);
      if (entry) entry.risk += 1;
      else acc.push({ name: condition, risk: 1 });
      return acc;
  }, [] as {name:string; risk:number}[]);

  const pmpmData = [
    { name: 'Nyota Managed', cost: 11850 },
    { name: 'Standard Care', cost: 14200 },
  ];

  // 5. SCORECARD DATA – compute sample percentages
  const ppcPre = allItems.filter(i => i.ppcPre).length > 0
    ? Math.round(allItems.filter(i => i.ppcPre === true).length / allItems.length * 100)
    : 0;
  const ppcPost = allItems.filter(i => i.ppcPost).length > 0
    ? Math.round(allItems.filter(i => i.ppcPost === true).length / allItems.length * 100)
    : 0;
  const equityGap = 0; // placeholder; calculate from row metadata if available

  const canvasBg = 'linear-gradient(165deg, #edf3ef 0%, #e7efe9 52%, #ebf4f1 100%)';
  const topRibbonBg = 'linear-gradient(180deg, #f7fbf9 0%, #ecf4f0 100%)';
  const warmPanelBg = '#f6f2ea';
  const softPanelBg = '#f1eadf';
  const coolPanelBg = '#e7f1ed';

  return (
    <div className="flex-1 overflow-y-auto flex flex-col h-full custom-scrollbar" style={{ background: canvasBg }}>
      
      {/* 1. THE EXECUTIVE PULSE (Top Ribbon) */}
      <div className="border-b px-6 py-4 grid grid-cols-1 md:grid-cols-5 gap-6 sticky top-0 z-30 shadow-sm" style={{ borderColor: palette.border, background: topRibbonBg }}>
        <div className="flex items-center gap-3 p-2 rounded-2xl" style={{ backgroundColor: '#ece5d8', border: `1px solid ${palette.border}` }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm" style={{ background: `linear-gradient(135deg, ${palette.teal}, ${palette.goldSoft})` }}>
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: palette.teal }}>
              Command Tower
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: palette.gold }}>Live Network View</div>
          </div>
        </div>
        <PulseMetric 
          label="Population Health Index (PHI)" 
          value={`${phiScore}/100`} 
          sub="Network Wellness Score"
          icon={<Activity className="w-5 h-5" style={{ color: palette.sage }} />}
          palette={palette}
        />
        <PulseMetric 
          label="Active 72-Hour Flags" 
          value={criticalFlags} 
          sub="Predicted Acute Events"
          icon={<ShieldAlert className="w-5 h-5 animate-pulse" style={{ color: palette.rose }} />}
          highlight={palette.rose}
          palette={palette}
        />
        <PulseMetric 
          label="Projected Savings (QTD)" 
          value={`$${(qtdSavings/1000000).toFixed(1)}M`} 
          sub="Nyota Cost Avoidance"
          icon={<Banknote className="w-5 h-5" style={{ color: palette.sage }} />}
          palette={palette}
        />
        <div className="flex items-center gap-4">
           <div className="w-px h-10" style={{ backgroundColor: palette.sand }}></div>
           <div>
              <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: palette.textMid }}>TMaH Compliance</div>
              <div className="flex items-center gap-2">
                 <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: tmahStatus === 'green' ? palette.sage : palette.rose,
                    boxShadow: tmahStatus === 'green' ? `0 0 12px ${palette.sage}` : `0 0 12px ${palette.rose}`,
                  }}
                 ></div>
                 <span className="text-sm font-black text-slate-900 uppercase tracking-tight">Status: Active</span>
              </div>
           </div>
        </div>
      </div>

      <div className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-0">
        
        {/* 2. INTERVENTION FEED (Left Workspace) */}
          <div className="xl:col-span-3 flex flex-col rounded-3xl border shadow-sm overflow-hidden h-[calc(100vh-320px)]" style={{ borderColor: palette.sand, backgroundColor: palette.card }}>
            <div className="p-5 border-b flex justify-between items-center" style={{ borderColor: palette.border, background: 'linear-gradient(180deg, #eef5f1, #e4ece7)' }}>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Intervention Feed</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: palette.muted }}>Urgency Of Intervention</p>
              </div>
                <Filter className="w-4 h-4" style={{ color: palette.sage }} />
           </div>
              <div className="flex-1 overflow-y-auto divide-y custom-scrollbar" style={{ borderColor: palette.sand }}>
              {filteredItems.filter(i => i.status === 'Critical' || i.status === 'Reviewing').map(item => (
                 <InterventionCard key={item.id} item={item} palette={palette} />
              ))}
           </div>
        </div>

        {/* 3. ENVIRONMENTAL RISK MAP (Center Workspace) */}
        <div className="xl:col-span-6 flex flex-col gap-6 h-[calc(100vh-320px)]">
            <div className="flex-1 rounded-3xl border shadow-sm overflow-hidden relative" style={{ borderColor: palette.border, backgroundColor: palette.card }}>
              <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-end gap-3" style={{ borderColor: palette.border, background: 'linear-gradient(180deg, #eef5f1, #e7efea)' }}>
                <div className="flex-1 min-w-[160px]">
                  <label className="text-[10px] font-black uppercase tracking-widest block mb-1" style={{ color: palette.textMid }}>
                    Cluster Overlay
                  </label>
                  <select
                    value={mapOverlay}
                    onChange={(e) => setMapOverlay(e.target.value as 'clinical' | 'environmental' | 'resource')}
                    className="w-full rounded-xl border px-3 py-2 text-xs font-bold bg-white text-slate-700"
                    style={{ borderColor: palette.border }}
                  >
                    <option value="clinical">Clinical Clusters</option>
                    <option value="environmental">Environmental Stressors</option>
                    <option value="resource">Resource Gaps</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="text-[10px] font-black uppercase tracking-widest block mb-1" style={{ color: palette.textMid }}>
                    Map View Mode
                  </label>
                  <select
                    value={mapViewMode}
                    onChange={(e) => setMapViewMode(e.target.value as 'canvas' | 'map')}
                    className="w-full rounded-xl border px-3 py-2 text-xs font-bold bg-white text-slate-700"
                    style={{ borderColor: palette.border }}
                  >
                    <option value="canvas">Canvas View</option>
                    <option value="map">Geographic Map</option>
                  </select>
                </div>
                <div className="text-[10px] font-bold px-3 py-2 rounded-xl self-start sm:self-auto" style={{ backgroundColor: '#e8f1ec', color: palette.textMid }}>
                  {filteredItems.length} members in selected layer
                </div>
              </div>
              <EnvironmentalRiskMap overlay={mapOverlay} viewMode={mapViewMode} />
              <div className="absolute bottom-4 left-4 backdrop-blur-md p-4 rounded-2xl border max-w-[280px] z-20" style={{ backgroundColor: '#f8fcfaef', borderColor: palette.border, boxShadow: '0 10px 24px rgba(25,55,48,0.12)' }}>
                {mapOverlay === 'clinical' && (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldAlert className="w-4 h-4" style={{ color: palette.rose }} />
                      <span className="text-xs font-black">Clinical Risk Focus</span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-relaxed font-medium">
                      {filteredItems.filter(i => i.caseData?.hypertension).length} hypertension cases identified. 
                      {filteredItems.filter(i => i.smmCondition).length} SMM risk factors active. 
                      Intervention protocols engaged for high-risk clusters.
                    </p>
                  </>
                )}
                {mapOverlay === 'environmental' && (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <Thermometer className="w-4 h-4" style={{ color: palette.goldSoft }} />
                      <span className="text-xs font-black">Environmental Stressors</span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-relaxed font-medium">
                      Heat island index elevated in {filteredItems.filter(i => (i.caseData?.heatIslandIndex || 0) > 0.7).length} cases. 
                      AQI monitoring active. Emergency cooling interventions deployed to high-risk zones.
                    </p>
                  </>
                )}
                {mapOverlay === 'resource' && (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <ShoppingBasket className="w-4 h-4" style={{ color: palette.goldSoft }} />
                      <span className="text-xs font-black">Resource Gap Analysis</span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-relaxed font-medium">
                      {filteredItems.filter(i => i.caseData?.foodDesert).length} food desert correlations identified. 
                      Transportation barriers affecting {filteredItems.filter(i => i.caseData?.transportationAccess === false).length} members. 
                      Community resource allocation optimized.
                    </p>
                  </>
                )}
              </div>
           </div>
        </div>

        {/* 4. FINANCIAL & RESOURCE FORECASTING (Right Workspace) */}
        <div className="xl:col-span-3 space-y-6 h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar pr-1">
           {/* NICU Funnel */}
               <div className="p-6 rounded-3xl border shadow-sm" style={{ borderColor: palette.border, backgroundColor: warmPanelBg }}>
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: palette.textMid }}>
                 <ArrowDownRight className="w-3 h-3" style={{ color: palette.rose }} /> 
                 {mapOverlay === 'clinical' && 'Clinical Risk Funnel'}
                 {mapOverlay === 'environmental' && 'Environmental Impact Funnel'}
                 {mapOverlay === 'resource' && 'Resource Access Funnel'}
              </h4>
              {nicuFunnelData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-20 gap-1">
                  <span className="text-[11px] font-bold" style={{ color: palette.textMid }}>No risk data available</span>
                  <span className="text-[10px] text-slate-300">Load patient data to see risk distribution</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const maxVal = Math.max(...nicuFunnelData.map(d => d.value), 1);
                    return nicuFunnelData.map((d, i) => (
                      <div key={i} className="relative h-9 rounded-lg border overflow-hidden" style={{ backgroundColor: '#f6ead8', borderColor: palette.border }}>
                        <div className="absolute inset-y-0 left-0 transition-all duration-700" style={{ width: `${Math.round((d.value / maxVal) * 100)}%`, backgroundColor: d.color, opacity: 0.25 }} />
                        <div className="absolute inset-0 flex items-center justify-between px-3">
                          <span className="text-[10px] font-bold text-slate-700">{d.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-400">avg {d.avgProb}%</span>
                            <span className="text-xs font-black" style={{ color: d.color }}>{d.value} pts</span>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
           </div>

           {/* SMM Risk Tracker */}
            <div className="p-6 rounded-3xl border shadow-sm" style={{ borderColor: palette.border, backgroundColor: softPanelBg }}>
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: palette.textMid }}>
                {mapOverlay === 'clinical' && 'Clinical Risk Tracker (Big 4)'}
                {mapOverlay === 'environmental' && 'Environmental Risk Factors'}
                {mapOverlay === 'resource' && 'Resource Access Barriers'}
              </h4>
              {smmTrackerData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-1">
                  <span className="text-[11px] font-bold" style={{ color: palette.textMid }}>No condition data available</span>
                  <span className="text-[10px] text-slate-300">Conditions appear when clinical data is loaded</span>
                </div>
              ) : (
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={smmTrackerData} margin={{ bottom: 20 }}>
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 9, fontWeight: 700, fill: '#7a8e89' }}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                      />
                      <Tooltip
                        cursor={{ fill: palette.surfaceAlt }}
                        contentStyle={{ fontSize: 11, fontWeight: 700, borderRadius: 8, border: `1px solid ${palette.border}` }}
                        formatter={(val: number) => [`${val} patients`, 'Count']}
                      />
                      <Bar dataKey="risk" radius={[4, 4, 0, 0]} barSize={32}>
                        {smmTrackerData.map((entry, index) => (
                          <Cell key={index} fill={
                            entry.name === 'Hypertension' ? palette.critical :
                            entry.name === 'Diabetes' ? palette.warning :
                            entry.name === 'Air Quality' ? palette.teal :
                            palette.teal
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
           </div>

           {/* PMPM Impact */}
            <div className="rounded-3xl p-6 shadow-xl relative overflow-hidden" style={{ backgroundColor: coolPanelBg, border: `1px solid ${palette.stableBorder}` }}>
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: palette.gold }}>
                {mapOverlay === 'clinical' && 'Clinical Intervention ROI'}
                {mapOverlay === 'environmental' && 'Environmental Mitigation ROI'}
                {mapOverlay === 'resource' && 'Resource Access ROI'}
              </h4>
              <div className="space-y-4">
                 <div className="flex justify-between items-end">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Nyota Managed</div>
                    <div className="text-xl font-black" style={{ color: palette.gold }}>
                      ${mapOverlay === 'clinical' ? '11,850' : mapOverlay === 'environmental' ? '9,200' : '13,400'}
                    </div>
                 </div>
                 <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#d4c6b1' }}>
                    <div className="h-full" style={{ 
                      backgroundColor: palette.gold,
                      width: mapOverlay === 'clinical' ? '65%' : mapOverlay === 'environmental' ? '72%' : '58%' 
                    }}></div>
                 </div>
                 <div className="flex justify-between items-end opacity-90">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Standard Care</div>
                    <div className="text-xl font-black text-slate-700">
                      ${mapOverlay === 'clinical' ? '14,200' : mapOverlay === 'environmental' ? '12,800' : '15,600'}
                    </div>
                 </div>
              </div>
              <Zap className="absolute -right-6 -bottom-6 w-24 h-24" style={{ color: '#c6ddd4' }} />
           </div>
        </div>
      </div>

      {/* 5. THE TMaH & HEDIS SCORECARD (Bottom Workspace) */}
      <div className="border-t px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-8 shrink-0" style={{ borderColor: palette.border, backgroundColor: '#ddd2bf' }}>
        <div className="flex items-center gap-12">
         <ScorecardMetric label="PPC-Pre (Prenatal)" value={`${ppcPre}%`} goal="90%" status="surpass" palette={palette} />
         <ScorecardMetric label="PPC-Post (Postpartum)" value={`${ppcPost}%`} goal="85%" status="at-risk" palette={palette} />
         <div className="w-px h-10" style={{ backgroundColor: palette.border }}></div>
           <div>
              <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: palette.textMid }}>Equity Gap Analysis</div>
              <div className="flex items-center gap-4">
                 <span className="text-[10px] font-bold uppercase" style={{ color: palette.textMid }}>General</span>
                  <div className="w-48 h-2 rounded-full relative overflow-hidden" style={{ backgroundColor: '#d8c9b3' }}>
                    <div className="absolute inset-y-0 left-0" style={{ width: '40%', backgroundColor: palette.sage }}></div>
                    <div className="absolute inset-y-0 left-[40%] w-[14%]" style={{ backgroundColor: palette.rose }} title={`Gap: ${equityGap}%`}></div>
                 </div>
                  <span className="text-[10px] font-black uppercase" style={{ color: palette.rose }}>Black/Hispanic</span>
                  <span className="text-xs font-black" style={{ color: palette.rose }}>+{equityGap}% Variance</span>
              </div>
           </div>
        </div>
        <button
        onClick={() => {
          // Convert groups data to CSV
          const csvHeaders = [
            'Group Title',
            'Patient Name',
            'MRN',
            'Status',
            'Triage Level',
            'Risk Rank',
            'Last Vitals',
            'Updates Count',
            'Chief Complaint',
            'Age',
            'Gestation',
            'Parity',
            'Zip Code',
            'Air Quality',
            'Heat Index',
            'NICU Category',
            'NICU Probability',
            'SMM Condition',
            'PPC Pre',
            'PPC Post',
            'Estimated Savings'
          ];
          
          const csvRows = [csvHeaders.join(',')];
          
          groups.forEach(group => {
            group.items.forEach(item => {
              const row = [
                `"${group.title}"`,
                `"${item.name}"`,
                `"${item.mrn}"`,
                `"${item.status}"`,
                `"${item.triage}"`,
                item.riskRank,
                `"${item.lastVitals}"`,
                item.updatesCount,
                `"${item.caseData.chiefComplaint}"`,
                `"${item.caseData.age}"`,
                `"${item.caseData.gestation}"`,
                `"${item.caseData.parity}"`,
                `"${item.caseData.environmental.zipCode}"`,
                `"${item.caseData.environmental.airQuality}"`,
                item.caseData.environmental.heatIndex,
                `"${item.nicuCategory}"`,
                item.nicuProbability,
                `"${item.smmCondition}"`,
                item.ppcPre,
                item.ppcPost,
                item.estimatedSavings
              ];
              csvRows.push(row.join(','));
            });
          });
          
          const csvContent = csvRows.join('\n');
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'tmah-pillars.csv';
          a.click();
          URL.revokeObjectURL(url);
        }}
          className="px-6 py-3 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg"
            style={{ background: `linear-gradient(135deg, ${palette.teal}, ${palette.navyMid})`, boxShadow: `0 12px 22px -10px ${palette.teal}aa` }}
      >
              <FileText className="w-4 h-4" style={{ color: palette.goldSoft }} />
           Export TMaH Pillar 2 & 3 Compliance
      </button>
      </div>
    </div>
  );
};

const PulseMetric = ({ label, value, sub, icon, highlight = '#2f3f3a', palette }: any) => (
  <div className="flex items-start gap-4">
    <div className="p-2.5 rounded-2xl border" style={{ backgroundColor: palette.surface, borderColor: palette.border }}>{icon}</div>
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: palette.muted }}>{label}</div>
      <div className="text-xl font-black leading-none" style={{ color: highlight }}>{value}</div>
      <div className="text-[9px] font-bold uppercase mt-1 tracking-tighter" style={{ color: palette.muted }}>{sub}</div>
    </div>
  </div>
);

// Added proper typing for InterventionCard component to allow 'key' prop in lists
const InterventionCard: React.FC<{ item: BoardItem; palette: any }> = ({ item, palette }) => {
  const isCritical = item.status === 'Critical';
  const handleDispatchLyft = () => {
    const zipCode = item.caseData.environmental?.zipCode || '20001';
    const lyftUrl = `https://lyft.com/ride?id=lyft&pickup[latitude]=38.8951&pickup[longitude]=-77.0369&destination[latitude]=38.8951&destination[longitude]=-77.0369`;
    window.open(lyftUrl, '_blank');
    alert(`🚗 Dispatching Lyft help to patient ${item.name} (MRN: ${item.mrn}) at zip code ${zipCode}`);
  };

  return (
  <div className="p-4 transition-colors cursor-pointer group"
    style={{ backgroundColor: isCritical ? palette.criticalBg : '#fffaf4' }}>
    <div className="flex justify-between items-start mb-2">
      <div className="flex items-center gap-3">
        <div className="w-2 h-10 rounded-full" style={{ backgroundColor: isCritical ? palette.critical : palette.warning }}></div>
        <div>
           <div className="text-sm font-black text-slate-900">{item.name}</div>
           <div className="text-[10px] text-slate-400 font-bold">MRN {item.mrn} • Zip {item.caseData.environmental?.zipCode || 'Unknown'}</div>
        </div>
      </div>
      <div className="p-1 rounded-lg" style={{ backgroundColor: palette.surfaceAlt }}><ChevronRight className="w-4 h-4 text-slate-400" /></div>
    </div>
    <div className="border rounded-xl p-3 space-y-2" style={{ backgroundColor: palette.surface, borderColor: isCritical ? palette.criticalBorder : palette.border }}>
       <div className="flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" style={{ color: isCritical ? palette.critical : palette.warning }} />
          <span className="text-[10px] font-black text-slate-700 uppercase tracking-tighter">Trigger: BP Spike + Heat Wave</span>
       </div>
       <div className="flex gap-2">
          <button 
            onClick={handleDispatchLyft}
            className="flex-1 py-1.5 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-colors"
            style={{ backgroundColor: palette.teal }}
          >
            Dispatch Lyft Help
          </button>
          <button className="flex-1 py-1.5 border text-[9px] font-black uppercase tracking-widest rounded-lg transition-colors" style={{ backgroundColor: '#f6f4ef', borderColor: palette.border, color: palette.teal }}>Alert Doula</button>
       </div>
    </div>
  </div>
  );
};

const ScorecardMetric = ({ label, value, goal, status, palette }: any) => (
  <div className="space-y-1">
    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
    <div className="flex items-baseline gap-2">
      <span className="text-xl font-black tracking-tighter" style={{ color: status === 'surpass' ? palette.tealBright : palette.warning }}>{value}</span>
       <span className="text-[9px] font-bold text-slate-400 uppercase">Goal: {goal}</span>
    </div>
  </div>
);

export default DashboardView;
