
import React from 'react';

interface StatusCellProps {
  status: string;
  type?: 'status' | 'triage' | 'protocol';
}

const STATUS_CONFIG: Record<string, string> = {
  // Clinical Status
  'Stable': 'bg-[#00c875] text-white', // Monday Green
  'Critical': 'bg-[#e2445c] text-white', // Monday Red
  'Reviewing': 'bg-[#fdab3d] text-white', // Monday Orange
  'Discharged': 'bg-[#a25ddc] text-white', // Monday Purple
  
  // Triage Scores
  '1 - Resuscitation': 'bg-[#333333] text-white',
  '2 - Emergent': 'bg-[#e2445c] text-white',
  '3 - Urgent': 'bg-[#fdab3d] text-white',
  '4 - Less Urgent': 'bg-[#00c875] text-white',
  
  // Protocols
  'HTN Protocol': 'bg-[#579bfc] text-white', // Blue
  'Sepsis Bundle': 'bg-[#ffcb00] text-slate-800', // Yellow
  'Standard Care': 'bg-[#c4c4c4] text-white', // Grey
};

const StatusCell: React.FC<StatusCellProps> = ({ status, type = 'status' }) => {
  const colorClass = STATUS_CONFIG[status] || 'bg-[#c4c4c4] text-white';

  return (
    <div className="h-full w-full flex items-center justify-center px-1">
      <div className={`w-full h-[34px] flex items-center justify-center text-center text-[13px] font-medium leading-none truncate transition-all hover:opacity-90 cursor-pointer shadow-sm relative group ${colorClass}`}>
        {status}
        {/* Hover corner fold effect often seen in Work OS */}
        <div className="absolute top-0 right-0 w-2 h-2 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity clip-path-polygon"></div>
      </div>
    </div>
  );
};

export default StatusCell;
