import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Timeline from '../components/Timeline.jsx';
import { api } from '../lib/api.js';
import { getSocket } from '../lib/socket.js';
import { clean, dateShort, peso } from '../lib/fmt.js';

const canNotify = () => typeof window !== 'undefined' && 'Notification' in window;

function browserNotify(code) {
  if (canNotify() && Notification.permission === 'granted') {
    new Notification('Swift Tailoring', { body: `Order ${code} is ready for pickup.` });
  }
}

export default function Track() {
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('code') || '');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [perm, setPerm] = useState(canNotify() ? Notification.permission : 'denied');
  const lastStatus = useRef(null);

  const lookup = useCallback(async (code, { silent = false } = {}) => {
    if (!silent) { setLoading(true); setError(''); }
    try {
      const data = await api(`/orders/track/${encodeURIComponent(code)}`);
      if (silent && lastStatus.current && lastStatus.current !== 'Ready' && data.status === 'Ready') browserNotify(data.order_code);
      lastStatus.current = data.status;
      setOrder(data);
    } catch (e) {
      if (!silent) { setOrder(null); lastStatus.current = null; setError(e.message); }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Open /?code=... links directly
  useEffect(() => {
    const code = params.get('code');
    if (code) lookup(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live updates: join the order's room, refetch whenever the API says it changed
  const code = order?.order_code;
  useEffect(() => {
    if (!code) return undefined;
    const socket = getSocket();
    const join = () => socket.emit('track', code);
    const onChanged = (p) => p.order_code === code && lookup(code, { silent: true });
    join();
    socket.on('connect', join);
    socket.on('order:changed', onChanged);
    return () => {
      socket.emit('untrack', code);
      socket.off('connect', join);
      socket.off('order:changed', onChanged);
    };
  }, [code, lookup]);

  const submit = (e) => {
    e.preventDefault();
    const c = input.trim();
    if (!c) return;
    setParams({ code: c });
    lookup(c);
  };

  const askPermission = async () => setPerm(await Notification.requestPermission());
  const open = order && !['Ready', 'Collected', 'Cancelled'].includes(order.status);

  return (
    <>
      <Navbar right={<a className="btn btn-primary btn-pill" href="/login">Login</a>} />

      <section className="hero">
        <div className="hero-content">
          <p className="hero-label">Swift Tailoring</p>
          <h1 className="hero-title">Track Your Order</h1>
          <p className="hero-sub">Enter the tracking code from your receipt to check the progress of your order.</p>
          <form className="search-box" onSubmit={submit}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter Tracking Code" autoComplete="off" aria-label="Tracking code" />
            <button className="btn-track" type="submit" disabled={loading}>{loading ? 'Searching…' : 'Track Order'}</button>
          </form>
          {error && <p className="search-error" role="alert">{error}</p>}
          <p className="search-hint">Try: TAI-KK4M-SW4, TAI-C4XR-NH2, ALT-XI9X-PB5</p>
        </div>
      </section>

      <div className="result-area">
        {!order && !loading && (
          <div className="placeholder-grid">
            <div className="expect-card"><strong>Assigned</strong><p>Your item has been logged and assigned to a tailor. Active alterations are underway.</p></div>
            <div className="expect-card"><strong>Ready</strong><p>Your item is ready for collection.</p></div>
            <div className="expect-card"><strong>Collected</strong><p>Your item is complete and collected.</p></div>
          </div>
        )}

        {order && (
          <div className="ticket-wrap">
            <div className="ticket">
              <div className="ticket-header">
                <div className="row between">
                  <div className="row gap10">
                    <span className="ticket-item-name">{clean(order.suit_type)}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <span className="muted-caps">Est. Pickup Date</span>
                </div>
                <div className="row between mt4">
                  <span className="ticket-code">{order.order_code}</span>
                  <span className="ticket-date">{dateShort(order.due_date)}</span>
                </div>
                <div className="row between ticket-sub">
                  <span className="muted">For {order.customer.firstname} {order.customer.lastname} · {order.service_type}</span>
                  <span className="small">Tailor: <strong>{order.tailor}</strong></span>
                </div>
              </div>

              <Timeline status={order.status} />

              {canNotify() && perm === 'default' && open && (
                <button className="btn btn-outline btn-block" onClick={askPermission}>Notify me when it's ready</button>
              )}

              <h2 className="garment-heading">Garment Summary</h2>
              <div className="garment-cards">
                {order.garments.map((g) => (
                  <div className="garment-card" key={g.garment_type}>
                    <div className="gc-garment">
                      <span className="gc-key">Garment</span>
                      <span className="gc-title">{clean(g.garment_type)}</span>
                    </div>
                    <div className="gc-attrs">
                      {g.fabric ? (
                        <>
                          <div><span className="gc-key">Color: </span>{clean(g.fabric.color)}</div>
                          <div><span className="gc-key">Pattern: </span>{clean(g.fabric.pattern)}</div>
                          <div><span className="gc-key">Material: </span>{clean(g.fabric.material)}</div>
                        </>
                      ) : g.components.map((c) => (
                        <div key={c.component}><span className="gc-key">{clean(c.component)}: </span>{c.measurement}</div>
                      ))}
                    </div>
                    <div className="gc-price">
                      <span className="gc-key">Price</span>
                      <span className="gc-pval">{peso(g.price)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="ticket-total">
                <span className="total-label">{order.status === 'Collected' ? 'Total Amount Paid' : 'Total Amount Due'}</span>
                <span className="total-value">{peso(order.total)}</span>
              </div>
            </div>

            <div className="contact-footer">
              <p className="contact-heading">Questions About Your Order?</p>
              <p className="muted">Please contact us with your <strong>Order #</strong> handy:</p>
              <p className="contact-line">09914362261 &nbsp;|&nbsp; support@swifttailoring.com</p>
              <div className="contact-brand">
                <p className="brand-script">Swift Tailoring</p>
                <p className="brand-tagline">Elegance In Motion</p>
                <p className="small muted">University of San Carlos, Talamban Campus</p>
                <p className="small muted">Hours: Mon-Fri 8AM-7PM | Sat 9AM-5PM</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
