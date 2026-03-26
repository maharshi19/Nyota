import React, { useRef, useEffect, useState } from 'react';
import { BoardGroup, BoardItem } from '../types';
import StatusCell from './StatusCell';
import { ChevronDown, MessageSquare, Plus, Activity, TrendingUp, AlertTriangle, Heart, Thermometer } from 'lucide-react';

interface PatientBoardProps {
  groups: BoardGroup[];
  onItemClick: (item: BoardItem) => void;
}

interface PatientBoardProps {
  groups: BoardGroup[];
  onItemClick: (item: BoardItem) => void;
}

const COLOR_MAP: Record<string, { bg: string, text: string, border: string }> = {
  rose: { bg: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500' },
  indigo: { bg: 'bg-teal-500', text: 'text-teal-600', border: 'border-teal-500' },
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-500' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-500' }
};

const PatientBoard: React.FC<PatientBoardProps> = ({ groups, onItemClick }) => {
  const [updatedItems, setUpdatedItems] = useState<Record<string, boolean>>({});
  const [selectedPatient, setSelectedPatient] = useState<BoardItem | null>(null);
  const [showClinicalDetails, setShowClinicalDetails] = useState(false);
  const prevUpdateCounts = useRef<Record<string, number>>({});

  useEffect(() => {
    const newlyUpdated: Record<string, boolean> = {};
    let hasChanges = false;

    groups.flatMap(g => g.items).forEach(item => {
      const prevCount = prevUpdateCounts.current[item.id] || 0;
      if (item.updatesCount > prevCount) {
        newlyUpdated[item.id] = true;
        hasChanges = true;
      }
      prevUpdateCounts.current[item.id] = item.updatesCount;
    });

    if (hasChanges) {
      setUpdatedItems(newlyUpdated);
      const timer = setTimeout(() => setUpdatedItems({}), 2000);
      return () => clearTimeout(timer);
    }
  }, [groups]);

  // Calculate risk score based on vitals and NICU probability
  const calculateRiskScore = (item: BoardItem) => {
    const bpMatch = item.lastVitals.match(/BP (\d+)\/(\d+)/);
    const sbp = bpMatch ? parseInt(bpMatch[1]) : 120;
    const nicuProb = item.nicuProbability || 50;
    
    // Simple risk calculation
    let risk = 0;
    if (sbp > 160) risk += 30;
    else if (sbp > 140) risk += 15;
    if (nicuProb > 70) risk += 25;
    else if (nicuProb > 50) risk += 15;
    
    return Math.min(100, risk);
  };

  const getRiskLevel = (score: number) => {
    if (score >= 70) return { level: 'Critical', color: 'text-red-600', bg: 'bg-red-50' };
    if (score >= 40) return { level: 'High', color: 'text-orange-600', bg: 'bg-orange-50' };
    if (score >= 20) return { level: 'Medium', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { level: 'Low', color: 'text-green-600', bg: 'bg-green-50' };
  };

  const ClinicalDetailsModal: React.FC<{ patient: BoardItem; onClose: () => void }> = ({ patient, onClose }) => {
    const riskScore = calculateRiskScore(patient);
    const riskInfo = getRiskLevel(riskScore);
    
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-slate-900">{patient.name}</h1>
                <p className="text-slate-600 mt-1">{patient.mrn} • Age {patient.caseData.age}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Risk Assessment */}
            <div className={`${riskInfo.bg} rounded-lg p-4 border border-current border-opacity-20`}>
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className={`w-6 h-6 ${riskInfo.color}`} />
                <h2 className="text-lg font-bold text-slate-900">Clinical Risk Assessment</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-600">Risk Score</p>
                  <p className={`text-2xl font-bold ${riskInfo.color}`}>{riskScore}%</p>
                  <p className={`text-sm font-medium ${riskInfo.color}`}>{riskInfo.level} Risk</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">NICU Probability</p>
                  <p className="text-2xl font-bold text-slate-900">{patient.nicuProbability}%</p>
                  <p className="text-sm text-slate-500">{patient.nicuCategory}</p>
                </div>
              </div>
            </div>

            {/* Current Vitals */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500" />
                Current Vitals
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded">
                  <p className="text-xs text-slate-600">Blood Pressure</p>
                  <p className="text-lg font-bold text-slate-900">{patient.lastVitals.split(' | ')[0]}</p>
                </div>
                <div className="bg-white p-3 rounded">
                  <p className="text-xs text-slate-600">Air Quality Index</p>
                  <p className="text-lg font-bold text-slate-900">{patient.lastVitals.split(' | ')[1]}</p>
                </div>
              </div>
            </div>

            {/* Clinical Notes */}
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Clinical Summary</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">Chief Complaint:</p>
                  <p className="text-sm text-slate-600">{patient.caseData.chiefComplaint}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Gestation:</p>
                  <p className="text-sm text-slate-600">{patient.caseData.gestation}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Parity:</p>
                  <p className="text-sm text-slate-600">{patient.caseData.parity}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  onItemClick(patient);
                  onClose();
                }}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                View Full Assessment
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-x-auto overflow-y-auto bg-white p-4 md:p-8">
      {groups.map((group) => {
        const theme = COLOR_MAP[group.color] || COLOR_MAP.indigo;
        
        return (
          <div key={group.id} className="mb-10">
            
            {/* Group Header */}
            <div className="flex items-center gap-3 mb-2 group cursor-pointer">
              <ChevronDown className={`w-5 h-5 ${theme.text} transition-transform`} />
              <h3 className={`text-lg font-bold ${theme.text}`}>{group.title}</h3>
              <span className="text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                {group.items.length} Cases
              </span>
            </div>

            {/* Table Container */}
            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm bg-white">
              
              {/* Table Header */}
              <div className="grid grid-cols-[300px_120px_120px_140px_100px_120px_1fr_80px] bg-slate-50 border-b border-slate-200">
                 <HeaderCell label="Patient" />
                 <HeaderCell label="Status" />
                 <HeaderCell label="Risk Score" />
                 <HeaderCell label="Triage" />
                 <HeaderCell label="Protocol" />
                 <HeaderCell label="Team" />
                 <HeaderCell label="Latest Vitals" />
                 <HeaderCell label="Actions" /> 
              </div>

              {/* Table Body */}
              {group.items.map((item) => {
                const isUpdated = updatedItems[item.id];
                const riskScore = calculateRiskScore(item);
                const riskInfo = getRiskLevel(riskScore);
                
                return (
                  <div 
                    key={item.id} 
                    className={`grid grid-cols-[300px_120px_120px_140px_100px_120px_1fr_80px] border-b border-slate-100 hover:bg-slate-50/50 transition-colors group/row ${isUpdated ? 'animate-flash' : ''}`}
                  >
                    {/* Patient Name Column */}
                    <div 
                      className="p-0 border-r border-slate-100 flex items-center relative cursor-pointer"
                      onClick={() => onItemClick(item)}
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${theme.bg}`}></div>
                      <div className="px-4 py-2 flex items-center gap-3 w-full">
                        {/* Updates Bubble */}
                        <div className={`relative w-6 h-6 rounded-full flex items-center justify-center border transition-all
                          ${item.updatesCount > 0 ? 'bg-teal-500 border-teal-600 text-white' : 'bg-white border-slate-300 text-slate-300 hover:bg-teal-50 hover:text-teal-400'}`}>
                          {item.updatesCount > 0 ? <span className="text-[10px] font-bold">{item.updatesCount}</span> : <MessageSquare className="w-3 h-3" />}
                          {isUpdated && (
                            <span className="absolute -top-1 -right-1 flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                            </span>
                          )}
                        </div>
                        
                        <div className="truncate">
                          <div className="text-sm font-semibold text-slate-700 truncate">{item.name}</div>
                          <div className="text-[11px] text-slate-400">MRN: {item.mrn}</div>
                        </div>
                      </div>
                    </div>

                    {/* Status Column */}
                    <div className="border-r border-slate-100 bg-slate-50/10 p-1">
                       <StatusCell status={item.status} type="status" />
                    </div>

                    {/* Risk Score Column */}
                    <div className="border-r border-slate-100 p-2 flex flex-col items-center justify-center">
                      <div className={`text-lg font-bold ${riskInfo.color}`}>{riskScore}%</div>
                      <div className={`text-xs font-medium ${riskInfo.color}`}>{riskInfo.level}</div>
                      <div className="w-full bg-slate-200 rounded-full h-1 mt-1">
                        <div 
                          className={`h-1 rounded-full transition-all duration-300 ${
                            riskScore >= 70 ? 'bg-red-500' :
                            riskScore >= 40 ? 'bg-orange-500' :
                            riskScore >= 20 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${riskScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Triage Column */}
                    <div className="border-r border-slate-100 p-1">
                       <StatusCell status={item.triage} type="triage" />
                    </div>

                    {/* Protocol Column */}
                    <div className="border-r border-slate-100 p-1">
                       <StatusCell status={item.caseData.chiefComplaint.includes('Pressure') || item.caseData.narrative?.includes('HTN') || item.lastVitals.includes('168') ? 'HTN Protocol' : 'Standard Care'} type="protocol" />
                    </div>

                    {/* Assignee Column */}
                    <div className="border-r border-slate-100 flex items-center justify-center p-2">
                       {item.assignee ? (
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${item.assignee.color} border-2 border-white shadow-sm`} title={item.assignee.name}>
                            {item.assignee.initials}
                          </div>
                       ) : (
                          <div className="w-7 h-7 rounded-full border border-slate-200 border-dashed flex items-center justify-center text-slate-300">
                            <Plus className="w-3 h-3" />
                          </div>
                       )}
                    </div>

                    {/* Vitals Column */}
                    <div className={`border-r border-slate-100 px-3 py-2 flex items-center transition-all duration-1000 ${isUpdated ? 'text-teal-600 font-bold scale-[1.02]' : ''}`}>
                       <div className="flex items-center gap-2 truncate">
                          {isUpdated && <Activity className="w-3 h-3 text-teal-500 animate-pulse" />}
                          <span className="text-xs truncate" title={item.lastVitals}>
                            {item.lastVitals}
                          </span>
                       </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                       <button 
                        onClick={() => setSelectedPatient(item)}
                        className="text-xs text-teal-600 font-bold hover:underline px-2 py-1 bg-teal-50 rounded"
                        title="View Clinical Details"
                       >
                         <TrendingUp className="w-3 h-3" />
                       </button>
                       <button 
                        onClick={() => onItemClick(item)}
                        className="text-xs text-teal-600 font-bold hover:underline"
                        title="View Full Assessment"
                       >
                         View
                       </button>
                    </div>
                  </div>
                );
              })}

              {/* Add Item Row */}
              <div className="flex items-center pl-10 pr-4 py-2 hover:bg-slate-50 cursor-pointer border-l-4 border-transparent hover:border-slate-200 transition-colors">
                 <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Plus className="w-4 h-4" />
                    <span>Add Member to Panel</span>
                 </div>
              </div>

            </div>
          </div>
        );
      })}
      
      {/* Clinical Details Modal */}
      {selectedPatient && (
        <ClinicalDetailsModal 
          patient={selectedPatient} 
          onClose={() => setSelectedPatient(null)} 
        />
      )}
    </div>
  );
};

const HeaderCell: React.FC<{ label: string }> = ({ label }) => (
  <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wide border-r border-slate-200 last:border-r-0 flex items-center justify-center first:justify-start">
    {label}
  </div>
);

export default PatientBoard;