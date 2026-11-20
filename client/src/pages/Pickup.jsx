import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../components/Toast.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { api } from '../lib/api.js';
import { useDebounce } from '../lib/hooks.js';
import { clean, dateShort, peso } from '../lib/fmt.js';

export default function Pickup({ onClose, onPrint }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 300);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setError('');
    return api(`/orders/pickup?search=${encodeURIComponent(q)}`)
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [q]);
  useEffect(() => { load(); }, [load]);

  const collect = async (o) => {
    setBusyId(o.order_id);
    try {
      await api(`/orders/${o.order_id}/status`, { method: 'PATCH', body: { status: 'Collected' } });
      toast(`${o.order_code} marked as collected`);
      setConfirmId(null);
      await load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="pickup">
      <button className="modal-x" onClick={onClose} aria-label="Close pickup">×</button>
      <h2 className="form-title">Order Pickup</h2>
      <p className="center muted small">Orders appear here once the tailor marks them Ready.</p>
      <input className="input pickup-search" placeholder="Search order code, name or phone" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search ready orders" autoFocus />

      <div className="pickup-list">
        {loading && <p className="pane-note">Loading orders…</p>}
        {error && <p className="pane-note error">{error}</p>}
        {!loading && !error && orders.length === 0 && (
          <p className="pane-note">{q ? 'No ready orders match your search.' : 'No orders are waiting for pickup.'}</p>
        )}
        {orders.map((o) => (
          <div className="pickup-row" key={o.order_id}>
            <div className="pickup-main">
              <strong className="pickup-code">{o.order_code}</strong>
              <div>{o.customer}{o.phone ? ` · ${o.phone}` : ''}</div>
              <div className="small muted">{o.services} — {clean(o.suit_types)} · due {dateShort(o.due_date)}</div>
              <div className="pickup-badges"><StatusBadge status={o.status} overdue={o.overdue} /></div>
            </div>
            <div className="pickup-side">
              <div className="small muted">Amount due</div>
              <div className="pickup-amount">{peso(o.total)}</div>
              {confirmId === o.order_id ? (
                <div className="pickup-confirm">
                  <p className="small">Confirm you collected {peso(o.total)} and handed over the garment.</p>
                  <div className="row gap10">
                    <button className="btn btn-olive" disabled={busyId === o.order_id} onClick={() => collect(o)}>{busyId === o.order_id ? 'Saving…' : 'Confirm handover'}</button>
                    <button className="btn btn-outline-olive" onClick={() => setConfirmId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="row gap10">
                  <button className="btn btn-outline-olive" onClick={() => onPrint(o.order_id)}>Receipt</button>
                  <button className="btn btn-olive" onClick={() => setConfirmId(o.order_id)}>Mark as collected</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
