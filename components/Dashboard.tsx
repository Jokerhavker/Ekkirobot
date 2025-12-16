import React, { useEffect, useState } from 'react';
import { Users, MessagesSquare, ShieldBan, Zap, ArrowUp, ArrowDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface DashboardProps {
  ownerId: string;
}

const mockChartData = [
  { name: 'Mon', users: 400, messages: 2400 },
  { name: 'Tue', users: 300, messages: 1398 },
  { name: 'Wed', users: 200, messages: 9800 },
  { name: 'Thu', users: 278, messages: 3908 },
  { name: 'Fri', users: 189, messages: 4800 },
  { name: 'Sat', users: 239, messages: 3800 },
  { name: 'Sun', users: 349, messages: 4300 },
];

export const Dashboard: React.FC<DashboardProps> = ({ ownerId }) => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeGroups: 0,
    blockedUsers: 0,
    totalLogs: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-key': ownerId },
          body: JSON.stringify({ action: 'stats' })
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (e) {
        console.error("Failed to fetch stats", e);
      }
    };
    fetchStats();
  }, [ownerId]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Users" 
          value={stats.totalUsers.toLocaleString()} 
          icon={Users} 
          trend="Live" 
          color="bg-blue-500" 
        />
        <StatCard 
          title="Active Groups" 
          value={stats.activeGroups.toLocaleString()} 
          icon={MessagesSquare} 
          trend="Live" 
          color="bg-green-500" 
        />
        <StatCard 
          title="Blocked Users" 
          value={stats.blockedUsers.toLocaleString()} 
          icon={ShieldBan} 
          trend="" 
          isNegative 
          color="bg-red-500" 
        />
        <StatCard 
          title="Total Interactions" 
          value={stats.totalLogs.toLocaleString()} 
          icon={Zap} 
          trend="Live" 
          color="bg-purple-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h3 className="text-lg font-bold text-white mb-6">Activity Overview</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Bar dataKey="messages" fill="#db2777" radius={[4, 4, 0, 0]} />
                <Bar dataKey="users" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h3 className="text-lg font-bold text-white mb-6">Recent Broadcasts</h3>
          <div className="space-y-4">
             <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-pink-900/30 rounded-full flex items-center justify-center">
                    <Zap className="w-5 h-5 text-pink-500" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">System Ready</h4>
                    <p className="text-xs text-slate-400">Broadcasts will appear here</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-green-400 bg-green-900/20 px-2 py-1 rounded">Active</span>
              </div>
          </div>
          <button className="w-full mt-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors text-sm font-medium">
            View All Broadcasts
          </button>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ 
  title: string; 
  value: string; 
  icon: any; 
  trend: string; 
  color: string;
  isNegative?: boolean;
}> = ({ title, value, icon: Icon, trend, color, isNegative }) => (
  <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-lg ${color} bg-opacity-20`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
      <div className={`flex items-center space-x-1 text-sm font-medium ${isNegative ? 'text-red-400' : 'text-green-400'}`}>
        <span>{trend}</span>
        {isNegative ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
      </div>
    </div>
    <h3 className="text-3xl font-bold text-white mb-1">{value}</h3>
    <p className="text-slate-400 text-sm">{title}</p>
  </div>
);