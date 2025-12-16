import React from 'react';
import { LayoutDashboard, MessageSquare, Users, ShieldAlert, Settings, LogOut, Bot } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'chat', icon: MessageSquare, label: 'Live Chat Demo' },
    { id: 'users', icon: Users, label: 'User Manager' },
    { id: 'broadcast', icon: ShieldAlert, label: 'Broadcast' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col h-full hidden md:flex">
      <div className="p-6 flex items-center space-x-3 border-b border-slate-700">
        <div className="w-10 h-10 bg-pink-600 rounded-full flex items-center justify-center">
          <Bot className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-white">Ekki Admin</h1>
          <p className="text-xs text-slate-400">@ekkirobot</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === item.id
                ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/20'
                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};