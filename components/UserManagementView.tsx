import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Edit, Trash2, Shield, Eye, EyeOff, Search, RefreshCw, Key } from 'lucide-react';
import { TeamMember, UserSession } from '../types';
import { dashboardTheme } from '../utils/dashboardTheme';
import { useAuth } from '../AuthContext';

interface UserManagementViewProps {
  team: TeamMember[];
  currentSession: UserSession;
}

interface ApiUser {
  id:          string;
  name:        string;
  email:       string;
  role:        string;
  accessLevel: string;
  department:  string;
  initials:    string;
  color:       string;
  isActive:    boolean;
  createdAt:   string;
}

interface UserFormState {
  name:        string;
  email:       string;
  password:    string;
  role:        string;
  accessLevel: string;
  department:  string;
  initials:    string;
  color:       string;
}

const BLANK_FORM: UserFormState = {
  name: '', email: '', password: '', role: 'MCO Case Manager',
  accessLevel: 'user', department: '', initials: '', color: 'bg-teal-600',
};

const ROLE_OPTIONS = [
  'Admin', 'State Lead MCO Supervisor', 'MCO Case Manager',
  'Care Navigator', 'Clinical Coordinator', 'CHW', 'Doula', 'Midwife', 'MD', 'Specialist',
];

const ACCESS_LEVEL_OPTIONS = [
  { value: 'user',       label: 'User'       },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'admin',      label: 'Admin'      },
];

const COLOR_OPTIONS = [
  'bg-teal-600', 'bg-teal-700', 'bg-slate-700', 'bg-stone-700',
  'bg-sky-700', 'bg-indigo-600', 'bg-violet-700', 'bg-rose-700',
];

const UserManagementView: React.FC<UserManagementViewProps> = ({ currentSession }) => {
  const palette = dashboardTheme;
  const { token } = useAuth();

  const [users,       setUsers]       = useState<ApiUser[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [apiError,    setApiError]    = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');

  // Modal state
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [editingUser,   setEditingUser]   = useState<ApiUser | null>(null);
  const [formState,     setFormState]     = useState<UserFormState>(BLANK_FORM);
  const [formError,     setFormError]     = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [showPw,        setShowPw]        = useState(false);

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }), [token]);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setApiError('');
    try {
      const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load users');
      setUsers(await res.json());
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const openAddModal = () => {
    setFormState(BLANK_FORM);
    setFormError('');
    setShowPw(false);
    setShowAddModal(true);
    setEditingUser(null);
  };

  const openEditModal = (user: ApiUser) => {
    setFormState({
      name: user.name, email: user.email, password: '',
      role: user.role, accessLevel: user.accessLevel,
      department: user.department, initials: user.initials, color: user.color,
    });
    setFormError('');
    setShowPw(false);
    setEditingUser(user);
    setShowAddModal(false);
  };

  const closeModal = () => { setShowAddModal(false); setEditingUser(null); };

  const handleCreate = async () => {
    if (!formState.name || !formState.email || !formState.password || !formState.role) {
      setFormError('Name, email, password and role are required.'); return;
    }
    setFormError(''); setFormSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify(formState),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      await loadUsers();
      closeModal();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    setFormError(''); setFormSubmitting(true);
    const payload: Partial<UserFormState> = { ...formState };
    if (!payload.password) delete payload.password;      // don't send empty pw
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      await loadUsers();
      closeModal();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) return;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Delete failed');
      await loadUsers();
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const isAdmin = currentSession.accessLevel === 'admin';

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-red-100 text-red-800';
      case 'State Lead MCO Supervisor': return 'bg-purple-100 text-purple-800';
      case 'MCO Case Manager': return 'bg-teal-100 text-teal-800';
      case 'Care Navigator': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // ── Reusable form fields ────────────────────────────────────────────────────
  const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );

  const inputClass = 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

  const renderModal = (isNew: boolean) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-slate-900 mb-5">
          {isNew ? 'Add New User' : 'Edit User'}
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Full Name">
              <input type="text" value={formState.name} onChange={e => setFormState(p => ({ ...p, name: e.target.value }))} className={inputClass} placeholder="Dr. Jane Smith" />
            </FormField>
            <FormField label="Initials">
              <input type="text" maxLength={2} value={formState.initials} onChange={e => setFormState(p => ({ ...p, initials: e.target.value.toUpperCase() }))} className={inputClass} placeholder="JS" />
            </FormField>
          </div>

          <FormField label="Email Address">
            <input type="email" value={formState.email} onChange={e => setFormState(p => ({ ...p, email: e.target.value }))} className={inputClass} placeholder="jane@example.com" />
          </FormField>

          <FormField label={isNew ? 'Password' : 'New Password (leave blank to keep)'}>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={formState.password}
                onChange={e => setFormState(p => ({ ...p, password: e.target.value }))}
                className={inputClass + ' pr-10'}
                placeholder={isNew ? 'Min 6 characters' : '••••••••'}
              />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Role">
              <select value={formState.role} onChange={e => setFormState(p => ({ ...p, role: e.target.value }))} className={inputClass}>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </FormField>
            <FormField label="Access Level">
              <select value={formState.accessLevel} onChange={e => setFormState(p => ({ ...p, accessLevel: e.target.value }))} className={inputClass}>
                {ACCESS_LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FormField>
          </div>

          <FormField label="Department">
            <input type="text" value={formState.department} onChange={e => setFormState(p => ({ ...p, department: e.target.value }))} className={inputClass} placeholder="Clinical Operations" />
          </FormField>

          <FormField label="Avatar Color">
            <div className="flex flex-wrap gap-2 mt-1">
              {COLOR_OPTIONS.map(c => (
                <button key={c} type="button" onClick={() => setFormState(p => ({ ...p, color: c }))}
                  className={`w-7 h-7 rounded-full ${c} ${formState.color === c ? 'ring-2 ring-offset-1 ring-slate-700' : ''}`}
                />
              ))}
            </div>
          </FormField>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={isNew ? handleCreate : handleUpdate}
              disabled={formSubmitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-60"
            >
              {formSubmitting
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : isNew ? <UserPlus className="w-4 h-4" /> : <Edit className="w-4 h-4" />
              }
              {isNew ? 'Create User' : 'Save Changes'}
            </button>
            <button onClick={closeModal} className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="flex-1 p-6 overflow-y-auto"
      style={{ background: `linear-gradient(170deg, ${palette.surface} 0%, #f2ece1 50%, #edf3ef 100%)` }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-6 h-6 text-teal-600" />
                User Management
              </h1>
              <p className="text-slate-600 mt-1">Manage system users, roles and permissions</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadUsers} className="flex items-center gap-1 px-3 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm">
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
              {isAdmin && (
                <button onClick={openAddModal} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
                  <UserPlus className="w-4 h-4" /> Add User
                </button>
              )}
            </div>
          </div>
        </div>

        {/* API error banner */}
        {apiError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{apiError}</div>
        )}

        {/* Filters */}
        <div className="rounded-lg shadow-sm border p-4 mb-6 flex flex-col md:flex-row gap-4" style={{ backgroundColor: palette.card, borderColor: palette.border }}>
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email or role…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="md:w-52">
            <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="all">All Roles</option>
              {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="rounded-lg shadow-sm border overflow-hidden" style={{ backgroundColor: palette.card, borderColor: palette.border }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="w-8 h-8 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Access</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    {isAdmin && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500 text-sm">No users found</td>
                    </tr>
                  ) : filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full ${user.color} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                            {user.initials || user.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900">{user.name}</div>
                            <div className="text-xs text-slate-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                          user.accessLevel === 'admin'      ? 'bg-red-100 text-red-800'    :
                          user.accessLevel === 'supervisor' ? 'bg-purple-100 text-purple-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          <Shield className="w-3 h-3" />
                          {user.accessLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{user.department || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEditModal(user)} className="text-teal-600 hover:text-teal-900" title="Edit">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => openEditModal({ ...user, password: '' } as ApiUser)} className="text-amber-500 hover:text-amber-700" title="Reset password">
                              <Key className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(user.id)} className="text-red-500 hover:text-red-700" title="Deactivate">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modals */}
        {showAddModal  && renderModal(true)}
        {editingUser   && renderModal(false)}
      </div>
    </div>
  );
};

export default UserManagementView;