import React, { useState } from 'react';
import { Send, AlertTriangle, CheckCircle, Users, Radio } from 'lucide-react';

interface BroadcastPanelProps {
  ownerId: string;
}

export const BroadcastPanel: React.FC<BroadcastPanelProps> = ({ ownerId }) => {
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<'all' | 'groups' | 'users'>('all');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [sentCount, setSentCount] = useState(0);

  const handleSend = async () => {
    if (!message.trim()) return;
    setStatus('sending');
    
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': ownerId },
        body: JSON.stringify({ 
          action: 'broadcast', 
          payload: { message, target } 
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setSentCount(data.sent);
        setStatus('sent');
        setTimeout(() => {
          setMessage('');
          setStatus('idle');
        }, 3000);
      } else {
        setStatus('error');
      }
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-lg">
        <div className="flex items-center space-x-4 mb-8">
          <div className="p-3 bg-pink-600/20 rounded-full">
            <Radio className="w-8 h-8 text-pink-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Broadcast Message</h2>
            <p className="text-slate-400">Send an announcement to your bot users and groups.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Target Audience</label>
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'all', label: 'All', icon: Radio },
                { id: 'groups', label: 'Groups Only', icon: Users },
                { id: 'users', label: 'Private Only', icon: Users }
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setTarget(opt.id as any)}
                  className={`flex items-center justify-center space-x-2 p-4 rounded-xl border-2 transition-all ${
                    target === opt.id
                      ? 'border-pink-500 bg-pink-900/20 text-white'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <opt.icon className="w-5 h-5" />
                  <span className="font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Message Content</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your broadcast message here... Markdown is supported."
              className="w-full h-48 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
            />
          </div>

          <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded-lg flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-200">
              Warning: Broadcasting to all users may take some time. Avoid spamming to prevent being reported to Telegram.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSend}
              disabled={status === 'sending' || !message.trim()}
              className={`px-8 py-3 rounded-xl font-bold text-white flex items-center space-x-2 transition-all ${
                status === 'sent'
                  ? 'bg-green-600'
                  : status === 'error' ? 'bg-red-600' : 'bg-pink-600 hover:bg-pink-700 active:scale-95'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {status === 'sending' ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Sending...</span>
                </>
              ) : status === 'sent' ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Sent ({sentCount})</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Send Broadcast</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};