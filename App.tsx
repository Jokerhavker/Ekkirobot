import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ChatDemo } from './components/ChatDemo';
import { BroadcastPanel } from './components/BroadcastPanel';
import { UserManager } from './components/UserManager';
import { Bot, Key, Menu, X } from 'lucide-react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [ownerId, setOwnerId] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (ownerId.trim().length > 0) {
      setIsAuthenticated(true);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-pink-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-pink-900/40">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Ekki Bot Admin</h1>
            <p className="text-slate-400 mt-2 text-center">Enter your Owner ID to access the control panel.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                placeholder="Owner ID / Secret Key"
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
            >
              Login to Dashboard
            </button>
          </form>
          <div className="mt-6 text-center text-xs text-slate-600">
            Powered by Google Gemini • Vercel Host Ready
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Mobile Menu Button */}
      <button 
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-slate-800 rounded-lg text-white"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? <X /> : <Menu />}
      </button>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="w-64 h-full bg-slate-900" onClick={e => e.stopPropagation()}>
             <Sidebar 
               activeTab={activeTab} 
               setActiveTab={(tab) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} 
               onLogout={() => setIsAuthenticated(false)} 
             />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={() => setIsAuthenticated(false)} />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
        <header className="flex justify-between items-center mb-8 ml-10 md:ml-0">
          <div>
            <h1 className="text-2xl font-bold text-white capitalize">
              {activeTab === 'chat' ? 'Live Chat Simulator' : activeTab.replace('-', ' ')}
            </h1>
            <p className="text-sm text-slate-400">Welcome back, Owner</p>
          </div>
          <div className="flex items-center space-x-2 bg-green-900/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-900/30">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span>Bot Active</span>
          </div>
        </header>

        <div className="max-w-7xl mx-auto">
          {activeTab === 'dashboard' && <Dashboard ownerId={ownerId} />}
          {activeTab === 'chat' && <ChatDemo />}
          {activeTab === 'broadcast' && <BroadcastPanel ownerId={ownerId} />}
          {activeTab === 'users' && <UserManager ownerId={ownerId} />}
          {activeTab === 'settings' && (
            <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 text-center">
              <Bot className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Bot Configuration</h2>
              <p className="text-slate-400 mb-6">
                To deploy the backend logic to Vercel, copy the code from 
                <code className="bg-slate-900 px-2 py-1 rounded text-pink-400 mx-1">api/telegram-webhook.ts</code>
                and set your environment variables in Vercel.
              </p>
              <div className="grid gap-4 max-w-lg mx-auto text-left">
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                  <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Telegram Token</span>
                  <code className="text-green-400 break-all">process.env.TELEGRAM_BOT_TOKEN</code>
                </div>
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                  <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Gemini API Key</span>
                  <code className="text-blue-400 break-all">process.env.API_KEY</code>
                </div>
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                  <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Owner ID</span>
                  <code className="text-purple-400 break-all">process.env.OWNER_ID</code>
                </div>
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                  <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">MongoDB URI</span>
                  <code className="text-orange-400 break-all">process.env.MONGODB_URI</code>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}