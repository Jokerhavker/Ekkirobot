import React, { useState, useEffect } from 'react';
import { Search, MoreVertical, Ban, CheckCircle, Trash2, Loader2 } from 'lucide-react';
import { User } from '../types';

interface UserManagerProps {
  ownerId: string;
}

export const UserManager: React.FC<UserManagerProps> = ({ ownerId }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': ownerId },
        body: JSON.stringify({ action: 'get_users' })
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
    try {
      // Optimistic update
      setUsers(users.map(u => u.id === id ? { ...u, status: newStatus as any } : u));
      
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': ownerId },
        body: JSON.stringify({ 
          action: 'toggle_block',
          payload: { userId: id, status: newStatus }
        })
      });
    } catch (e) {
      console.error(e);
      // Revert if error
      fetchUsers();
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase()) || 
    u.firstName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
      <div className="p-6 border-b border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center space-x-3">
          <h2 className="text-xl font-bold text-white">User Management</h2>
          {isLoading && <Loader2 className="w-5 h-5 text-pink-500 animate-spin" />}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">User ID</th>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Joined/Seen</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {filteredUsers.length === 0 && !isLoading && (
               <tr>
                 <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                   No users found in database yet.
                 </td>
               </tr>
            )}
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-slate-700/30 transition-colors text-sm">
                <td className="px-6 py-4 text-slate-300 font-mono">{user.id}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold text-white">
                      {user.firstName[0]}
                    </div>
                    <div>
                      <p className="font-medium text-white">{user.firstName}</p>
                      <p className="text-xs text-slate-400">{user.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                  }`}>
                    {user.status === 'active' ? <CheckCircle className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                    <span className="capitalize">{user.status}</span>
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-400">{user.joinedAt}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <button 
                      onClick={() => toggleStatus(user.id, user.status)}
                      className={`p-2 rounded-lg transition-colors ${
                        user.status === 'active' 
                          ? 'text-red-400 hover:bg-red-900/20' 
                          : 'text-green-400 hover:bg-green-900/20'
                      }`}
                      title={user.status === 'active' ? 'Block User' : 'Unblock User'}
                    >
                      {user.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    </button>
                    <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};