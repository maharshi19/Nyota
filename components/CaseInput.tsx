
import React, { useState, useEffect } from 'react';
import { PatientCase, AppStatus } from '../types';
import { Database, Search, Activity, FileText, FlaskConical, MapPin, History, Wind, Fingerprint, HeartHandshake, Users, ShieldCheck } from 'lucide-react';

interface CaseInputProps {
  onAnalyze: (data: PatientCase) => void;
  status: AppStatus;
  initialData?: PatientCase;
}

const CaseInput: React.FC<CaseInputProps> = ({ onAnalyze, status, initialData }) => {
  const [activeTab, setActiveTab] = useState<'Clinical' | 'Labs' | 'History'>('Clinical');
  
  const [formData, setFormData] = useState<PatientCase>({
    patientId: '',
    age: '',
    gestation: '',
    parity: '',
    chiefComplaint: '',
    vitals: '',
    environmentalVitalSign: '',
    narrative: '',
    labs: '',
    socialHistory: '',
    communityAccess: {
      midwifeAvailable: false,
      doulaAvailable: false,
      chwAssigned: false
    }
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (field: keyof NonNullable<PatientCase['communityAccess']>) => {
    setFormData(prev => ({
      ...prev,
      communityAccess: {
        ...(prev.communityAccess || { midwifeAvailable: false, doulaAvailable: false, chwAssigned: false }),
        [field]: !prev.communityAccess?.[field]
      }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAnalyze(formData);
  };

  const populateHypertensionDemo = () => {
    setActiveTab('Clinical');
    setFormData({
      patientId: 'MRN-89422',
      age: "34",
      gestation: "32w4d",
      parity: "G2P1001",
      chiefComplaint: "Severe headache (8/10), 'spots in vision', upper abdominal pain",
      vitals: "BP 168/112 | HR 92 | O2 96%",
      environmentalVitalSign: "Heat Island Alert (Index 108) | AQI 154 (Unhealthy) | Zip 48214 (Food Desert)",
      narrative: "Patient presents with acute onset severe frontal headache unresponsive to Tylenol. Reports 'shimmering' in peripheral vision. Right Upper Quadrant (RUQ) pain present. \n\nExam: +3 Pitting Edema in lower extremities. Hyperreflexia (3+) noted.",
      labs: "Platelets: 92,000 (Low)\nAST: 88 U/L (High)\nALT: 95 U/L (High)\nCreatinine: 1.1 mg/dL (Elevated)\nUrine Protein: 3+ Dipstick\nLDH: 600 IU/L",
      socialHistory: "Lives in food desert (Zip: 48214). Uses public transit (2 bus transfers to clinic). Missed last 2 prenatal appointments due to lack of transport. High stress job (Warehouse).",
      communityAccess: {
        midwifeAvailable: false,
        doulaAvailable: false,
        chwAssigned: true
      }
    });
  };

  return (
    <div className="bg-white h-full flex flex-col">
      {/* Simulation Toolbar */}
      <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
         <div className="flex items-center gap-2">
             <div className="bg-teal-100 p-1.5 rounded-lg text-teal-700">
                 <Database className="w-4 h-4" />
             </div>
             <div>
                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Connected Source</div>
                 <div className="text-xs font-bold text-slate-700">Epic EMR (Simulated)</div>
             </div>
         </div>
         <div className="flex gap-2">
            <button 
                type="button"
                onClick={populateHypertensionDemo}
                className="px-3 py-1.5 bg-teal-50 text-teal-700 text-xs font-bold rounded-md border border-teal-100 hover:bg-teal-100 flex items-center gap-2"
            >
                <Activity className="w-3 h-3" /> Load HTN Crisis
            </button>
         </div>
      </div>

      {/* Input Tabs */}
      <div className="flex border-b border-slate-200 px-6 pt-4 gap-6">
        <button
            type="button"
            onClick={() => setActiveTab('Clinical')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 
              ${activeTab === 'Clinical' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
            <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" /> Assessment
            </div>
        </button>
        <button
            type="button"
            onClick={() => setActiveTab('Labs')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 
              ${activeTab === 'Labs' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
             <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4" /> Labs & Trends
            </div>
        </button>
        <button
            type="button"
            onClick={() => setActiveTab('History')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 
              ${activeTab === 'History' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
             <div className="flex items-center gap-2">
                <History className="w-4 h-4" /> History & Community
            </div>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 pb-20 pt-6 space-y-5 custom-scrollbar">
        
        {activeTab === 'Clinical' && (
            <div className="space-y-4 animate-fadeIn">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4">
                    <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 uppercase mb-1">
                        <Fingerprint className="w-3 h-3 text-teal-500" /> Patient MRN
                    </label>
                    <input 
                        type="text" 
                        name="patientId" 
                        value={formData.patientId || ''} 
                        onChange={handleChange} 
                        className="input-field bg-white" 
                        placeholder="Search or Enter MRN..." 
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="input-label">Age</label>
                        <input type="text" name="age" value={formData.age} onChange={handleChange} className="input-field" placeholder="e.g. 34" />
                    </div>
                    <div>
                        <label className="input-label">Gestation</label>
                        <input type="text" name="gestation" value={formData.gestation} onChange={handleChange} className="input-field" placeholder="e.g. 32w4d" />
                    </div>
                </div>
                <div>
                    <label className="input-label text-rose-400">Stat Vitals (Simulated Device)</label>
                    <input type="text" name="vitals" value={formData.vitals} onChange={handleChange} className="input-field border-rose-200 focus:ring-rose-500 bg-rose-50/10 font-mono text-rose-700 font-bold" placeholder="BP, HR, SpO2" />
                </div>
                <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                    <label className="flex items-center gap-2 text-[11px] font-bold text-emerald-800 uppercase mb-1">
                        <Wind className="w-3 h-3" /> Environmental Vital Sign (TMaH)
                    </label>
                    <input 
                      type="text" 
                      name="environmentalVitalSign" 
                      value={formData.environmentalVitalSign} 
                      onChange={handleChange} 
                      className="input-field border-emerald-200 focus:ring-emerald-500 bg-white font-medium text-emerald-900 text-xs" 
                      placeholder="AQI, Heat Index, Desert Status..." 
                    />
                </div>
                <div>
                    <label className="input-label">Chief Complaint</label>
                    <input type="text" name="chiefComplaint" value={formData.chiefComplaint} onChange={handleChange} className="input-field" placeholder="Reason for visit" />
                </div>
                <div>
                    <label className="input-label">Clinical Narrative (HPI)</label>
                    <textarea 
                        name="narrative"
                        value={formData.narrative}
                        onChange={handleChange}
                        className="input-field h-48 leading-relaxed resize-none" 
                        placeholder="Detailed history of present illness..."
                    />
                </div>
            </div>
        )}

        {activeTab === 'Labs' && (
            <div className="space-y-4 animate-fadeIn">
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 text-xs text-amber-800 mb-2">
                    <strong className="block mb-1">Simulated Lab Interface</strong>
                    Paste recent lab values here. The AI will parse Platelets, Liver Enzymes (AST/ALT), Creatinine, and Proteinuria.
                </div>
                <div>
                    <label className="input-label">Recent Lab Results</label>
                    <textarea 
                        name="labs"
                        value={formData.labs}
                        onChange={handleChange}
                        className="input-field h-64 font-mono text-xs" 
                        placeholder="Paste labs here..."
                    />
                </div>
            </div>
        )}

        {activeTab === 'History' && (
            <div className="space-y-6 animate-fadeIn">
                <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
                  <h4 className="flex items-center gap-2 text-[11px] font-black text-teal-900 uppercase tracking-widest mb-4">
                    <Users className="w-4 h-4" /> Community Care Network
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    <CheckboxItem 
                      label="Midwife Available" 
                      checked={!!formData.communityAccess?.midwifeAvailable} 
                      onChange={() => handleCheckboxChange('midwifeAvailable')}
                      description="Licensed provider for prenatal/birth care"
                    />
                    <CheckboxItem 
                      label="Doula Assigned" 
                      checked={!!formData.communityAccess?.doulaAvailable} 
                      onChange={() => handleCheckboxChange('doulaAvailable')}
                      description="Non-medical emotional/physical support"
                    />
                    <CheckboxItem 
                      label="CHW Dispatch Active" 
                      checked={!!formData.communityAccess?.chwAssigned} 
                      onChange={() => handleCheckboxChange('chwAssigned')}
                      description="Community Health Worker integration"
                    />
                  </div>
                </div>

                <div>
                    <label className="input-label">Social Determinants (SDoH)</label>
                    <textarea 
                        name="socialHistory"
                        value={formData.socialHistory}
                        onChange={handleChange}
                        className="input-field h-32" 
                        placeholder="Transport, Food Access, Housing, Stress..."
                    />
                </div>
                <div>
                    <label className="input-label">OB History (Parity)</label>
                    <input type="text" name="parity" value={formData.parity} onChange={handleChange} className="input-field" placeholder="G_P_" />
                </div>
            </div>
        )}

      </form>

      <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0">
        <button 
          onClick={() => onAnalyze(formData)}
          disabled={status === AppStatus.ANALYZING}
          className={`w-full py-3 rounded-lg text-white font-bold tracking-wide flex items-center justify-center gap-2 transition-all shadow-md
            ${status === AppStatus.ANALYZING ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400'}`}
        >
          {status === AppStatus.ANALYZING && (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Analyzing with AI...
            </>
          )}
          {status !== AppStatus.ANALYZING && 'Run Clinical Diagnostics'}
        </button>
        {status === AppStatus.ANALYZING && (
          <p className="text-[10px] text-slate-400 text-center mt-2 italic">Connecting to Gemini API... (requires valid API_KEY in .env)</p>
        )}
      </div>
    </div>
  );
};

const CheckboxItem = ({ label, checked, onChange, description }: any) => (
  <div className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${checked ? 'bg-white border-teal-300 shadow-sm' : 'bg-white/50 border-slate-200'}`} onClick={onChange}>
    <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-teal-700 border-teal-600' : 'bg-white border-slate-300'}`}>
      {checked && <ShieldCheck className="w-3 h-3 text-white" />}
    </div>
    <div className="flex flex-col">
      <span className={`text-[11px] font-bold ${checked ? 'text-teal-900' : 'text-slate-500'}`}>{label}</span>
      <span className="text-[9px] text-slate-400 leading-none mt-1">{description}</span>
    </div>
  </div>
);

export default CaseInput;
