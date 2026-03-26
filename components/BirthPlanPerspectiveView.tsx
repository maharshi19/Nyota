
import React from 'react';
import { BoardItem } from '../types';
import BirthPlanView from './BirthPlanView';
import { 
  Baby, 
  Sparkles, 
  Activity, 
  Heart, 
  Zap, 
  BarChart3, 
  MessageCircle,
  ShieldCheck,
  TrendingUp,
  Brain
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';

interface BirthPlanPerspectiveViewProps {
  selectedMember: BoardItem | null;
}

const BirthPlanPerspectiveView: React.FC<BirthPlanPerspectiveViewProps> = ({ selectedMember }) => {
  // Collective Perspective Data
  const preferenceTrends = [
    { name: 'Unmedicated Labor', value: 34, color: '#ec4899' },
    { name: 'Trauma-Informed Focus', value: 58, color: '#3a8c81' },
    { name: 'Breastfeeding Exclusive', value: 72, color: '#10b981' },
    { name: 'Doula Support Requested', value: 45, color: '#f59e0b' },
  ];

  const SatisfactionData = [
    { label: 'Standard Plan', score: 62 },
    { label: 'Personalized Nyota Plan', score: 88 },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8 space-y-8 custom-scrollbar">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-extrabold text-teal-700 uppercase tracking-[0.2em]">
            <Baby className="w-3.5 h-3.5" />
            Trauma-Informed Preference Intelligence
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            {selectedMember ? `Member Birth Plan: ${selectedMember.name}` : "Collective Birth Perspectives"}
          </h2>
          <p className="text-sm text-slate-500 max-w-2xl font-medium leading-relaxed">
            {selectedMember 
              ? `Personalized birthing preferences for MRN ${selectedMember.mrn}. Integrating member voice into the clinical protocol stream to reduce obstetric violence and improve satisfaction.`
              : "Analyzing aggregate member preferences across the MCO. Identifying shifts in trauma-informed care requests and cultural birthing priorities to optimize network responsiveness."}
          </p>
        </div>
      </div>

      {selectedMember ? (
        // INDIVIDUAL PERSPECTIVE
        <div className="pb-20">
           <BirthPlanView 
             patientCase={selectedMember.caseData} 
             onUpdate={() => {}} // In a real app, this would update the state
           />
        </div>
      ) : (
        // COLLECTIVE PERSPECTIVE
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
           <div className="xl:col-span-8 space-y-8">
              {/* PREFERENCE TRENDS */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                 <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">Population Preference Trends</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Frequency of Specific Care Requests</p>
                    </div>
                    <div className="bg-teal-50 p-2 rounded-xl text-teal-700"><TrendingUp className="w-5 h-5" /></div>
                 </div>
                 
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={preferenceTrends} layout="vertical" margin={{ left: 40, right: 40 }}>
                          <XAxis type="number" hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}}
                            width={140}
                          />
                          <Tooltip cursor={{fill: '#f8fafc'}} />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                             {preferenceTrends.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={entry.color} />
                             ))}
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              {/* VOICE OF THE MEMBER INSIGHTS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[300px]">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Patient Satisfaction Delta</h4>
                    <div className="flex-1 flex flex-col justify-around">
                       {SatisfactionData.map((d, i) => (
                         <div key={i} className="space-y-2">
                           <div className="flex justify-between text-[11px] font-bold">
                             <span className="text-slate-600">{d.label}</span>
                             <span className="text-slate-900">{d.score}%</span>
                           </div>
                           <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                             <div 
                                className={`h-full transition-all duration-1000 ${i === 1 ? 'bg-teal-500 shadow-lg shadow-pink-500/30' : 'bg-slate-300'}`}
                                style={{ width: `${d.score}%` }}
                             ></div>
                           </div>
                         </div>
                       ))}
                    </div>
                    <p className="mt-4 text-[10px] text-slate-400 font-medium italic">
                      *Personalized plans show a 26% higher NPS in postpartum reviews.
                    </p>
                 </div>

                  <div className="bg-teal-50 text-slate-800 p-6 rounded-3xl shadow-xl flex flex-col relative overflow-hidden">
                    <div className="relative z-10">
                      <h4 className="text-[10px] font-black text-teal-300 uppercase tracking-widest mb-4">MCO Actionable Bias Insight</h4>
                      <div className="flex items-center gap-3 mb-4">
                        <Brain className="w-8 h-8 text-teal-400" />
                        <div className="text-sm font-black leading-tight">Implicit Bias Signal: Induction Choice</div>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed mb-6">
                          Our data shows that Black/AA members request "Spontaneous Labor" 2x more often than currently reflected in clinical care paths. This misalignment is a primary driver of lower satisfaction scores.
                       </p>
                       <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-[9px] font-black uppercase tracking-widest rounded-lg border border-white/10 transition-colors">
                          Deploy Trauma-Informed Protocol
                       </button>
                    </div>
                    <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
                 </div>
              </div>
           </div>

           <div className="xl:col-span-4 space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                 <div className="flex items-center gap-2 mb-4 text-teal-700">
                    <Sparkles className="w-4 h-4" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest">Member Voice Highlights</h4>
                 </div>
                 <div className="space-y-4">
                    <QuoteBox 
                      quote="I want to be heard when I say something doesn't feel right. No more being ignored." 
                      author="MCO Member Survey - Zip 38722" 
                    />
                    <QuoteBox 
                      quote="A doula who understands my culture made me feel safe in the hospital room." 
                      author="MCO Member Survey - Zip 38721" 
                    />
                 </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl">
                 <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <h4 className="text-xs font-black text-emerald-900 uppercase">Outcome Correlation</h4>
                 </div>
                 <div className="text-3xl font-black text-slate-900 mb-1">-$2,400</div>
                 <div className="text-[10px] text-emerald-700 font-bold uppercase mb-4">Avg Per-Member Savings</div>
                 <p className="text-[10px] text-slate-500 leading-relaxed">
                   Members with adhered birth plans have lower C-section rates (21% vs 34%) and shorter hospital stays, resulting in significant cost avoidance.
                 </p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const QuoteBox = ({ quote, author }: any) => (
  <div className="p-4 bg-slate-50 border-l-4 border-teal-300 rounded-r-xl italic relative">
     <MessageCircle className="absolute -top-1 -right-1 w-8 h-8 text-slate-200/50" />
     <p className="text-[11px] text-slate-700 leading-relaxed mb-2">"{quote}"</p>
     <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">— {author}</div>
  </div>
);

export default BirthPlanPerspectiveView;
