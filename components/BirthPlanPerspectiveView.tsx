import React, { useMemo } from 'react';
import { BoardItem } from '../types';
import { useData } from '../DataContext';
import BirthPlanView from './BirthPlanView';
import {
  Baby,
  TrendingUp
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
  const { items } = useData();

  const requestTrends = useMemo(() => [
    {
      name: 'Doula Support Requested',
      value: items.filter(i => i.caseData?.communityAccess?.doulaAvailable).length,
      color: '#f59e0b',
    },
    {
      name: 'Midwife Care Available',
      value: items.filter(i => i.caseData?.communityAccess?.midwifeAvailable).length,
      color: '#10b981',
    },
    {
      name: 'CHW Assigned',
      value: items.filter(i => i.caseData?.communityAccess?.chwAssigned).length,
      color: '#3a8c81',
    },
    {
      name: 'High-Risk Support Requests',
      value: items.filter(i => i.status === 'Critical').length,
      color: '#ec4899',
    },
  ], [items]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8 space-y-8 custom-scrollbar">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-extrabold text-teal-700 uppercase tracking-[0.2em]">
            <Baby className="w-3.5 h-3.5" />
            Member Care Requests
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            {selectedMember ? `Member Care Request: ${selectedMember.name}` : 'Member Care Requests'}
          </h2>
          <p className="text-sm text-slate-500 max-w-2xl font-medium leading-relaxed">
            {selectedMember
              ? `Care preferences and support requests for MRN ${selectedMember.mrn}.`
              : 'Aggregate member care requests across community support, clinical coordination, and care navigation workflows.'}
          </p>
        </div>
      </div>

      {selectedMember ? (
        <div className="pb-20">
          <BirthPlanView
            patientCase={selectedMember.caseData}
            onUpdate={() => {}}
          />
        </div>
      ) : (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-lg font-black text-slate-900">Member Request Trends</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Frequency of care requests</p>
            </div>
            <div className="bg-teal-50 p-2 rounded-xl text-teal-700">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={requestTrends} layout="vertical" margin={{ left: 40, right: 40 }}>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }}
                  width={160}
                />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                  {requestTrends.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default BirthPlanPerspectiveView;
