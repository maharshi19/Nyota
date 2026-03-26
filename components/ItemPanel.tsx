
import React, { Suspense, lazy, useState } from 'react';
import { BoardItem, AppStatus, AnalysisResult, PatientCase, BirthPlan } from '../types';
import CaseInput from './CaseInput';
import { X, MessageSquare, FileText, Brain, ChevronRight, Baby, AlertTriangle, Download } from 'lucide-react';

const AnalysisResults = lazy(() => import('./AnalysisResults'));
const CollaborationPanel = lazy(() => import('./CollaborationPanel'));
const BirthPlanView = lazy(() => import('./BirthPlanView'));
const MLInsights = lazy(() => import('./MLInsights'));

interface ItemPanelProps {
  item: BoardItem;
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (data: PatientCase) => void;
  status: AppStatus;
}

const ItemPanel: React.FC<ItemPanelProps> = ({ item, isOpen, onClose, onAnalyze, status }) => {
  const [activeTab, setActiveTab] = useState<'updates' | 'data' | 'ml' | 'intelligence' | 'birth-plan'>('updates');
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);

  const hasCompleteAnalysis = (analysis: AnalysisResult | undefined): analysis is AnalysisResult => {
    return !!analysis
      && Array.isArray(analysis.managementPlan)
      && Array.isArray(analysis.safetyChecklist)
      && Array.isArray(analysis.prescriptiveIntelligence);
  };

  const handleDownloadReport = async () => {
    if (isDownloadingReport) return;

    setIsDownloadingReport(true);
    try {
      // Yield once so the button can paint its loading state before PDF work starts.
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const pdfModule = await import('../utils/patientPdfReport');
      const ok = pdfModule.downloadPatientPdfReport(item);
      if (!ok) {
        window.alert('Unable to generate the PDF report right now. Please try again.');
      }
    } catch (error) {
      console.error('Unable to load patient PDF generator:', error);
      window.alert('Unable to generate the PDF report right now. Please try again.');
    } finally {
      setIsDownloadingReport(false);
    }
  };

  // Auto-switch to Intelligence tab if analysis completes while panel is open
  React.useEffect(() => {
    if (status === AppStatus.COMPLETE) {
      setActiveTab('intelligence');
    }
  }, [status]);

  // Reset to a safe starting tab when user switches to a different patient.
  React.useEffect(() => {
    setActiveTab(hasCompleteAnalysis(item.analysis) ? 'updates' : 'data');
  }, [item.id]);

  const handleBirthPlanUpdate = (newPlan: BirthPlan) => {
    // This would typically trigger a state update in App.tsx
    // For now we'll simulate it by updating the current item if possible or just having local persistence
    onAnalyze({...item.caseData, birthPlan: newPlan});
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-200/50 backdrop-blur-[1px] z-[60]" 
        onClick={onClose}
      />
      
      {/* Slide-out Panel */}
      <div className="fixed top-0 right-0 h-full w-full md:w-[800px] lg:w-[1000px] bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-out flex flex-col border-l border-slate-200 pointer-events-auto">
        
        {/* Panel Header */}
        <div className="h-[60px] border-b border-slate-200 px-6 flex items-center justify-between bg-white shrink-0 relative z-20 pointer-events-auto">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-slate-800 leading-none">{item.name}</h2>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">{item.mrn}</span>
               <span className="text-[10px] text-slate-400 flex items-center gap-1">
                 <ChevronRight className="w-3 h-3" /> {item.status}
               </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadReport}
              disabled={isDownloadingReport}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
              title="Download full patient PDF report"
            >
              <Download className="w-4 h-4" />
              {isDownloadingReport ? 'Generating...' : 'Download Report'}
            </button>
            <button 
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tab Nav */}
        <div className="px-6 border-b border-slate-200 flex gap-6 shrink-0 bg-slate-50/50 relative z-20 pointer-events-auto">
          <TabButton 
            active={activeTab === 'updates'} 
            onClick={() => setActiveTab('updates')} 
            icon={<MessageSquare className="w-4 h-4" />} 
            label="Updates" 
            count={item.updatesCount > 0 ? item.updatesCount : undefined}
          />
          <TabButton 
            active={activeTab === 'data'} 
            onClick={() => setActiveTab('data')} 
            icon={<FileText className="w-4 h-4" />} 
            label="Clinical Data" 
          />
          <TabButton 
            active={activeTab === 'ml'} 
            onClick={() => setActiveTab('ml')} 
            icon={<Brain className="w-4 h-4" />} 
            label="ML Predictions" 
            badge="AI"
          />
          <TabButton 
            active={activeTab === 'intelligence'} 
            onClick={() => setActiveTab('intelligence')} 
            icon={<Brain className="w-4 h-4" />} 
            label="Intelligence" 
            badge={item.analysis ? 'READY' : undefined}
          />
          <TabButton 
            active={activeTab === 'birth-plan'} 
            onClick={() => setActiveTab('birth-plan')} 
            icon={<Baby className="w-4 h-4" />} 
            label="Birth Plan" 
          />
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden bg-slate-50 relative">
          
          {activeTab === 'updates' && (
             <div className="h-full p-6">
               {hasCompleteAnalysis(item.analysis) ? (
                 <Suspense fallback={<PanelLoadingState label="Loading updates" />}>
                  <CollaborationPanel result={item.analysis} />
                 </Suspense>
                ) : (
                   <div className="h-full flex flex-col items-center justify-center text-slate-400">
                      <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
                      <p>Start an analysis to generate team tasks and alerts.</p>
                   </div>
                )}
             </div>
          )}

          {activeTab === 'data' && (
             <div className="h-full max-w-3xl mx-auto py-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full overflow-hidden">
                   <CaseInput onAnalyze={onAnalyze} status={status} initialData={item.caseData} />
                </div>
             </div>
          )}
          {activeTab === 'ml' && (
            <div className="h-full p-6 overflow-y-auto">
               <Suspense fallback={<PanelLoadingState label="Loading ML predictions" />}>
                 <MLInsights patientData={item.caseData} />
               </Suspense>
            </div>
          )}
          {activeTab === 'birth-plan' && (
             <Suspense fallback={<PanelLoadingState label="Loading birth plan" />}>
               <BirthPlanView patientCase={item.caseData} onUpdate={handleBirthPlanUpdate} />
             </Suspense>
          )}

          {activeTab === 'intelligence' && (
            <div className="h-full p-6 overflow-y-auto">
               {status === AppStatus.ANALYZING ? (
                  <div className="h-full flex flex-col items-center justify-center">
                     <div className="w-16 h-16 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin mb-6"></div>
                     <h3 className="text-lg font-bold text-slate-700">Running Clinical Diagnostics...</h3>
                     <p className="text-sm text-slate-500 mt-2">Connecting to AI reasoning engine</p>
                  </div>
               ) : status === AppStatus.ERROR ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                     <AlertTriangle className="w-16 h-16 mb-4 opacity-20" />
                     <h3 className="text-lg font-bold text-slate-600 mb-2">Analysis Error</h3>
                     <p className="max-w-xs text-sm mb-4">Could not generate diagnostics. Check that your GEMINI_API_KEY is set in .env.local</p>
                     <button 
                       type="button"
                       onClick={() => setActiveTab('data')}
                       className="px-6 py-2 bg-teal-700 text-white rounded-lg font-bold shadow-lg"
                     >
                       Try Again
                     </button>
                  </div>
              ) : hasCompleteAnalysis(item.analysis) ? (
                  <Suspense fallback={<PanelLoadingState label="Loading intelligence" />}>
                    <AnalysisResults result={item.analysis} />
                  </Suspense>
               ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                     <Brain className="w-16 h-16 mb-4 opacity-20" />
                     <h3 className="text-lg font-bold text-slate-600 mb-2">AI Clinical Intelligence</h3>
                     <p className="max-w-xs text-center text-sm mb-6">Advanced diagnostics powered by Gemini AI will appear here after analysis.</p>
                     <div className="space-y-3 text-center">
                        <div className="bg-slate-50 p-3 rounded-lg">
                           <div className="text-xs font-bold text-slate-500 mb-1">Risk Assessment</div>
                           <div className="text-sm text-slate-400">Differential diagnosis & safety checklists</div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg">
                           <div className="text-xs font-bold text-slate-500 mb-1">Management Plan</div>
                           <div className="text-sm text-slate-400">Evidence-based interventions & timing</div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg">
                           <div className="text-xs font-bold text-slate-500 mb-1">Prescriptive Intelligence</div>
                           <div className="text-sm text-slate-400">TMaH Pillar actions & cost savings</div>
                        </div>
                     </div>
                     <button 
                       type="button"
                       onClick={() => setActiveTab('data')}
                       className="mt-6 px-6 py-2 bg-teal-600 text-white rounded-lg font-bold shadow-lg shadow-teal-500/30"
                     >
                       Run Clinical Diagnostics
                     </button>
                  </div>
               )}
            </div>
          )}

        </div>
      </div>
    </>
  );
};

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
  badge?: string;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon, label, count, badge }) => (
  <button
    type="button"
    onClick={onClick}
    className={`py-4 px-1 text-sm font-medium flex items-center gap-2 relative border-b-2 transition-colors
      ${active ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
  >
    {icon}
    {label}
    {count && (
      <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 h-4 rounded-full flex items-center justify-center">
        {count}
      </span>
    )}
    {badge && (
      <span className="bg-teal-100 text-teal-700 text-[9px] font-bold px-1.5 py-0.5 rounded ml-1">
        {badge}
      </span>
    )}
  </button>
);

const PanelLoadingState: React.FC<{ label: string }> = ({ label }) => (
  <div className="h-full flex flex-col items-center justify-center text-slate-500">
    <div className="w-10 h-10 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin mb-4"></div>
    <p className="text-sm font-medium">{label}...</p>
  </div>
);

export default ItemPanel;
