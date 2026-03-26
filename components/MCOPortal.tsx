import React, { useState, useEffect } from 'react';
import { Building2, Users, TrendingUp, Upload, BarChart3, ShieldAlert, Activity, Zap, ArrowLeft } from 'lucide-react';
import MCODataEntry from './MCODataEntry';
import { dashboardTheme as T } from '../utils/dashboardTheme';

interface MCOPortalProps {
  onViewChange?: (view: string) => void;
}

const MCOPortal: React.FC<MCOPortalProps> = ({ onViewChange }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'submit-data' | 'analytics'>('dashboard');
  const [mcoStats, setMcoStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMcoId, setUploadMcoId] = useState('MCO_UPLOAD');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string>('');

  useEffect(() => {
    fetchMCOStats();
  }, []);

  const fetchMCOStats = async () => {
    try {
      const response = await fetch('/api/mco/stats');
      const data = await response.json();
      setMcoStats(data);
    } catch (error) {
      console.error('Error fetching MCO stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDataSubmitted = () => {
    fetchMCOStats(); // Refresh stats after submission
  };

  const handleFileUpload = async () => {
    if (!uploadFile) {
      setUploadResult('Please select a file before uploading.');
      return;
    }

    setUploading(true);
    setUploadResult('');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('mcoId', uploadMcoId || 'MCO_UPLOAD');

      const response = await fetch('/api/mco/upload-data', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        setUploadResult(`Upload failed: ${data.error || 'Unknown error'}`);
        return;
      }

      setUploadResult(
        `Upload complete: ${data.acceptedRows}/${data.totalRows} rows accepted. ${data.rejectedRows} rejected.`
      );
      setUploadFile(null);
      fetchMCOStats();
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadResult('Upload failed. Please check your server connection and file format.');
    } finally {
      setUploading(false);
    }
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg"
        style={{ background: `linear-gradient(135deg, ${T.navy} 0%, ${T.teal} 70%, ${T.tealBright} 100%)` }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 85% 50%, #ffffff 0%, transparent 55%)' }} />
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">MCO Data Portal</h1>
            <p className="mt-1 text-sm" style={{ color: T.mintDark }}>Submit patient data and monitor your contributions to the Nyota platform</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Building2 className="w-7 h-7 text-white" />
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border shadow-sm" style={{ borderColor: T.border }}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: T.stableBg }}>
              <Upload className="w-5 h-5" style={{ color: T.teal }} />
            </div>
          </div>
          <p className="text-2xl font-black" style={{ color: T.text }}>{mcoStats?.totalSubmissions || 0}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Your Submissions</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border shadow-sm" style={{ borderColor: T.border }}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: T.stableBg }}>
              <Users className="w-5 h-5" style={{ color: T.teal }} />
            </div>
          </div>
          <p className="text-2xl font-black" style={{ color: T.text }}>{mcoStats?.submissionsByMCO?.length || 0}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Active MCOs</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border shadow-sm" style={{ borderColor: T.border }}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: T.goldBg }}>
              <TrendingUp className="w-5 h-5" style={{ color: T.gold }} />
            </div>
          </div>
          <p className="text-2xl font-black" style={{ color: T.text }}>
            {mcoStats?.totalSubmissions ? '+' + Math.round(mcoStats.totalSubmissions * 2.5) : 0}
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Lives Monitored</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border shadow-sm" style={{ borderColor: T.border }}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: T.warningBg }}>
              <Activity className="w-5 h-5" style={{ color: T.warning }} />
            </div>
          </div>
          <p className="text-lg font-black" style={{ color: T.text }}>
            {mcoStats?.lastUpdated ? new Date(mcoStats.lastUpdated).toLocaleTimeString() : 'Never'}
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Last Updated</p>
        </div>
      </div>

      {/* MCO Leaderboard */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: T.border }}>
        <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: T.borderLight, backgroundColor: T.surface }}>
          <BarChart3 className="w-4 h-4" style={{ color: T.teal }} />
          <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide">MCO Contributions Leaderboard</h3>
        </div>
        <div className="divide-y" style={{ borderColor: T.borderLight }}>
          {mcoStats?.submissionsByMCO?.sort((a: any, b: any) => b.totalSubmissions - a.totalSubmissions)
            .slice(0, 5).map((mco: any, index: number) => (
            <div key={mco.mcoId} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0"
                style={{
                  backgroundColor: index === 0 ? T.goldBg : index === 1 ? '#f1f5f9' : index === 2 ? '#fdf3e7' : T.surfaceAlt,
                  color: index === 0 ? T.gold : index === 1 ? '#64748b' : index === 2 ? '#92400e' : T.muted
                }}>
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-sm">{mco.mcoId}</p>
                <p className="text-xs text-slate-400">{mco.totalSubmissions} submissions · Last: {new Date(mco.lastSubmission).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-1.5 text-[10px] font-bold">
                <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: T.criticalBg, color: T.critical }}>{mco.riskDistribution.Critical} Crit</span>
                <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: T.warningBg, color: T.warning }}>{mco.riskDistribution.Reviewing} Rev</span>
                <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: T.stableBg, color: T.stable }}>{mco.riskDistribution.Stable} Stable</span>
              </div>
            </div>
          )) || (
            <p className="text-slate-400 text-center py-8 text-sm">No MCO submissions yet</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button onClick={() => setActiveTab('submit-data')}
          className="p-6 rounded-2xl text-left hover:shadow-md transition-all"
          style={{ background: `linear-gradient(135deg, ${T.teal}, ${T.tealBright})` }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-black text-white">Submit New Data</h3>
          </div>
          <p className="text-sm" style={{ color: T.mintDark }}>Add patient information to the platform</p>
        </button>

        <button onClick={() => setActiveTab('analytics')}
          className="p-6 rounded-2xl text-left hover:shadow-md transition-all"
          style={{ background: `linear-gradient(135deg, ${T.navy}, ${T.navyLight})` }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-black text-white">View Analytics</h3>
          </div>
          <p className="text-sm" style={{ color: T.mintDark }}>See your contribution impact</p>
        </button>
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: T.border }}>
        <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: T.borderLight, backgroundColor: T.surface }}>
          <ShieldAlert className="w-4 h-4" style={{ color: T.critical }} />
          <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide">Risk Distribution by MCO</h3>
        </div>
        <div className="p-6 space-y-5">
          {mcoStats?.submissionsByMCO?.map((mco: any) => (
            <div key={mco.mcoId} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm" style={{ color: T.text }}>{mco.mcoId}</span>
                <span className="text-xs font-medium" style={{ color: T.muted }}>{mco.totalSubmissions} patients</span>
              </div>
              <div className="flex h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: T.borderLight }}>
                <div style={{ width: `${(mco.riskDistribution.Critical / mco.totalSubmissions) * 100}%`, backgroundColor: T.critical }} />
                <div style={{ width: `${(mco.riskDistribution.Reviewing / mco.totalSubmissions) * 100}%`, backgroundColor: T.warning }} />
                <div style={{ width: `${(mco.riskDistribution.Stable / mco.totalSubmissions) * 100}%`, backgroundColor: T.teal }} />
              </div>
              <div className="flex gap-4 text-[10px] font-bold">
                <span style={{ color: T.critical }}>● Critical: {mco.riskDistribution.Critical}</span>
                <span style={{ color: T.warning }}>● Reviewing: {mco.riskDistribution.Reviewing}</span>
                <span style={{ color: T.stable }}>● Stable: {mco.riskDistribution.Stable}</span>
              </div>
            </div>
          )) || (
            <p className="text-center py-6 text-sm" style={{ color: T.muted }}>No data available</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border shadow-sm p-6" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4" style={{ color: T.teal }} />
            <h4 className="font-black text-sm uppercase tracking-wide" style={{ color: T.text }}>Data Quality Metrics</h4>
          </div>
          <div className="space-y-3">
            {[['Complete Records', '98%', T.teal], ['Real-time Updates', 'Active', T.teal], ['ML Model Integration', 'Enabled', T.teal]]
              .map(([label, val, colour]) => (
              <div key={label as string} className="flex justify-between items-center py-2 border-b last:border-0" style={{ borderColor: T.borderLight }}>
                <span className="text-sm" style={{ color: T.textMid }}>{label}</span>
                <span className="text-sm font-black" style={{ color: colour as string }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-6" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4" style={{ color: T.gold }} />
            <h4 className="font-black text-sm uppercase tracking-wide" style={{ color: T.text }}>Platform Benefits</h4>
          </div>
          <div className="space-y-3">
            {[
              [Zap,        'Real-time risk monitoring',  T.gold],
              [TrendingUp, 'Predictive analytics',       T.teal],
              [Users,      'Collaborative care teams',   T.teal],
            ].map(([Icon, label, colour]: any) => (
              <div key={label} className="flex items-center gap-3 p-2 rounded-lg" style={{ backgroundColor: T.surfaceAlt }}>
                <Icon className="w-4 h-4 shrink-0" style={{ color: colour }} />
                <span className="text-sm font-medium" style={{ color: T.textMid }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: T.teal }}></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: T.surface }}>
      {/* Navigation */}
      <div className="bg-white border-b sticky top-0 z-10" style={{ borderColor: T.borderLight }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-1">
              {([['dashboard','Dashboard'],['submit-data','Submit Data'],['analytics','Analytics']] as const).map(([tab, label]) => (
                <button key={tab} onClick={() => setActiveTab(tab as any)}
                  className="px-4 py-2 rounded-lg text-sm font-bold transition-all"
                  style={activeTab === tab
                    ? { backgroundColor: T.stableBg, color: T.teal }
                    : { color: T.muted }}
                >{label}</button>
              ))}
            </div>
            <button onClick={() => onViewChange?.('dashboard')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all"
              style={{ color: T.muted }}>
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'submit-data' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black" style={{ color: T.text }}>Submit Patient Data</h2>
              <p className="text-sm mt-1" style={{ color: T.muted }}>Upload CSV/TXT/XLSX files or submit a single patient via form</p>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-4" style={{ borderColor: T.border }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: T.stableBg }}>
                  <Upload className="w-4 h-4" style={{ color: T.teal }} />
                </div>
                <h3 className="font-black text-sm uppercase tracking-wide" style={{ color: T.text }}>Bulk Upload</h3>
              </div>
              <p className="text-xs" style={{ color: T.muted }}>Accepted formats: <strong>.csv</strong>, <strong>.txt</strong>, <strong>.xlsx</strong>, <strong>.xls</strong></p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: T.textMid }}>MCO ID</label>
                  <input
                    type="text"
                    value={uploadMcoId}
                    onChange={(e) => setUploadMcoId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: T.border }}
                    placeholder="MCO_UPLOAD"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: T.textMid }}>Data File</label>
                  <input
                    type="file"
                    accept=".csv,.txt,.xlsx,.xls"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: T.border }}
                  />
                </div>
                <button
                  onClick={handleFileUpload}
                  disabled={uploading}
                  className="px-4 py-2 rounded-lg text-white font-bold text-sm transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: T.teal }}
                >
                  {uploading ? 'Uploading…' : 'Upload File'}
                </button>
              </div>

              {uploadResult && (
                <div className="text-sm px-4 py-3 rounded-xl border font-medium" style={{ backgroundColor: T.stableBg, borderColor: T.stableBorder, color: T.stable }}>
                  {uploadResult}
                </div>
              )}
            </div>

            <MCODataEntry onDataSubmitted={handleDataSubmitted} />
          </div>
        )}
        {activeTab === 'analytics' && renderAnalytics()}
      </div>
    </div>
  );
};

export default MCOPortal;