
import React, { useMemo, useState } from 'react';
import { MapPin, Thermometer, Wind, AlertCircle, ShoppingBasket, Bus, Zap, ShieldAlert, Users, HeartHandshake, Stethoscope, Building2, X, TrendingUp, Activity } from 'lucide-react';
import { useData } from '../DataContext';
import ClusterMap from './ClusterMap';
import { Suspense } from 'react';

interface EnvironmentalRiskMapProps {
  overlay?: 'clinical' | 'environmental' | 'resource' | null;
  viewMode?: 'canvas' | 'map';
}

interface ClusterData {
  id: number;
  zip: string;
  risk: 'Critical' | 'High' | 'Moderate';
  stressors: string[];
  members: number;
  top: string;
  left: string;
  hasTransport?: boolean;
  hasFood?: boolean;
  hasMidwife?: boolean;
  hasDoula?: boolean;
  type: 'clinical' | 'environmental' | 'resource';
  clinicalData?: {
    hypertension: number;
    diabetes: number;
    avgRiskScore: number;
    interventionSuccess: number;
    chronicDiseasePrevalence: number;
    mentalHealthCases: number;
    preventiveCareAccess: number;
  };
  environmentalData?: {
    aqi: number;
    heatIndex: number;
    humidity: number;
    pollutionLevel: string;
    respiratoryCases: number;
    heatRelatedIncidents: number;
    interventions: string[];
  };
  resourceData?: {
    foodAccess: string;
    transportAccess: string;
    healthcareFacilities: number;
    communityCenters: number;
    emergencyServices: string;
    pharmacyAccess: string;
    socialServices: string;
  };
}

const EnvironmentalRiskMap: React.FC<EnvironmentalRiskMapProps> = ({ overlay, viewMode = 'canvas' }) => {
  const [selectedCluster, setSelectedCluster] = useState<ClusterData | null>(null);
  const { items } = useData();

  const positions = [
    { top: '50%', left: '40%' },
    { top: '30%', left: '70%' },
    { top: '65%', left: '25%' },
    { top: '20%', left: '60%' },
    { top: '75%', left: '80%' },
    { top: '45%', left: '15%' },
    { top: '35%', left: '48%' },
    { top: '62%', left: '62%' },
  ];

  const allClusters = useMemo<ClusterData[]>(() => {
    const byZip = new Map<string, typeof items>();

    items.forEach((item) => {
      const zip = item.caseData?.environmental?.zipCode || 'Unknown';
      if (!byZip.has(zip)) byZip.set(zip, []);
      byZip.get(zip)!.push(item);
    });

    return Array.from(byZip.entries()).slice(0, 8).map(([zip, zipItems], idx) => {
      const members = zipItems.length;
      const critical = zipItems.filter(i => i.status === 'Critical').length;
      const reviewing = zipItems.filter(i => i.status === 'Reviewing').length;

      const aqiValues = zipItems
        .map(i => Number(i.caseData?.environmental?.airQuality))
        .filter(n => Number.isFinite(n));
      const heatValues = zipItems
        .map(i => Number(i.caseData?.environmental?.heatIndex))
        .filter(n => Number.isFinite(n));

      const avgAqi = aqiValues.length ? Math.round(aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length) : 0;
      const avgHeat = heatValues.length ? Math.round(heatValues.reduce((a, b) => a + b, 0) / heatValues.length) : 0;

      const foodDesertCount = zipItems.filter(i => i.caseData?.environmental?.foodDesertStatus).length;
      const transportGapCount = zipItems.filter(i => i.caseData?.environmental?.transportationDesertStatus).length;

      const hasMidwife = zipItems.some(i => i.caseData?.communityAccess?.midwifeAvailable);
      const hasDoula = zipItems.some(i => i.caseData?.communityAccess?.doulaAvailable);
      const hasTransport = transportGapCount === 0;
      const hasFood = foodDesertCount === 0;

      const stressors: string[] = [];
      if (zipItems.some(i => i.caseData?.environmental?.maternityCareDesert)) stressors.push('Maternity Desert');
      if (avgHeat > 100) stressors.push('Heat Island');
      if (avgAqi > 100) stressors.push('Air Quality Alert');
      if (!hasTransport) stressors.push('Transport Desert');
      if (!hasFood) stressors.push('Food Desert');
      if (!hasDoula) stressors.push('No Doula Coverage');
      if (!hasMidwife) stressors.push('No Midwife Coverage');

      const type: ClusterData['type'] = avgAqi > 100 || avgHeat > 100
        ? 'environmental'
        : (!hasFood || !hasTransport)
          ? 'resource'
          : 'clinical';

      const risk: ClusterData['risk'] = critical >= 4
        ? 'Critical'
        : (critical >= 2 || reviewing >= 2)
          ? 'High'
          : 'Moderate';

      return {
        id: idx + 1,
        zip,
        risk,
        stressors: stressors.length ? stressors : ['Stable Conditions'],
        members,
        top: positions[idx % positions.length].top,
        left: positions[idx % positions.length].left,
        hasTransport,
        hasFood,
        hasMidwife,
        hasDoula,
        type,
        clinicalData: {
          hypertension: zipItems.filter(i => i.caseData?.environmental?.isHeatIsland).length,
          diabetes: zipItems.filter(i => i.caseData?.environmental?.foodDesertStatus).length,
          avgRiskScore: members ? Math.round(zipItems.reduce((s, i) => s + (i.riskRank || 0), 0) / members) : 0,
          interventionSuccess: members ? Math.max(0, 100 - Math.round((critical / members) * 100)) : 0,
          chronicDiseasePrevalence: members ? Math.round((zipItems.filter(i => i.caseData?.environmental?.foodDesertStatus || i.caseData?.environmental?.isHeatIsland).length / members) * 100) : 0,
          mentalHealthCases: reviewing,
          preventiveCareAccess: members ? Math.round((zipItems.filter(i => i.ppcPre).length / members) * 100) : 0,
        },
        environmentalData: {
          aqi: avgAqi,
          heatIndex: avgHeat,
          humidity: Math.min(95, 45 + Math.round(avgHeat * 0.2)),
          pollutionLevel: avgAqi > 150 ? 'High' : avgAqi > 100 ? 'Moderate' : 'Low',
          respiratoryCases: zipItems.filter(i => (i.nicuProbability || 0) >= 60).length,
          heatRelatedIncidents: zipItems.filter(i => (i.caseData?.environmental?.heatIndex || 0) > 100).length,
          interventions: stressors.filter(s => s !== 'Stable Conditions'),
        },
        resourceData: {
          foodAccess: hasFood ? 'Good' : 'Limited',
          transportAccess: hasTransport ? 'Good' : 'Limited',
          healthcareFacilities: Math.max(1, Math.round(members / 4)),
          communityCenters: Math.max(1, Math.round(members / 6)),
          emergencyServices: hasTransport ? '12' : '25',
          pharmacyAccess: hasFood ? '2.5' : '6.0',
          socialServices: hasDoula || hasMidwife ? 'Available' : 'Limited',
        },
      };
    });
  }, [items]);

  // Filter clusters based on overlay
  const clusters = overlay ? allClusters.filter(c => c.type === overlay) : allClusters;

  const renderClusterDetails = (cluster: any) => {
    switch (cluster.type) {
      case 'clinical':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-teal-500" />
              <h3 className="text-lg font-semibold">Clinical Risk Cluster</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-teal-50 p-3 rounded-lg">
                <div className="text-sm text-teal-600 font-medium">Hypertension Cases</div>
                <div className="text-2xl font-bold text-teal-800">{cluster.clinicalData?.hypertension || 0}</div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="text-sm text-red-600 font-medium">Diabetes Cases</div>
                <div className="text-2xl font-bold text-red-800">{cluster.clinicalData?.diabetes || 0}</div>
              </div>
              <div className="bg-teal-50 p-3 rounded-lg">
                <div className="text-sm text-teal-700 font-medium">Average Risk Score</div>
                <div className="text-2xl font-bold text-teal-800">{cluster.clinicalData?.avgRiskScore || 0}%</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-sm text-green-600 font-medium">Intervention Success</div>
                <div className="text-2xl font-bold text-green-800">{cluster.clinicalData?.interventionSuccess || 0}%</div>
              </div>
            </div>
            <div className="mt-4">
              <h4 className="font-medium mb-2">Key Health Indicators</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Chronic Disease Prevalence</span>
                  <span className="font-medium">{cluster.clinicalData?.chronicDiseasePrevalence || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Mental Health Cases</span>
                  <span className="font-medium">{cluster.clinicalData?.mentalHealthCases || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Preventive Care Access</span>
                  <span className="font-medium">{cluster.clinicalData?.preventiveCareAccess || 0}%</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 'environmental':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Wind className="w-5 h-5 text-green-500" />
              <h3 className="text-lg font-semibold">Environmental Stressor Cluster</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-orange-50 p-3 rounded-lg">
                <div className="text-sm text-orange-600 font-medium">Air Quality Index</div>
                <div className="text-2xl font-bold text-orange-800">{cluster.environmentalData?.aqi || 0}</div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="text-sm text-red-600 font-medium">Heat Index</div>
                <div className="text-2xl font-bold text-red-800">{cluster.environmentalData?.heatIndex || 0}°F</div>
              </div>
              <div className="bg-teal-50 p-3 rounded-lg">
                <div className="text-sm text-teal-600 font-medium">Humidity</div>
                <div className="text-2xl font-bold text-teal-800">{cluster.environmentalData?.humidity || 0}%</div>
              </div>
              <div className="bg-teal-50 p-3 rounded-lg">
                <div className="text-sm text-teal-700 font-medium">Pollution Level</div>
                <div className="text-2xl font-bold text-teal-800">{cluster.environmentalData?.pollutionLevel || 'Low'}</div>
              </div>
            </div>
            <div className="mt-4">
              <h4 className="font-medium mb-2">Environmental Impact</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Respiratory Cases</span>
                  <span className="font-medium">{cluster.environmentalData?.respiratoryCases || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Heat-Related Incidents</span>
                  <span className="font-medium">{cluster.environmentalData?.heatRelatedIncidents || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Interventions</span>
                  <span className="font-medium">{cluster.environmentalData?.interventions?.length || 0}</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 'resource':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-teal-500" />
              <h3 className="text-lg font-semibold">Resource Gap Cluster</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="text-sm text-red-600 font-medium">Food Access Score</div>
                <div className="text-2xl font-bold text-red-800">{cluster.resourceData?.foodAccess || 'N/A'}/10</div>
              </div>
              <div className="bg-teal-50 p-3 rounded-lg">
                <div className="text-sm text-teal-600 font-medium">Transportation Access</div>
                <div className="text-2xl font-bold text-teal-800">{cluster.resourceData?.transportAccess || 'N/A'}</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-sm text-green-600 font-medium">Healthcare Facilities</div>
                <div className="text-2xl font-bold text-green-800">{cluster.resourceData?.healthcareFacilities || 0}</div>
              </div>
              <div className="bg-teal-50 p-3 rounded-lg">
                <div className="text-sm text-teal-700 font-medium">Community Centers</div>
                <div className="text-2xl font-bold text-teal-800">{cluster.resourceData?.communityCenters || 0}</div>
              </div>
            </div>
            <div className="mt-4">
              <h4 className="font-medium mb-2">Resource Availability</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Emergency Services</span>
                  <span className="font-medium">{cluster.resourceData?.emergencyServices || 'N/A'} min response</span>
                </div>
                <div className="flex justify-between">
                  <span>Pharmacy Access</span>
                  <span className="font-medium">{cluster.resourceData?.pharmacyAccess || 'N/A'} miles</span>
                </div>
                <div className="flex justify-between">
                  <span>Social Services</span>
                  <span className="font-medium">{cluster.resourceData?.socialServices || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-slate-50 rounded-3xl border border-slate-200 h-full w-full relative overflow-hidden shadow-xl">
      {/* Map View */}
      {viewMode === 'map' && (
        <Suspense fallback={<div className="w-full h-full flex items-center justify-center bg-slate-100">Loading map...</div>}>
          <ClusterMap clusters={clusters} overlay={overlay} />
        </Suspense>
      )}

      {/* Canvas View */}
      {viewMode === 'canvas' && (
      <div className="w-full h-full">
      {/* Map Header Overlay */}
      <div className="absolute top-6 right-6 z-20 flex flex-col gap-3">
        <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-rose-500/20 p-2 rounded-xl">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Live GIS Overlay</div>
              <h3 className="text-sm font-black text-slate-800 leading-none">Maternal Health Risk Zones</h3>
            </div>
          </div>
          <div className="flex items-center gap-4 border-t border-slate-200 pt-3">
            <div className="flex items-center gap-1.5">
              <Users className="w-3 h-3 text-teal-400" />
              <span className="text-[9px] font-bold text-slate-600">Care Coverage</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-rose-500"></div>
              <span className="text-[9px] font-bold text-slate-600">Maternity Deserts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Pattern Background */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
      
      {/* Map Content (Simulated Topography) */}
      <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" preserveAspectRatio="none">
        <path d="M0 100 Q 150 150 300 80 T 600 120 T 900 60 V 450 H 0 Z" fill="#d8ece8" />
        <path d="M0 200 Q 200 280 400 200 T 800 300 T 1200 220 V 450 H 0 Z" fill="#eaf4f1" />
      </svg>

      {/* Cluster Points */}
      {clusters.map(c => (
        <div 
          key={c.id} 
          className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-10"
          style={{ top: c.top, left: c.left }}
          onClick={() => setSelectedCluster(c)}
        >
          {/* Pulsing ring layers */}
          <div className={`absolute -inset-8 rounded-full animate-ping opacity-10 ${c.risk === 'Critical' ? 'bg-rose-500' : 'bg-amber-500'}`}></div>
          <div className={`absolute -inset-4 rounded-full animate-pulse opacity-20 ${c.risk === 'Critical' ? 'bg-rose-500' : 'bg-amber-500'}`}></div>
          
          <div className={`relative w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xl border-2 border-white/20 transition-all duration-300 group-hover:scale-125 group-hover:rotate-6
            ${c.type === 'clinical' ? 'bg-rose-600' : c.type === 'environmental' ? 'bg-emerald-600' : 'bg-amber-600'}`}>
            {c.type === 'clinical' ? <Stethoscope className="w-5 h-5 text-white" /> : c.type === 'environmental' ? <Wind className="w-5 h-5 text-white" /> : <Building2 className="w-5 h-5 text-white" />}
            
            {/* Context Icons attached to the point */}
            {c.hasMidwife && (
              <div className="absolute -top-4 -right-4 bg-teal-500 p-1.5 rounded-lg border border-white/20 shadow-xl">
                <Users className="w-3 h-3 text-white" />
              </div>
            )}
            {c.hasDoula && (
              <div className="absolute -bottom-4 -right-4 bg-teal-500 p-1.5 rounded-lg border border-white/20 shadow-xl">
                <HeartHandshake className="w-3 h-3 text-white" />
              </div>
            )}
          </div>

          {/* Enhanced Map Tooltip */}
          <div className="absolute left-14 top-0 w-64 bg-white/95 backdrop-blur-lg border border-slate-200 p-4 rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.15)] opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none z-30">
             <div className="flex justify-between items-start mb-3">
               <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Stratification Layer</div>
                  <h4 className="text-lg font-black text-slate-800 leading-none tracking-tight">Zip {c.zip}</h4>
               </div>
               <div className={`text-[10px] font-black px-2 py-1 rounded-lg ${c.risk === 'Critical' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                 {c.risk} RISK
               </div>
             </div>
             
             <div className="bg-slate-100 rounded-xl p-2.5 mb-3 border border-slate-200">
               <div className="text-sm font-black text-slate-800">{c.members} Members Impacted</div>
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Correlated SDOH stressors active</div>
             </div>
             
             <div className="space-y-2">
               {c.stressors.map((s, i) => (
                 <div key={i} className="flex items-center justify-between text-[10px] font-medium p-1 rounded-lg hover:bg-slate-100 transition-colors">
                   <div className="flex items-center gap-2 text-slate-700">
                     {s.includes('Maternity Desert') && <MapPin className="w-3.5 h-3.5 text-rose-400" />}
                     {s.includes('Heat') && <Thermometer className="w-3.5 h-3.5 text-rose-400" />}
                     {s.includes('Transport') && <Bus className="w-3.5 h-3.5 text-teal-400" />}
                     {s.includes('CHW') && <Users className="w-3.5 h-3.5 text-teal-400" />}
                     {s.includes('Doula') && <HeartHandshake className="w-3.5 h-3.5 text-teal-500" />}
                     <span>{s}</span>
                   </div>
                   <div className="text-teal-400 font-black">MAPPED</div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      ))}

      {/* Cluster Details Overlay */}
      {selectedCluster && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Zip {selectedCluster.zip}</h2>
                <p className="text-sm text-slate-600">{selectedCluster.members} Members Impacted</p>
              </div>
              <button
                onClick={() => setSelectedCluster(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            {renderClusterDetails(selectedCluster)}
            <div className="mt-6 flex gap-2">
              <button className="flex-1 bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors">
                View Full Report
              </button>
              <button className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors">
                Schedule Intervention
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Map Controls/Legend Overlay */}
      <div className="absolute bottom-6 right-6 flex flex-col items-end gap-2">
        <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-xl flex flex-col gap-2 min-w-[200px]">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">GIS Interaction Layers</div>
          <div className="flex items-center gap-3 justify-around pt-1">
            <div className="flex flex-col items-center gap-1 group">
              <Stethoscope className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
              <span className="text-[8px] font-black text-slate-500 uppercase">Clinical</span>
            </div>
            <div className="flex flex-col items-center gap-1 group">
              <Wind className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="text-[8px] font-black text-slate-500 uppercase">Env</span>
            </div>
            <div className="flex flex-col items-center gap-1 group">
              <Building2 className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="text-[8px] font-black text-slate-500 uppercase">Resource</span>
            </div>
          </div>
        </div>
      </div>
      </div>
      )}
    </div>
  );
};

export default EnvironmentalRiskMap;
