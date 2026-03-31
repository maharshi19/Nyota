
import React, { useState, useEffect } from 'react';
import { CareForceMember, CareForceActivity } from '../types';
import { useAuth } from '../AuthContext';
import {
  Users,
  MapPin,
  Search,
  ShieldCheck,
  Zap,
  Activity,
  MessageSquare,
  HeartHandshake,
  Baby,
  Navigation,
  Globe,
  Clock,
  MoreVertical,
  Star,
  Loader2
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const ROLE_COLORS: Record<string, string> = {
  CHW:                 '#3a8c81',
  Doulas:              '#ec4899',
  Nurses:              '#10b981',
  MDs:                 '#0d9488',
  Midwives:            '#8b5cf6',
  Other:               '#94a3b8',
};

const CareForceView: React.FC = () => {
  const { token } = useAuth();
  const [members, setMembers]       = useState<CareForceMember[]>([]);
  const [activities, setActivities] = useState<CareForceActivity[]>([]);
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<'All' | 'CHW' | 'Doula' | 'Clinical'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch('/api/careforce', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setMembers(d.members || []);
          setActivities(d.recentActivities || []);
          setRoleCounts(d.roleCounts || {});
        }
      })
      .catch(err => console.error('CareForce fetch error:', err))
      .finally(() => setLoading(false));
  }, [token]);

  const networkStats = Object.entries(roleCounts).map(([name, value]) => ({
    name,
    value,
    color: ROLE_COLORS[name] || '#94a3b8',
  }));

  const totalForce = members.length;
  const activeCaseload = members.reduce((s, m) => s + (m.caseload || 0), 0);
  const activeCount    = members.filter(m => m.status === 'active').length;
  const coverageRatio  = totalForce > 0 ? Math.min(100, Math.round((activeCount / totalForce) * 140)) : 0;

  const filteredMembers = members.filter(m => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.coverageArea || []).some(z => z.includes(searchQuery));
    const matchesFilter =
      filter === 'All' ||
      (filter === 'CHW'    && m.role === 'CHW') ||
      (filter === 'Doula'  && m.role === 'Doula') ||
      (filter === 'Clinical' && ['Nurse', 'MD', 'Charge Nurse', 'OB/GYN Attending', 'Midwife', 'Specialist'].includes(m.role));
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8 space-y-8 custom-scrollbar">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-extrabold text-teal-600 uppercase tracking-[0.2em]">
            <Globe className="w-3.5 h-3.5" />
            Network Engagement Command
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Care Force Command</h2>
          <p className="text-sm text-slate-500 max-w-2xl font-medium leading-relaxed">
            Real-time synchronization between the MCO and the{' '}
            <span className="text-teal-600 font-bold">"Care Force"</span>—clinicians, advocates, and community health workers executing TMaH benefits.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all">
            <MessageSquare className="w-4 h-4 text-teal-500" />
            Broadcast Alert
          </button>
          <button className="bg-teal-50 text-slate-800 px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-black uppercase tracking-widest hover:bg-teal-100 transition-all">
            <HeartHandshake className="w-4 h-4 text-teal-400" />
            Network Expansion
          </button>
        </div>
      </div>

      {/* TOP METRIC RIBBON */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricBox label="Total Network"     value={String(totalForce)}    sub="Active Partners"       icon={<Users className="text-teal-500" />} />
        <MetricBox label="Active Caseload"   value={String(activeCaseload)} sub="Members Supported"    icon={<Baby className="text-teal-600" />} />
        <MetricBox label="Coverage Adequacy" value={`${coverageRatio}%`}   sub="TMaH Target: 90%"     icon={<ShieldCheck className="text-teal-500" />} />
        <MetricBox label="Network Status"    value={`${activeCount} Active`} sub="Real-time Sync"     icon={<Clock className="text-amber-500" />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

        {/* CARE FORCE DIRECTORY */}
        <div className="xl:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name or coverage zip..."
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all outline-none"
                />
              </div>
              <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
                {(['All', 'CHW', 'Doula', 'Clinical'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setFilter(opt)}
                    className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all
                      ${filter === opt ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                {members.length === 0
                  ? 'No careforce members found. Add team members in User Management.'
                  : 'No members match your search.'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMembers.map(member => (
                  <div key={member.id} className="group p-4 bg-slate-50 hover:bg-white rounded-2xl border border-transparent hover:border-teal-200 hover:shadow-xl transition-all duration-300 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl ${member.color} flex items-center justify-center text-white font-black text-sm relative`}>
                        {member.initials}
                        {member.status === 'active' && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white" />
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900 flex items-center gap-2">
                          {member.name}
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-400">{member.role}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter flex items-center gap-2 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {member.coverageArea && member.coverageArea.length > 0
                            ? `Zips: ${member.coverageArea.join(', ')} • `
                            : ''}
                          Caseload: {member.caseload}/{member.maxCapacity}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="hidden lg:block">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Benefit Program</div>
                        <div className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">{member.benefitProgram}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-teal-500 shadow-sm">
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-400">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="xl:col-span-4 space-y-6">

          {/* Active Dispatch Feed */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Active Dispatch Feed</h4>
              <Activity className="w-4 h-4 text-rose-400 animate-pulse" />
            </div>
            <div className="p-4 space-y-4">
              {activities.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-xs">No recent dispatch activities.</div>
              ) : (
                activities.map(activity => (
                  <div key={activity.id} className="flex gap-4 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <Navigation className="w-4 h-4 text-teal-500" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-800">{activity.memberName}</div>
                      <div className="text-[10px] text-slate-600 font-medium mb-1">{activity.action}</div>
                      <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                        <span>{activity.location}</span>
                        <span>•</span>
                        <span>{activity.timestamp}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <button className="w-full py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-teal-600 transition-colors">
                View All Activities
              </button>
            </div>
          </div>

          {/* Network Composition */}
          {networkStats.length > 0 && (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight mb-6">Network Composition</h4>
              <div className="h-48 relative">
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-900">{totalForce}</span>
                  <span className="text-[8px] text-slate-400 font-bold uppercase">Total Force</span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={networkStats} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value">
                      {networkStats.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {networkStats.map(stat => (
                  <div key={stat.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.color }} />
                    <span className="text-[10px] font-bold text-slate-600">{stat.name}: {stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TMaH Synergy */}
          <div className="bg-white rounded-3xl p-6 text-slate-800 shadow-xl border border-slate-100">
            <Zap className="w-6 h-6 text-amber-400 mb-4" />
            <h4 className="text-sm font-black uppercase mb-1">TMaH Synergy Active</h4>
            <p className="text-[10px] text-slate-500 leading-relaxed font-medium mb-6">
              Direct Care Force sync is reducing administrative burden across the network.
            </p>
            <div className="flex items-center gap-2 p-3 bg-teal-50 rounded-2xl border border-teal-100">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-[10px] font-bold">
                {activeCount} active members · {coverageRatio}% coverage
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricBox = ({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: React.ReactNode }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group hover:border-teal-300 transition-all">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl group-hover:bg-white transition-colors">{icon}</div>
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
    </div>
    <div className="text-2xl font-black text-slate-900 tracking-tighter">{value}</div>
    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{sub}</div>
  </div>
);

export default CareForceView;
