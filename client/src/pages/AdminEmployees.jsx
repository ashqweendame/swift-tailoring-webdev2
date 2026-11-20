import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { ROLES } from '../lib/constants.js';
import { useDebounce } from '../lib/hooks.js';

const empId = (id) => `EMP-00${id}`;

function PasswordInput({ value, onChange, required, placeholder = '••••••••' }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="password-wrap">
      <input className="form-control" type={shown ? 'text' : 'password'} minLength={8} required={required} value={value} onChange={onChange} placeholder={placeholder} autoComplete="new-password" />
      <button type="button" className="password-toggle" onClick={() => setShown((s) => !s)} aria-label={shown ? 'Hide password' : 'Show password'}>{shown ? 'Hide' : 'Show'}</button>
    </div>
  );
}

function AddEmployee({ onCreated, onCancel }) {
  const toast = useToast();
  const [f, setF] = useState({ firstname: '', lastname: '', role: 'Tailor', email: '', phone: '', username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api('/employees', { method: 'POST', body: { ...f, username: f.username.trim() } });
      toast(r.message);
      onCreated(r.employee_id);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="detail-card">
      <div className="form-header-row">
        <div><h2 className="detail-title">Add New Employee</h2><p className="muted small">Fill out profile settings to build system credentials</p></div>
        <button type="button" className="btn-action muted-btn" onClick={onCancel}>Cancel</button>
      </div>
      <hr />
      <form onSubmit={submit}>
        <div className="split2">
          <div className="form-group"><label>First Name</label><input className="form-control" required value={f.firstname} onChange={set('firstname')} placeholder="e.g. John" /></div>
          <div className="form-group"><label>Last Name</label><input className="form-control" required value={f.lastname} onChange={set('lastname')} placeholder="e.g. Doe" /></div>
        </div>
        <div className="form-group"><label>Role</label>
          <select className="form-control" value={f.role} onChange={set('role')}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
        <div className="form-group"><label>Email Address</label><input className="form-control" type="email" required value={f.email} onChange={set('email')} placeholder="name@domain.com" /></div>
        <div className="form-group"><label>Phone Number</label><input className="form-control" required value={f.phone} onChange={set('phone')} placeholder="e.g. 09171234567" /></div>
        <div className="split2">
          <div className="form-group"><label>System Username</label><input className="form-control" required minLength={3} value={f.username} onChange={set('username')} placeholder="Unique username" autoComplete="off" /></div>
          <div className="form-group"><label>Password (min. 8 characters)</label><PasswordInput required value={f.password} onChange={set('password')} /></div>
        </div>
        <button className="btn-save" disabled={busy}>{busy ? 'Registering…' : 'Register New Employee'}</button>
      </form>
    </div>
  );
}

function Profile({ id, onSaved }) {
  const toast = useToast();
  const { user } = useAuth();
  const [emp, setEmp] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api(`/employees/${id}`).then(setEmp).catch((e) => toast(e.message, 'error')), [id, toast]);
  useEffect(() => { load(); }, [load]);
  if (!emp) return <div className="empty-pane"><p>Loading…</p></div>;

  const editing = !!draft;
  const v = (k) => (editing ? draft[k] : emp[k === 'status' ? 'employee_status' : k]);
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  const start = () => setDraft({ firstname: emp.firstname, lastname: emp.lastname, role: emp.role, email: emp.email, phone: emp.phone, status: emp.employee_status, password: '' });
  const isSelf = emp.employee_id === user.id;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/employees/${id}`, { method: 'PATCH', body: draft });
      toast('Update applied');
      setDraft(null);
      await load();
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="detail-card">
      <div className="form-header-row">
        <div><h2 className="detail-title">Staff Profile</h2><p className="muted small">{empId(emp.employee_id)} · @{emp.username}</p></div>
        {editing
          ? <button type="button" className="btn-action muted-btn" onClick={() => setDraft(null)}>Cancel</button>
          : <button type="button" className="btn-action" onClick={start}>✏️ Edit</button>}
      </div>
      <hr />
      <form onSubmit={save}>
        <div className="split2">
          <div className="form-group"><label>First Name</label><input className="form-control" required disabled={!editing} value={v('firstname')} onChange={set('firstname')} /></div>
          <div className="form-group"><label>Last Name</label><input className="form-control" required disabled={!editing} value={v('lastname')} onChange={set('lastname')} /></div>
        </div>
        <div className="form-group"><label>Employee Status</label>
          <select className="form-control" disabled={!editing || isSelf} value={v('status')} onChange={set('status')}><option>Active</option><option>Inactive</option></select></div>
        <div className="form-group"><label>Role</label>
          <select className="form-control" disabled={!editing || isSelf} value={v('role')} onChange={set('role')}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
        <div className="form-group"><label>Email Address</label><input className="form-control" type="email" required disabled={!editing} value={v('email')} onChange={set('email')} /></div>
        <div className="form-group"><label>Phone Number</label><input className="form-control" required disabled={!editing} value={v('phone')} onChange={set('phone')} /></div>
        {editing && (
          <div className="form-group"><label>Reset Password (leave blank to keep current)</label><PasswordInput value={draft.password} onChange={set('password')} placeholder="New password" /></div>
        )}
        {isSelf && editing && <p className="muted small">You can’t change your own role or status.</p>}
        {editing && <button className="btn-save" disabled={busy}>{busy ? 'Saving…' : 'Save Profile Updates'}</button>}
      </form>
    </div>
  );
}

export default function AdminEmployees() {
  const [sp, setSp] = useSearchParams();
  const selected = sp.get('employee');
  const adding = sp.get('mode') === 'add';
  const [filters, setFilters] = useState({ search: '', role: '', status: '' });
  const dSearch = useDebounce(filters.search, 300);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadList = useCallback(() => {
    const p = new URLSearchParams();
    if (dSearch) p.set('search', dSearch);
    if (filters.role) p.set('role', filters.role);
    if (filters.status) p.set('status', filters.status);
    setError('');
    return api(`/employees?${p}`).then(setList).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [dSearch, filters.role, filters.status]);
  useEffect(() => { loadList(); }, [loadList]);

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="split-view">
      <div className="left-pane">
        <div className="search-container">
          <div className="row between">
            <span className="pane-title">Staff Directory</span>
            <button className="link-btn" onClick={() => setSp({ mode: 'add' })}>+ Add Employee</button>
          </div>
          <input className="search-input" placeholder="Search name, username or ID" value={filters.search} onChange={set('search')} aria-label="Search employees" />
          <select className="filter-select" value={filters.role} onChange={set('role')} aria-label="Role filter">
            <option value="">All Roles</option>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
          <select className="filter-select" value={filters.status} onChange={set('status')} aria-label="Status filter">
            <option value="">Active only</option>
            <option value="Inactive">Inactive</option>
            <option value="all">All statuses</option>
          </select>
        </div>
        <div className="order-list">
          {loading && <p className="pane-note">Loading staff…</p>}
          {error && <p className="pane-note error">{error}</p>}
          {!loading && !error && list.length === 0 && <p className="pane-note">No matching staff entries found.</p>}
          {list.map((e) => (
            <button key={e.employee_id} className={`order-item ${!adding && String(e.employee_id) === selected ? 'active' : ''}`} onClick={() => setSp({ employee: e.employee_id })}>
              <div className="main">
                <h4>{e.firstname} {e.lastname}</h4>
                <p className="dark">Role: {e.role}</p>
                <span>{empId(e.employee_id)}</span>
              </div>
              <div className="meta"><span className={`badge ${e.employee_status === 'Active' ? 'status-active' : 'status-inactive'}`}>{e.employee_status}</span></div>
            </button>
          ))}
        </div>
      </div>
      <div className="right-pane">
        {adding
          ? <AddEmployee onCancel={() => setSp({})} onCreated={(id) => { setSp({ employee: id }); loadList(); }} />
          : selected
            ? <Profile key={selected} id={selected} onSaved={loadList} />
            : <div className="empty-pane"><h3>No staff profile selected</h3><p>Select an entry from the left pane to load profile options.</p></div>}
      </div>
    </div>
  );
}
