
import React, { useState } from 'react';
import { BirthPlan, PatientCase } from '../types';
import { Baby, Heart, Sparkles, Home, Music, Volume2, ShieldCheck, PenSquare, Save, History } from 'lucide-react';

interface BirthPlanViewProps {
  patientCase: PatientCase;
  onUpdate: (plan: BirthPlan) => void;
}

const BirthPlanView: React.FC<BirthPlanViewProps> = ({ patientCase, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [plan, setPlan] = useState<BirthPlan>(patientCase.birthPlan || {
    painManagement: 'Epidural as requested',
    birthEnvironment: ['Low lighting', 'Music playlist', 'Personal belongings'],
    laborSupport: ['Partner present', 'Doula support'],
    postpartumPreferences: ['Skin-to-skin immediately', 'Delayed cord clamping'],
    feedingChoice: 'Breastfeeding',
    lastUpdated: 'Never'
  });

  const handleSave = () => {
    onUpdate({ ...plan, lastUpdated: new Date().toLocaleDateString() });
    setIsEditing(false);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50/30">
      <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center">
        <div className="flex items-center gap-3">
           <div className="bg-pink-100 p-2 rounded-xl">
              <Baby className="w-5 h-5 text-teal-700" />
           </div>
           <div>
              <h3 className="text-lg font-bold text-slate-800">Personalized Birth Plan</h3>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <History className="w-3 h-3" /> Last updated: {plan.lastUpdated}
              </p>
           </div>
        </div>
        <button 
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all
            ${isEditing ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
        >
          {isEditing ? <><Save className="w-4 h-4" /> Save Plan</> : <><PenSquare className="w-4 h-4" /> Edit Preferences</>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Pain Management Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
             <div className="flex items-center gap-2 text-teal-600 font-bold text-sm">
                <ShieldCheck className="w-4 h-4" /> Pain Management
             </div>
             {isEditing ? (
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-1 focus:ring-teal-500 outline-none"
                  value={plan.painManagement}
                  onChange={(e) => setPlan({...plan, painManagement: e.target.value})}
                  rows={3}
                />
             ) : (
                <p className="text-sm text-slate-700 leading-relaxed italic border-l-2 border-teal-100 pl-3">
                  "{plan.painManagement}"
                </p>
             )}
          </div>

          {/* Environment Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
             <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                <Music className="w-4 h-4" /> Birth Environment
             </div>
             <div className="flex flex-wrap gap-2">
                {plan.birthEnvironment.map((item, i) => (
                  <span key={i} className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-100">
                    {item}
                  </span>
                ))}
                {isEditing && (
                   <button className="px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold border border-slate-200 border-dashed">
                      + Add Preference
                   </button>
                )}
             </div>
          </div>

          {/* Labor Support Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
             <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <Heart className="w-4 h-4" /> Labor Support
             </div>
             <ul className="space-y-2">
                {plan.laborSupport.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-300"></div>
                    {item}
                  </li>
                ))}
             </ul>
          </div>

          {/* Postpartum Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
             <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
                <Sparkles className="w-4 h-4" /> Postpartum Goals
             </div>
             <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                   <span>Feeding Choice:</span>
                   <span className="text-slate-800 font-bold">{plan.feedingChoice}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                   {plan.postpartumPreferences.map((pref, i) => (
                     <div key={i} className="text-xs bg-amber-50/50 p-2 rounded-lg border border-amber-100 text-amber-900 leading-tight">
                        {pref}
                     </div>
                   ))}
                </div>
             </div>
          </div>

        </div>

        {/* Action Message */}
        <div className="bg-white rounded-2xl p-6 text-slate-800 shadow-lg relative overflow-hidden">
           <div className="relative z-10">
              <h4 className="font-bold flex items-center gap-2 mb-2">
                 <ShieldCheck className="w-4 h-4 text-teal-300" />
                 Shared Clinical Context
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                 This birth plan is automatically shared with the attending OB/GYN, Nursing Team, and assigned Doula. 
                 AI Intelligence will cross-reference clinical protocols with these preferences to minimize trauma and maximize member satisfaction.
              </p>
           </div>
           <Baby className="absolute -right-4 -bottom-4 w-32 h-32 text-white/5 rotate-12" />
        </div>
      </div>
    </div>
  );
};

export default BirthPlanView;
