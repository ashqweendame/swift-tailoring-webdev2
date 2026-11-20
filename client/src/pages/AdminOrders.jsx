import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge.jsx';
import { useToast } from '../components/Toast.jsx';
import { api } from '../lib/api.js';
import { STATUSES } from '../lib/constants.js';
import { useDebounce } from '../lib/hooks.js';
import { clean, peso, timeShort } from '../lib/fmt.js';

const groupItems = (items) => Object.entries(items.reduce((g, i) => { (g[i.garment_type] ||= []).push(i); return g; }, {}));

function OrderDetail({ id, tailors, onSaved }) {
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [draft, setDraft] = useState(null); // null = read-only
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api(`/orders/${id}`).then(setOrder).catch((e) => toast(e.message, 'error')), [id, toast]);
  useEffect(() => { load(); }, [load]);
  if (!order) return <div className="empty-pane"><p>Loading…</p></div>;

  const editing = !!draft;
  const start = () => setDraft({
    firstname: order.customer.firstname, lastname: order.customer.lastname, status: order.status, employee_id: String(order.employee_id),
    items: Object.fromEntries(order.items.map((i) => [i.id, { measurement: i.measurement, price: String(i.price) }])),
  });
  const setItem = (id2, patch) => setDraft((d) => ({ ...d, items: { ...d.items, [id2]: { ...d.items[id2], ...patch } } }));
  const liveTotal = editing ? Object.values(draft.items).reduce((s, i) => s + (parseFloat(i.price) || 0), 0) : order.total;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/orders/${id}`, {
        method: 'PATCH',
        body: {
          firstname: draft.firstname.trim(), lastname: draft.lastname.trim(), status: draft.status, employee_id: Number(draft.employee_id),
          items: order.items.map((i) => ({ id: i.id, measurement: draft.items[i.id].measurement.trim(), price: Number(draft.items[i.id].price) })),
        },
      });
      toast('Update applied');
      setDraft(null);
      await load();
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const tailorOptions = tailors.some((t) => t.employee_id === order.employee_id)
    ? tailors
    : [{ employee_id: order.employee_id, firstname: order.tailor_name, lastname: '(inactive)' }, ...tailors];

  return (
    <div className="detail-card">
      <div className="form-header-row">
        <div>
          <h2 className="detail-title">Order Ticket Record</h2>
          <p className="muted small">{order.order_code}</p>
        </div>
        {editing
          ? <button type="button" className="btn-action muted-btn" onClick={() => setDraft(null)}>Cancel</button>
          : <button type="button" className="btn-action" onClick={start}>✏️ Edit</button>}
      </div>
      <hr />
      <form onSubmit={save}>
        <div className="split2">
          <div className="form-group"><label>Customer First Name</label>
            <input className="form-control" required disabled={!editing} value={editing ? draft.firstname : order.customer.firstname} onChange={(e) => setDraft({ ...draft, firstname: e.target.value })} /></div>
          <div className="form-group"><label>Customer Last Name</label>
            <input className="form-control" required disabled={!editing} value={editing ? draft.lastname : order.customer.lastname} onChange={(e) => setDraft({ ...draft, lastname: e.target.value })} /></div>
        </div>

        <div className="section-label">Item-Line</div>
        <div className="items-box">
          {groupItems(order.items).map(([garment, items]) => (
            <div key={garment}>
              <div className="garment-label">Garment: {clean(garment)}</div>
              <div className="item-head"><div>Component</div><div>Measurement Specification</div><div>Price</div></div>
              {items.map((i) => (
                <div className="item-row" key={i.id}>
                  <div className="pill-tag" title={clean(i.component)}>{clean(i.component)}</div>
                  <input className="capsule" required disabled={!editing} value={editing ? draft.items[i.id].measurement : i.measurement} onChange={(e) => setItem(i.id, { measurement: e.target.value })} aria-label={`${i.component} measurement`} />
                  <input className="capsule" type="number" min="0" step="0.01" required disabled={!editing} value={editing ? draft.items[i.id].price : i.price} onChange={(e) => setItem(i.id, { price: e.target.value })} aria-label={`${i.component} price`} />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="form-group"><label>Order Ticket Status</label>
          <select className="form-control" disabled={!editing} value={editing ? draft.status : order.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select></div>
        <div className="form-group"><label>Assign Primary Tailor</label>
          <select className="form-control" disabled={!editing} value={editing ? draft.employee_id : order.employee_id} onChange={(e) => setDraft({ ...draft, employee_id: e.target.value })}>
            {tailorOptions.map((t) => <option key={t.employee_id} value={t.employee_id}>{t.firstname} {t.lastname}</option>)}
          </select></div>

        <div className="total-strip">
          <label>Aggregate Ticket Invoice Value Total</label>
          <strong>{peso(liveTotal)}</strong>
        </div>
        {editing && <button className="btn-save" disabled={saving}>{saving ? 'Saving…' : 'Apply Ticket Updates'}</button>}
      </form>
    </div>
  );
}

export default function AdminOrders() {
  const [sp, setSp] = useSearchParams();
  const selected = sp.get('order');
  const [filters, setFilters] = useState({ search: '', status: '', dateFilter: '', year: String(new Date().getFullYear()) });
  const dSearch = useDebounce(filters.search, 300);
  const [orders, setOrders] = useState([]);
  const [tailors, setTailors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (dSearch) p.set('search', dSearch);
    if (filters.status) p.set('status', filters.status);
    if (filters.dateFilter) p.set('dateFilter', filters.dateFilter);
    if (filters.dateFilter === 'yearly' && filters.year) p.set('year', filters.year);
    return p.toString();
  }, [dSearch, filters.status, filters.dateFilter, filters.year]);

  const loadList = useCallback(() => {
    setError('');
    return api(`/orders?${query}`).then(setOrders).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [query]);
  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { api('/employees/tailors').then(setTailors).catch(() => {}); }, []);

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const years = Array.from({ length: new Date().getFullYear() - 2019 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="split-view">
      <div className="left-pane">
        <div className="search-container">
          <input className="search-input" placeholder="Search customer or order code" value={filters.search} onChange={set('search')} aria-label="Search orders" />
          <select className="filter-select" value={filters.status} onChange={set('status')} aria-label="Status filter">
            <option value="">All Status</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="filter-select" value={filters.dateFilter} onChange={set('dateFilter')} aria-label="Date filter">
            <option value="">All Dates</option>
            <option value="daily">Today</option>
            <option value="weekly">This Week</option>
            <option value="monthly">This Month</option>
            <option value="yearly">Specific Year</option>
          </select>
          {filters.dateFilter === 'yearly' && (
            <select className="filter-select" value={filters.year} onChange={set('year')} aria-label="Year">
              {years.map((y) => <option key={y}>{y}</option>)}
            </select>
          )}
        </div>
        <div className="order-list">
          {loading && <p className="pane-note">Loading orders…</p>}
          {error && <p className="pane-note error">{error}</p>}
          {!loading && !error && orders.length === 0 && <p className="pane-note">No matching entries.</p>}
          {orders.map((o) => (
            <button key={o.order_id} className={`order-item ${String(o.order_id) === selected ? 'active' : ''}`} onClick={() => setSp({ order: o.order_id })}>
              <div className="main">
                <h4>{o.customer}</h4>
                <p>{o.services} — {clean(o.suit_types)}</p>
                <span>{o.order_code}</span>
              </div>
              <div className="meta"><div>{timeShort(o.created_at)}</div><StatusBadge status={o.status} overdue={o.overdue} /></div>
            </button>
          ))}
        </div>
      </div>
      <div className="right-pane">
        {selected
          ? <OrderDetail key={selected} id={selected} tailors={tailors} onSaved={loadList} />
          : <div className="empty-pane"><h3>No item selected</h3><p>Select an entry from the left pane to view details.</p></div>}
      </div>
    </div>
  );
}
