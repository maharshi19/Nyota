
import React, { useState, useEffect } from 'react';
import { AnalysisResult, TeamMember, Task, ChatMessage } from '../types';
import { Users, Send, CheckSquare, Clock, ArrowRight, Zap, MoreHorizontal, Plus } from 'lucide-react';

interface CollaborationPanelProps {
  result: AnalysisResult;
}

const MOCK_TEAM: TeamMember[] = [
  { id: '1', name: 'Dr. Sarah Chen', role: 'OB/GYN Attending', initials: 'SC', color: 'bg-teal-600' },
  { id: '2', name: 'Mark Davis', role: 'Charge Nurse', initials: 'MD', color: 'bg-stone-600' },
  { id: '3', name: 'Residency Team', role: 'Rotating', initials: 'RT', color: 'bg-amber-600' },
];

const CollaborationPanel: React.FC<CollaborationPanelProps> = ({ result }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');

  const managementPlan = Array.isArray(result?.managementPlan) ? result.managementPlan : [];
  const safetyChecklist = Array.isArray(result?.safetyChecklist) ? result.safetyChecklist : [];

  // Initialize Board and Chat based on AI Results (Simulating Automation)
  useEffect(() => {
    // 1. Transform Management Plan into Kanban Tasks
    const initialTasks: Task[] = managementPlan.map((plan, idx) => ({
      id: `task-${idx}`,
      title: plan.action,
      category: plan.timing,
      status: idx === 0 ? 'in-progress' : 'todo', // Auto-start the first high priority item
      priority: plan.timing === 'immediate' ? 'high' : plan.timing === 'urgent' ? 'medium' : 'low',
      assignee: plan.timing === 'immediate' ? MOCK_TEAM[0] : undefined
    }));
    setTasks(initialTasks);

    // 2. Generate System Automations in Chat
    const criticalFindings = safetyChecklist.filter(i => i.status === 'Critical');
    const systemMessages: ChatMessage[] = [];

    // Welcome message
    systemMessages.push({
      id: 'sys-1',
      senderId: 'system',
      text: `Case workspace initialized. ${managementPlan.length} tasks generated from AI Management Plan.`,
      timestamp: 'Now',
      type: 'automation'
    });

    // Alert for critical findings
    if (criticalFindings.length > 0) {
      systemMessages.push({
        id: 'sys-2',
        senderId: 'system',
        text: `CRITICAL ALERT: ${criticalFindings[0].category} risk detected. "Severe Maternal Morbidity Protocol" triggered.`,
        timestamp: 'Now',
        type: 'alert'
      });
    }
    setMessages(systemMessages);
  }, [managementPlan, safetyChecklist]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: '1', // Acting as Dr. Chen
      text: inputText,
      timestamp: 'Just now',
      type: 'message'
    };
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
  };

  const moveTask = (taskId: string, newStatus: Task['status']) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const getPriorityColor = (p: string) => {
    if (p === 'high') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (p === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
      
      {/* LEFT: WORKFLOW BOARD (Kanban) */}
      <div className="flex-1 flex flex-col border-r border-slate-200 min-w-0">
        <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-teal-600" />
              Care Plan Board
            </h3>
            <p className="text-xs text-slate-500">Drag and drop to manage workflow</p>
          </div>
          <div className="flex -space-x-2">
            {MOCK_TEAM.map(member => (
              <div key={member.id} className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white ${member.color}`} title={member.name}>
                {member.initials}
              </div>
            ))}
            <button className="w-8 h-8 rounded-full border-2 border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-teal-600 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
          <div className="flex gap-4 h-full min-w-[600px]">
            {/* Column: To Do */}
            <div className="flex-1 flex flex-col bg-slate-100/50 rounded-xl p-3 border border-slate-200/50">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-1 flex justify-between">
                To Do <span className="bg-slate-200 text-slate-600 px-1.5 rounded-full">{tasks.filter(t => t.status === 'todo').length}</span>
              </h4>
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                {tasks.filter(t => t.status === 'todo').map(task => (
                  <div key={task.id} className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 cursor-move hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      <button 
                        onClick={() => moveTask(task.id, 'in-progress')}
                        className="text-slate-300 hover:text-teal-600 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-slate-800 font-medium leading-tight mb-2">{task.title}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                      <span className="text-[10px] text-slate-400 font-medium uppercase">{task.category}</span>
                      {task.assignee && (
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${task.assignee.color}`}>
                          {task.assignee.initials}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column: In Progress */}
            <div className="flex-1 flex flex-col bg-teal-50/30 rounded-xl p-3 border border-teal-100/50">
              <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-3 px-1 flex justify-between">
                In Progress <span className="bg-teal-100 text-teal-700 px-1.5 rounded-full">{tasks.filter(t => t.status === 'in-progress').length}</span>
              </h4>
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                {tasks.filter(t => t.status === 'in-progress').map(task => (
                  <div key={task.id} className="bg-white p-3 rounded-lg shadow-sm border border-teal-200 ring-1 ring-teal-50 cursor-move">
                    <div className="flex justify-between items-start mb-2">
                       <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      <button 
                        onClick={() => moveTask(task.id, 'done')}
                        className="text-slate-300 hover:text-emerald-600 transition-colors"
                      >
                        <CheckSquare className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-slate-800 font-medium leading-tight mb-2">{task.title}</p>
                    {task.assignee && (
                        <div className="flex items-center gap-2 mt-2">
                             <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${task.assignee.color}`}>
                                {task.assignee.initials}
                             </div>
                             <span className="text-[10px] text-slate-500">Working on this</span>
                        </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Column: Done */}
            <div className="flex-1 flex flex-col bg-emerald-50/30 rounded-xl p-3 border border-emerald-100/50">
              <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-3 px-1 flex justify-between">
                Completed <span className="bg-emerald-100 text-emerald-600 px-1.5 rounded-full">{tasks.filter(t => t.status === 'done').length}</span>
              </h4>
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                {tasks.filter(t => t.status === 'done').map(task => (
                   <div key={task.id} className="bg-white/60 p-3 rounded-lg border border-emerald-100 opacity-75 grayscale-[0.3]">
                      <div className="flex items-center gap-2 mb-1">
                          <div className="bg-emerald-100 p-1 rounded-full">
                              <CheckSquare className="w-3 h-3 text-emerald-600" />
                          </div>
                          <span className="text-xs text-slate-500 line-through">{task.title}</span>
                      </div>
                   </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: TEAM HUDDLE (Chat) */}
      <div className="w-full lg:w-80 flex flex-col bg-white">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
           <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-600" />
              Team Huddle
            </h3>
            <p className="text-xs text-slate-500">Active: Dr. Chen, Mark (RN)</p>
           </div>
           <MoreHorizontal className="w-5 h-5 text-slate-400" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.senderId === 'system' ? '' : 'flex-row'}`}>
              
              {/* Avatar */}
              <div className="shrink-0">
                {msg.senderId === 'system' ? (
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center ${msg.type === 'alert' ? 'bg-rose-100 text-rose-400' : 'bg-slate-200 text-slate-600'}`}>
                      {msg.type === 'alert' ? <Zap className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                   </div>
                ) : (
                   <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-xs font-bold text-white">SC</div>
                )}
              </div>

              {/* Bubble */}
              <div className={`flex flex-col max-w-[85%] ${msg.senderId === '1' ? 'items-end ml-auto' : 'items-start'}`}>
                 <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed shadow-sm
                    ${msg.type === 'alert' ? 'bg-rose-50 border border-rose-100 text-rose-800' : 
                      msg.type === 'automation' ? 'bg-teal-50 border border-teal-100 text-teal-800 italic' :
                      msg.senderId === '1' ? 'bg-teal-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                    }`}>
                    {msg.text}
                 </div>
                 <span className="text-[9px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white">
          <div className="relative">
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Discuss case or @mention..."
              className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:bg-white transition-all outline-none"
            />
            <button 
                type="submit"
                disabled={!inputText.trim()}
                className="absolute right-1 top-1 p-1.5 text-slate-400 hover:text-teal-600 transition-colors disabled:opacity-50"
            >
                <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

    </div>
  );
};

export default CollaborationPanel;
