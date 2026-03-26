
import React from 'react';
import { AnalysisResult, LabResult } from '../types';
import { 
  AlertTriangle, 
  Activity, 
  TrendingUp,
  TrendingDown,
  Minus,
  TestTube,
  MapPin,
  Banknote,
  ShieldCheck,
  BrainCircuit,
  Users,
  Smile,
  Frown,
  Gauge,
  Sparkles,
  Zap,
  Building2,
  UsersRound,
  Wind
} from 'lucide-react';
import CognitiveGraph from './CognitiveGraph';
import EnvironmentalTrendChart from './EnvironmentalTrendChart';
import SDOHTrendChart from './SDOHTrendChart';

interface LabCardProps {
  lab: LabResult;
}

const LabCard: React.FC<LabCardProps> = ({ lab }) => {
  const isAbnormal = lab.flag !== 'normal';
  return (
    <div className={`flex flex-col p-3 rounded-xl border ${isAbnormal ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-80'}`}>
      <div className="flex justify-between items-start mb-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{lab.name}</span>
          {lab.trend === 'up' && <TrendingUp className={`w-3 h-3 ${isAbnormal ? 'text-rose-400' : 'text-slate-400'}`} />}
          {lab.trend === 'down' && <TrendingDown className={`w-3 h-3 ${isAbnormal ? 'text-rose-400' : 'text-slate-400'}`} />}
          {lab.trend === 'stable' && <Minus className="w-3 h-3 text-slate-300" />}
      </div>
      <div className="flex items-baseline gap-1">
          <span className={`text-lg font-bold ${lab.flag === 'critical' ? 'text-rose-400' : lab.flag === 'high' || lab.flag === 'low' ? 'text-amber-600' : 'text-slate-700'}`}>
              {lab.value}
          </span>
          <span className="text-[10px] text-slate-400">{lab.unit}</span>
      </div>
    </div>
  );
};

interface AnalysisResultsProps {
  result: AnalysisResult;
}

const AnalysisResults: React.FC<AnalysisResultsProps> = ({ result }) => {
   const safetyChecklist = Array.isArray(result?.safetyChecklist) ? result.safetyChecklist : [];
   const prescriptiveIntelligence = Array.isArray(result?.prescriptiveIntelligence) ? result.prescriptiveIntelligence : [];
   const keyLabs = Array.isArray(result?.keyLabs) ? result.keyLabs : [];
   const htnStatus = safetyChecklist.find(c => c.category === 'Hypertension');
  const isCritical = htnStatus?.status === 'Critical';

  // Total projected avoidance
   const totalAvoidance = prescriptiveIntelligence.reduce((acc, curr) => acc + (curr.potentialSavings || 0), 0);

  return (
    <div className="h-full overflow-y-auto pb-20 space-y-6">
      
      {/* HEADER: DIAGNOSTIC SIGNAL (Pillar A) */}
      <div className={`rounded-2xl p-6 text-white shadow-lg relative overflow-hidden transition-all
        ${isCritical ? 'bg-gradient-to-br from-rose-600 to-rose-800' : 'bg-gradient-to-br from-teal-600 to-teal-800'}`}>
         
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="max-w-xl">
                <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-5 h-5 text-white/80" />
                    <span className="text-xs font-bold uppercase tracking-widest text-white/60">Pillar A: 72-Hour Rising Risk Prediction</span>
                </div>
                <h2 className="text-2xl font-bold leading-tight">
                    {htnStatus?.finding || "Predictive Stream Active"}
                </h2>
                <div className="mt-2 flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-white bg-white/10 px-3 py-1 rounded-full border border-white/20">
                        <Banknote className="w-4 h-4" />
                        NICU Avoidance Potential: ${totalAvoidance.toLocaleString()}
                    </div>
                </div>
            </div>
            
            <div className={`px-4 py-3 rounded-xl backdrop-blur-md border border-white/20 shadow-xl text-center
                ${isCritical ? 'bg-rose-900/30' : 'bg-teal-900/30'}`}>
                <div className="text-[10px] font-bold uppercase text-white/60 mb-1">Risk Confidence</div>
                <div className="text-xl font-bold">{result.riskScore.value}%</div>
            </div>
         </div>
         <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
              
              {/* C-SECTION PROBABILITY TRACKER (Pillar A) */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row gap-8">
                 <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-2">
                       <Gauge className="w-5 h-5 text-teal-500" />
                       <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Pillar A: C-Section Risk Gauge</h3>
                    </div>
                    <div className="relative pt-4">
                       <div className="flex mb-2 items-center justify-between">
                          <div>
                             <span className="text-[10px] font-black inline-block py-1 px-2 uppercase rounded-full text-teal-700 bg-teal-50 border border-teal-100">
                               LRCD-AD/CH Tracker
                             </span>
                          </div>
                          <div className="text-right">
                             <span className="text-xl font-black text-teal-700">
                               {result.tmahMetrics?.cSectionProbability || 0}%
                             </span>
                          </div>
                       </div>
                       <div className="overflow-hidden h-3 mb-4 text-xs flex rounded-full bg-slate-100">
                          <div 
                             style={{ width: `${result.tmahMetrics?.cSectionProbability || 0}%` }} 
                             className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-teal-500 transition-all duration-1000"
                          ></div>
                       </div>
                       <p className="text-[10px] text-slate-500 font-bold italic">
                          Targeting avoidable NTSV C-sections. Steering recommended to "Birthing-Friendly" certified facility.
                       </p>
                    </div>
                 </div>

                 <div className="w-px bg-slate-100 hidden md:block"></div>

                 {/* PILLAR B: AI SENTIMENT/MOOD ANALYSIS */}
                 <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-2">
                       <Sparkles className="w-5 h-5 text-teal-600" />
                       <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Pillar B: MMH Screening</h3>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-around">
                       <div className="flex flex-col items-center">
                          {result.tmahMetrics?.sentimentScore > 50 ? (
                             <Smile className="w-10 h-10 text-emerald-500 mb-1" />
                          ) : (
                             <Frown className="w-10 h-10 text-rose-400 mb-1" />
                          )}
                          <span className="text-[10px] font-black text-slate-400 uppercase">Sentiment Score</span>
                       </div>
                       <div className="text-center">
                          <div className="text-3xl font-black text-slate-900">{result.tmahMetrics?.sentimentScore || 0}%</div>
                          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">PND-E / PDS-E Alert</div>
                       </div>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold">
                       Derived from Nyota Audio Journals. Tonal shifts trigger formal HEDIS alerts.
                    </p>
                 </div>
              </div>

              {/* Cognitive Load Map */}
              <div className="h-64">
                  <CognitiveGraph 
                    facts={result.cognitiveContext.riskFactors || []} 
                    environmentalHistory={result.environmentalHistory || []}
                  />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-64">
                   <EnvironmentalTrendChart history={result.environmentalHistory || []} />
                </div>
                <div className="h-64">
                   <SDOHTrendChart history={result.historicalSDoH || []} />
                </div>
              </div>

              {/* Prescriptive Intelligence Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center">
                      <h3 className="font-bold text-emerald-900 text-sm flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        NICU Avoidance Calculator Integration
                      </h3>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase">Section 3: VBP Analytics</span>
                  </div>
                  <div className="p-4 space-y-4">
                       {prescriptiveIntelligence.map((pi, idx) => (
                          <div key={idx} className="flex gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                              <div className="bg-white p-2 rounded-lg shadow-sm self-start">
                                 <Banknote className="w-5 h-5 text-emerald-600" />
                              </div>
                              <div className="flex-1">
                                 <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-bold text-slate-800 text-sm">{pi.action}</h4>
                                    <div className="text-right">
                                       <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Avoidance Value</div>
                                       <div className="text-sm font-bold text-emerald-600">${pi.potentialSavings.toLocaleString()}</div>
                                    </div>
                                 </div>
                                 <p className="text-xs text-slate-600 leading-relaxed">{pi.rationale}</p>
                                 <div className="mt-2 text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full inline-block">
                                    Pillar Integration: {pi.interventionType}
                                 </div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>

          <div className="space-y-6">
              {/* Advocate Workflow Sync (Pillar C) */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-4">
                      <UsersRound className="w-4 h-4 text-teal-600" />
                      <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider">Pillar C: Workflow Sync</h3>
                  </div>
                  <div className="space-y-3">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                         <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-black text-teal-600 uppercase">CHW Field Vitals</span>
                            <span className="text-[8px] text-slate-400">14m ago</span>
                         </div>
                         <div className="text-xs font-bold text-slate-700">BP 142/90 (Field Measured)</div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                         <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-black text-teal-600 uppercase">Doula Visit Note</span>
                            <span className="text-[8px] text-slate-400">1h ago</span>
                         </div>
                         <p className="text-[10px] text-slate-600 italic">"Member reporting increased anxiety. Validated birth plan for trauma-informed care."</p>
                      </div>
                  </div>
              </div>

              {/* Resource Strain Index (Pillar B) */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-4">
                      <MapPin className="w-4 h-4 text-emerald-500" />
                      <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider">Resource Strain Index</h3>
                  </div>
                  <div className="flex flex-col items-center p-4 bg-slate-50 rounded-2xl">
                     <div className="text-4xl font-black text-slate-900 mb-1">{result.tmahMetrics?.resourceStrainIndex || 0}/10</div>
                     <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4 text-center">HEDIS PPC Compliance Stress</div>
                      <button className="w-full py-2 bg-teal-700 text-white text-[10px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-teal-700/20">
                        Dispatch CHW Transport
                     </button>
                  </div>
              </div>

              {/* Admin Burden Counter (Pillar C) */}
              <div className="bg-white rounded-2xl shadow-sm p-5 text-slate-800 relative overflow-hidden">
                  <div className="relative z-10 flex flex-col items-center text-center">
                     <div className="text-3xl font-black text-teal-400 tracking-tighter">+{result.tmahMetrics?.adminBurdenSaved || 0}h</div>
                     <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Hours Saved / Case</div>
                     <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-300 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                        <Zap className="w-3.5 h-3.5 text-teal-400" />
                        FHIR Interoperability Ready
                     </div>
                  </div>
              </div>

              {/* Lab Indicators */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-4">
                      <TestTube className="w-4 h-4 text-teal-500" />
                      <h3 className="font-bold text-slate-800 text-sm">Key Lab Indicators</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                       {keyLabs.map((lab, idx) => <LabCard key={idx} lab={lab} />)}
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default AnalysisResults;
