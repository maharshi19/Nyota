
import React, { useState, useEffect } from 'react';
import { HEDISMetric, HEDISGapMember } from '../types';
import { useAuth } from '../AuthContext';
import {
  FileCheck,
  ShieldAlert,
  ArrowUpRight,
  AlertCircle,
  FileJson,
  Zap,
  Bus,
  PhoneCall,
  Activity,
  Loader2
} from 'lucide-react';

interface HEDISData {
  metrics: HEDISMetric[];
  memberGaps: HEDISGapMember[];
  totalWithhold: number;
  atRiskAmount: number;
}

const HEDISReportingView: React.FC = () => {
  const { token } = useAuth();
  const [data, setData] = useState<HEDISData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch('/api/hedis', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(err => console.error('HEDIS fetch error:', err))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const totalWithhold = data?.totalWithhold ?? 4200000;
  const atRiskAmount  = data?.atRiskAmount  ?? 0;
  const earnedAmount  = totalWithhold - atRiskAmount;
  const metrics       = data?.metrics    ?? [];
  const memberGaps    = data?.memberGaps ?? [];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8 space-y-8 custom-scrollbar">

      {/* EXECUTIVE SUMMARY */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-extrabold text-teal-600 uppercase tracking-[0.2em]">
            <FileCheck className="w-3.5 h-3.5" />
            Quality Withhold Command
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">HEDIS Quality Performance</h2>
          <p className="text-sm text-slate-500 max-w-2xl font-medium leading-relaxed">
            Real-time tracking of CMS-mandated performance measures. Failure to hit thresholds impacts the{' '}
            <span className="text-teal-600 font-bold">2.0% State Quality Withhold.</span>
          </p>
        </div>
        <button className="bg-teal-50 text-slate-800 px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-black uppercase tracking-widest hover:bg-teal-100 transition-all">
          <FileJson className="w-4 h-4 text-teal-400" />
          Export Audit-Ready Report
        </button>
      </div>

      {/* WITHHOLD GAUGE & FINANCIALS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm flex flex-col md:flex-row items-center gap-12">
          <div className="relative w-48 h-48 flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="16" fill="transparent" className="text-slate-100" />
              <circle
                cx="96" cy="96" r="80"
                stroke="currentColor" strokeWidth="16" fill="transparent"
                strokeDasharray={502}
                strokeDashoffset={502 - 502 * (earnedAmount / totalWithhold)}
                className="text-teal-600"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-black text-slate-900">{Math.round((earnedAmount / totalWithhold) * 100)}%</span>
              <span className="text-[10px] font-black text-slate-400 uppercase">Withhold Earned</span>
            </div>
          </div>
          <div className="flex-1 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Contract Value</div>
                <div className="text-3xl font-black text-slate-900">$210.4M</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-teal-500 uppercase tracking-widest mb-1">2% Quality Withhold</div>
                <div className="text-3xl font-black text-teal-600">${(totalWithhold / 1_000_000).toFixed(1)}M</div>
              </div>
            </div>
            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <div>
                  <div className="text-[10px] font-black text-rose-800 uppercase tracking-widest">At-Risk Revenue</div>
                  <div className="text-lg font-black text-rose-400">${(atRiskAmount / 1_000_000).toFixed(1)}M</div>
                </div>
              </div>
              <span className="text-[10px] font-bold text-rose-400 uppercase px-2 py-1 bg-white rounded-lg shadow-sm">
                {atRiskAmount > 0 ? 'Gap Detected' : 'On Track'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 text-slate-800 flex flex-col justify-between group">
          <div>
            <Zap className="w-6 h-6 text-teal-400 mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-lg font-black leading-tight mb-2">Prescriptive Numerator Management</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Nyota targets members <span className="font-bold">Day 60–84</span> postpartum. AI predicts transport barriers before they become HEDIS failures.
            </p>
          </div>
          <div className="mt-8 space-y-3">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-600">Compliance Rate</span>
              <span className="text-teal-500">
                {metrics.length > 0 ? `${Math.round(metrics.filter(m => m.status === 'on-track').length / metrics.length * 100)}% on-track` : '—'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 transition-all duration-1000"
                style={{ width: `${Math.round(earnedAmount / totalWithhold * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* CORE HEDIS METRICS GRID */}
      {metrics.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map(metric => <MetricProgressCard key={metric.id} metric={metric} />)}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="text-slate-400 text-sm font-medium">
            No member data available — load patient records to compute HEDIS metrics.
          </div>
        </div>
      )}

      {/* NUMERATOR GAP COMMAND */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Numerator Gap Command</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Members Within PPC-Post / PDS-E Windows</p>
            </div>
            <AlertCircle className="w-4 h-4 text-rose-400 animate-pulse" />
          </div>
          {memberGaps.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No gap members detected — all current members are within compliance windows.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-4">Member / MRN</th>
                    <th className="px-6 py-4">Metric Window</th>
                    <th className="px-6 py-4">Days Remaining</th>
                    <th className="px-6 py-4">Nyota Prescriptive Action</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {memberGaps.map(gap => (
                    <tr key={gap.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-xs font-black text-slate-900">{gap.name}</div>
                        <div className="text-[10px] text-slate-400">{gap.mrn}</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-teal-600">{gap.metric}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black border
                            ${gap.status === 'critical' ? 'bg-rose-50 border-rose-100 text-rose-400' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
                            {gap.daysRemaining}
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Days Left</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-[10px] font-medium text-slate-700 bg-teal-50 border border-teal-100 px-3 py-1.5 rounded-lg">
                          {gap.prescriptiveAction.toLowerCase().includes('transport') || gap.prescriptiveAction.toLowerCase().includes('uber')
                            ? <Bus className="w-3 h-3 text-teal-600 shrink-0" />
                            : <PhoneCall className="w-3 h-3 text-teal-600 shrink-0" />}
                          {gap.prescriptiveAction}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-[9px] font-black text-teal-600 uppercase tracking-widest hover:underline">
                          Mark Compliant
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* AUDIT READINESS */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">ECDS Electronic Attestation</h4>
            <div className="space-y-4">
              <AttestationItem
                label="PPC-Pre Rate"
                status={metrics.find(m => m.code === 'PPC-Pre') ? `${metrics.find(m => m.code === 'PPC-Pre')!.currentRate}%` : '—'}
                type={metrics.find(m => m.code === 'PPC-Pre')?.status === 'on-track' ? 'success' : 'warning'}
              />
              <AttestationItem
                label="PPC-Post Rate"
                status={metrics.find(m => m.code === 'PPC-Post') ? `${metrics.find(m => m.code === 'PPC-Post')!.currentRate}%` : '—'}
                type={metrics.find(m => m.code === 'PPC-Post')?.status === 'on-track' ? 'success' : 'warning'}
              />
              <AttestationItem label="FHIR Interop Audit" status="Ready" type="success" />
            </div>
            <button className="w-full mt-8 py-3 bg-teal-700 text-[10px] font-black text-white uppercase tracking-widest rounded-xl shadow-lg shadow-teal-500/20">
              Run Full NCQA HEDIS Audit
            </button>
          </div>

          <div className="bg-emerald-900 rounded-3xl p-6 text-white">
            <Activity className="w-5 h-5 text-emerald-400 mb-3" />
            <h4 className="text-xs font-black uppercase mb-1">Telehealth Compliance Active</h4>
            <p className="text-[10px] text-emerald-200 leading-relaxed">
              CMS now permits telehealth for PPC compliance. Nyota virtual bridge counts toward numerator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricProgressCard: React.FC<{ metric: HEDISMetric }> = ({ metric }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group hover:border-teal-300 transition-all">
    <div className="flex justify-between items-start mb-4">
      <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded uppercase tracking-tighter">
        {metric.code}
      </span>
      {metric.trend > 0
        ? <ArrowUpRight className="w-4 h-4 text-emerald-500" />
        : <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />}
    </div>
    <div className="mb-4">
      <div className="text-2xl font-black text-slate-900 tracking-tighter">{metric.currentRate}%</div>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight mt-1">{metric.name}</div>
    </div>
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-black">
        <span className="text-slate-400 uppercase">Goal: {metric.goal}%</span>
        <span className={metric.status === 'on-track' ? 'text-emerald-600' : metric.status === 'failing' ? 'text-rose-500' : 'text-amber-500'}>
          {metric.status === 'on-track' ? 'Achieved' : metric.status === 'failing' ? 'Failing' : 'At Risk'}
        </span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${metric.status === 'on-track' ? 'bg-emerald-500' : metric.status === 'failing' ? 'bg-rose-500' : 'bg-amber-400'}`}
          style={{ width: `${Math.min(100, metric.currentRate)}%` }}
        />
      </div>
      <div className="text-[9px] text-slate-400">{metric.numerator.toLocaleString()} / {metric.denominator.toLocaleString()} members</div>
    </div>
  </div>
);

const AttestationItem = ({ label, status, type }: { label: string; status: string; type: 'success' | 'warning' }) => (
  <div className="flex justify-between items-center">
    <span className="text-[11px] font-bold text-slate-500">{label}</span>
    <span className={`text-[11px] font-black ${type === 'success' ? 'text-emerald-600' : 'text-amber-600'}`}>{status}</span>
  </div>
);

export default HEDISReportingView;
