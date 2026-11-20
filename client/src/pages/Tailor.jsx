import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Shell from '../components/Shell.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useToast } from '../components/Toast.jsx';
import { api } from '../lib/api.js';
import { TAILOR_TRANSITIONS } from '../lib/constants.js';
import { clean, dateShort, peso } from '../lib/fmt.js';

function groupItems(items) {
  const g = {};
  items.forEach((i) => { (g[i.garment_type] ||= []).push(i); });
  return Object.entries(g);
}

function TaskDetail({ id, onChanged }) {
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api(`/orders/${id}`).then(setOrder).catch((e) => toast(e.message, 'error')), [id, toast]);
  useEffect(() => { load(); }, [load]);

  if (!order) return <div className="empty-pane"><p>Loading…</p></div>;

  const options = [order.status, ...TAILOR_TRANSITIONS[order.status]];
  const change = async (status) => {
    setSaving(true);
    try {
      await api(`/orders/${id}/status`, { method: 'PATCH', body: { status } });
      toast(`Status set to ${status}`);
      await load();
      onChanged();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="detail-card">
      <div className="form-header-row">
        <div>
          <h2 className="detail-title">Task Details</h2>
          <p className="muted small">Order Code: {order.order_code}</p>
          {order.status === 'Ready' && <p className="small purple">Waiting for pickup at the service desk.</p>}
          {order.overdue && <p className="small danger-text">Past its estimated pickup date.</p>}
        </div>
        <select className="status-select" value={order.status} disabled={saving || options.length === 1} onChange={(e) => change(e.target.value)} aria-label="Order status">
          {options.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <hr />
      <div className="split2">
        <div className="form-group"><label>Customer Name</label><input className="form-control" disabled value={`${order.customer.firstname} ${order.customer.lastname}`} /></div>
        <div className="form-group"><label>Contact Info</label><input className="form-control" disabled value={`${order.customer.email} | ${order.customer.phone}`} /></div>
      </div>

      <div className="section-label">Garment Specifications</div>
      <div className="split2 mb">
        <div className="form-group"><label>Suit Type</label><input className="form-control" disabled value={clean(order.suit_type)} /></div>
        {order.fabric && (
          <div className="form-group"><label>Fabric Detail</label><input className="form-control" disabled value={`${order.fabric.color}, ${clean(order.fabric.pattern)} ${clean(order.fabric.material)}`} /></div>
        )}
      </div>

      <div className="section-label">Recorded Measurements</div>
      <div className="items-box">
        {groupItems(order.items).map(([garment, items]) => (
          <div key={garment}>
            <div className="garment-label">Garment: {clean(garment)}</div>
            <div className="item-head"><div>Component</div><div>Measurement Specification</div><div>Price (₱)</div></div>
            {items.map((i) => (
              <div className="item-row" key={i.id}>
                <div className="pill-tag" title={clean(i.component)}>{clean(i.component)}</div>
                <input className="capsule bold" disabled value={i.measurement} />
                <input className="capsule" disabled value={peso(i.price)} />
              </div>
            ))}
            <hr className="dashed" />
          </div>
        ))}
      </div>

      <div className="summary-strip">
        <div><label>Due Date</label><strong>{dateShort(order.due_date)}</strong></div>
        <div className="right"><label className="purple">Service Price</label><strong className="purple big">{peso(order.total)}</strong></div>
      </div>
    </div>
  );
}

export default function Tailor() {
  const [sp, setSp] = useSearchParams();
  const selected = sp.get('order');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadList = useCallback(() => api('/orders').then(setTasks).catch((e) => setError(e.message)).finally(() => setLoading(false)), []);
  useEffect(() => { loadList(); }, [loadList]);

  return (
    <Shell nav={[{ to: '/tailor', label: 'My Tasks', badge: tasks.length, end: true }]}>
      <div className="split-view">
        <div className="left-pane">
          <div className="pane-head">Active Assignments</div>
          <div className="order-list">
            {loading && <p className="pane-note">Loading tasks…</p>}
            {error && <p className="pane-note error">{error}</p>}
            {!loading && !error && tasks.length === 0 && <div className="empty-pane small-pad"><h3>No tasks</h3><p>You have no active assignments.</p></div>}
            {tasks.map((t) => (
              <button key={t.order_id} className={`order-item ${String(t.order_id) === selected ? 'active' : ''}`} onClick={() => setSp({ order: t.order_id })}>
                <div className="main">
                  <h4>{t.customer}</h4>
                  <p>{t.services} — {clean(t.suit_types)}</p>
                  <span>{t.order_code}</span>
                </div>
                <div className="meta">
                  <div className="strong">Due: {dateShort(t.due_date).replace(/, \d{4}/, '')}</div>
                  <StatusBadge status={t.status} overdue={t.overdue} />
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="right-pane">
          {selected
            ? <TaskDetail key={selected} id={selected} onChanged={loadList} />
            : <div className="empty-pane"><h3>No task selected</h3><p>Select a task assignment from the left pane to view details and update statuses.</p></div>}
        </div>
      </div>
    </Shell>
  );
}
