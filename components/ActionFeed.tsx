
import React from 'react';
import { BoardItem } from '../types';
import { Zap, Clock, TrendingUp, DollarSign, ChevronRight, User } from 'lucide-react';
import { dashboardTheme } from '../utils/dashboardTheme';

interface ActionFeedProps {
  items: BoardItem[];
  onItemClick: (item: BoardItem) => void;
}

const ActionFeed: React.FC<ActionFeedProps> = ({ items, onItemClick }) => {
  const palette = dashboardTheme;
  // Filter for high-urgency items (Critical status) and sort by riskRank
  const highUrgencyItems = [...items]
    .filter(item => item.status === 'Critical')
    .sort((a, b) => b.riskRank - a.riskRank);

  return (
    <div className="rounded-2xl border overflow-hidden shadow-sm flex flex-col h-full" style={{ backgroundColor: '#f8fbf9', borderColor: palette.border }}>
      <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: palette.border, backgroundColor: '#e8f0eb' }}>
        <div className="flex items-center gap-2">
           <Zap className="w-5 h-5" style={{ color: palette.critical }} />
           <h3 className="font-bold" style={{ color: palette.text }}>High-Urgency Feed</h3>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider" style={{ backgroundColor: '#f2dbdb', color: '#8f5555' }}>Critical Cases</span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y custom-scrollbar" style={{ borderColor: palette.borderLight }}>
        {highUrgencyItems.map(item => {
          const pi = item.analysis?.prescriptiveIntelligence?.[0];
          return (
            <div 
              key={item.id} 
              className="p-4 transition-colors cursor-pointer group"
              style={{ backgroundColor: '#fbfdfb' }}
              onClick={() => onItemClick(item)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white`} style={{ backgroundColor: item.status === 'Critical' ? palette.critical : palette.warning }}>
                     {item.name.charAt(0)}
                   </div>
                   <div>
                     <div className="text-sm font-bold flex items-center gap-2" style={{ color: palette.text }}>
                       {item.name}
                       <span className="text-[10px] font-normal" style={{ color: palette.textMid }}>MRN {item.mrn}</span>
                     </div>
                     <div className="text-[11px] flex items-center gap-1" style={{ color: palette.textMid }}>
                        <Clock className="w-3 h-3" /> Updated {item.lastUpdated}
                     </div>
                   </div>
                </div>
                <div className="text-right">
                   <div className="text-xs font-bold" style={{ color: palette.critical }}>Risk Rank: #{item.riskRank}</div>
                   <div className="text-[9px] uppercase tracking-tighter" style={{ color: palette.textMid }}>72hr Window</div>
                </div>
              </div>

              {/* Prescriptive Alert */}
              {pi ? (
                <div className="mt-2 border rounded-lg p-3 flex items-start gap-3 transition-colors" style={{ backgroundColor: '#deebe5', borderColor: palette.stableBorder }}>
                  <div className="p-1.5 rounded shadow-sm" style={{ backgroundColor: '#f3f8f5', color: palette.teal }}>
                     <TrendingUp className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                     <div className="text-xs font-bold mb-0.5" style={{ color: '#355f52' }}>{pi.action}</div>
                     <p className="text-[10px] leading-snug line-clamp-2" style={{ color: '#4e7668' }}>{pi.rationale}</p>
                     <div className="mt-2 flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[9px] font-bold" style={{ color: '#4e7e63' }}>
                          <DollarSign className="w-3 h-3" /> Save ~$100k
                        </span>
                        <span className="text-[9px]" style={{ color: palette.textMid }}>Intervention: ${pi.cost}</span>
                     </div>
                  </div>
                  <ChevronRight className="w-4 h-4 self-center" style={{ color: '#689785' }} />
                </div>
              ) : (
                <div className="mt-2 text-[11px] italic" style={{ color: palette.textMid }}>No prescriptive action generated yet. Analyze clinical + env data.</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActionFeed;
