import React, { useState } from 'react';
import {
  FileText,
  Upload,
  MessageSquare,
  Send,
  Search,
  FileCheck
} from 'lucide-react';

interface MemberDocumentsViewProps {
  mode: 'upload' | 'chat';
}

const sampleDocuments = [
  { name: 'Prenatal intake packet.pdf', owner: 'Aisha Thompson', status: 'Indexed' },
  { name: 'Community support notes.docx', owner: 'Maria Ellis', status: 'Ready' },
  { name: 'Postpartum care plan.pdf', owner: 'Danielle Brooks', status: 'Ready' },
];

const MemberDocumentsView: React.FC<MemberDocumentsViewProps> = ({ mode }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const isChat = mode === 'chat';

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8 space-y-8 custom-scrollbar">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-extrabold text-teal-700 uppercase tracking-[0.2em]">
            {isChat ? <MessageSquare className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
            Member Documents
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            {isChat ? 'Chat with my Documents' : 'Upload Member Documents'}
          </h2>
          <p className="text-sm text-slate-500 max-w-2xl font-medium leading-relaxed">
            {isChat
              ? 'Ask questions across uploaded member records, care notes, and plan documents.'
              : 'Add member files for care coordination, documentation review, and document chat.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {isChat ? (
            <div className="h-full min-h-[520px] flex flex-col">
              <div className="p-5 border-b border-slate-100 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Document Chat</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Member file workspace</p>
                </div>
              </div>
              <div className="flex-1 p-6 space-y-4">
                <ChatBubble align="left" text="Which members have postpartum support documents ready for review?" />
                <ChatBubble align="right" text="Show me files that mention transport or food access needs." />
                <ChatBubble align="left" text="I found 2 ready documents with community support notes and one postpartum care plan queued for review." />
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                <input
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Ask about uploaded member documents..."
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button className="px-4 py-3 bg-teal-600 text-white rounded-2xl hover:bg-teal-700 transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 space-y-6">
              <div className="border-2 border-dashed border-teal-200 bg-teal-50/50 rounded-3xl p-8 text-center">
                <Upload className="w-10 h-10 text-teal-600 mx-auto mb-4" />
                <h3 className="text-lg font-black text-slate-900 mb-2">Upload Member Documents</h3>
                <p className="text-sm text-slate-500 mb-6">PDF, DOCX, TXT, CSV, and image files can be staged for member document review.</p>
                <label className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white border border-slate-200 shadow-sm text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 cursor-pointer">
                  <FileText className="w-4 h-4 text-teal-600" />
                  Choose File
                  <input
                    type="file"
                    className="hidden"
                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </label>
                {selectedFile && (
                  <div className="mt-5 text-sm font-bold text-teal-700">{selectedFile.name}</div>
                )}
              </div>
              <button className="w-full py-3 rounded-2xl bg-teal-600 text-white text-xs font-black uppercase tracking-widest hover:bg-teal-700 transition-colors">
                Upload Document
              </button>
            </div>
          )}
        </div>

        <div className="xl:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-5">Recent Documents</h3>
          <div className="space-y-3">
            {sampleDocuments.map(doc => (
              <div key={doc.name} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-white text-teal-600 shadow-sm">
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-900 truncate">{doc.name}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{doc.owner}</div>
                  </div>
                </div>
                <span className="text-[10px] font-black text-teal-700 bg-teal-50 border border-teal-100 px-2 py-1 rounded-lg">
                  {doc.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatBubble = ({ align, text }: { align: 'left' | 'right'; text: string }) => (
  <div className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
    <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm font-medium leading-relaxed ${
      align === 'right'
        ? 'bg-teal-600 text-white'
        : 'bg-slate-100 text-slate-700'
    }`}>
      {text}
    </div>
  </div>
);

export default MemberDocumentsView;
