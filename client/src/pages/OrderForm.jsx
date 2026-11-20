import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { clean, peso, todayISO } from '../lib/fmt.js';
import { COLORS, COMPONENTS, MATERIALS, PATTERNS, SUIT_GARMENTS, SUIT_TYPES } from '../lib/constants.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function Field({ id, label, error, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

const allKeys = (suit) => SUIT_GARMENTS[suit].flatMap((g) => COMPONENTS[g].map((c) => `${g}:${c}`));

export default function OrderForm({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState({ firstname: '', lastname: '', email: '', phone: '' });
  const [serviceType, setServiceType] = useState('Alteration');
  const [suitType, setSuitType] = useState('Single_Jacket');
  const [fabric, setFabric] = useState({ color: 'Navy', pattern: 'Plain', material: 'Wool' });
  const [selected, setSelected] = useState(() => allKeys('Single_Jacket'));
  const [lines, setLines] = useState({});
  const [pickup, setPickup] = useState('');
  const [tailorId, setTailorId] = useState('');
  const [tailors, setTailors] = useState([]);
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const today = todayISO();

  useEffect(() => {
    api('/employees/tailors')
      .then((t) => { setTailors(t); if (t[0]) setTailorId(String(t[0].employee_id)); })
      .catch((e) => setServerError(e.message));
  }, []);

  // Selected components in canonical order
  const rows = useMemo(
    () => SUIT_GARMENTS[suitType].flatMap((g) => COMPONENTS[g].map((c) => `${g}:${c}`)).filter((k) => selected.includes(k)),
    [suitType, selected]
  );
  const total = rows.reduce((s, k) => {
    const p = parseFloat(lines[k]?.price);
    return s + (Number.isFinite(p) && p > 0 ? p : 0);
  }, 0);

  const e1 = {};
  if (!customer.firstname.trim()) e1.firstname = 'Required';
  if (!customer.lastname.trim()) e1.lastname = 'Required';
  if (!EMAIL_RE.test(customer.email.trim())) e1.email = 'Enter a valid email address';
  if (!/^09\d{9}$/.test(customer.phone)) e1.phone = 'Use an 11-digit number: 09XXXXXXXXX';

  const e2 = {};
  if (!pickup) e2.pickup = 'Choose a date';
  else if (pickup < today) e2.pickup = 'Date can’t be in the past';
  if (!tailorId) e2.tailor = 'Choose a tailor';
  if (rows.length === 0) e2.rows = 'Select at least one component';
  rows.forEach((k) => {
    if (!lines[k]?.measurement?.trim()) e2[`${k}:m`] = 'Required';
    if (!(parseFloat(lines[k]?.price) >= 0)) e2[`${k}:p`] = 'Required';
  });

  const show = (field, errs) => ((touched[field] || attempted) && errs[field]) || '';
  const touch = (f) => setTouched((t) => ({ ...t, [f]: true }));
  const setC = (f, v) => setCustomer((c) => ({ ...c, [f]: v }));
  const setLine = (k, patch) => setLines((l) => ({ ...l, [k]: { measurement: '', price: '', ...l[k], ...patch } }));
  const toggle = (k) => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const chooseSuit = (v) => { setSuitType(v); setSelected(allKeys(v)); };

  const next = () => {
    setAttempted(true);
    if (Object.keys(e1).length) return;
    setAttempted(false);
    setStep(2);
  };

  const submit = async () => {
    setAttempted(true);
    if (Object.keys(e2).length) return;
    setBusy(true);
    setServerError('');
    try {
      const body = {
        firstname: customer.firstname.trim(),
        lastname: customer.lastname.trim(),
        email: customer.email.trim(),
        phone: customer.phone,
        service_type: serviceType,
        suit_type: suitType,
        est_pickup_date: pickup,
        employee_id: Number(tailorId),
        items: rows.map((k) => {
          const [garment_type, component] = k.split(':');
          return { garment_type, component, measurement: lines[k].measurement.trim(), price: Number(lines[k].price) };
        }),
      };
      if (serviceType === 'Tailoring') Object.assign(body, { fabric_color: fabric.color, fabric_pattern: fabric.pattern, fabric_material: fabric.material });
      const { order_code, order_id } = await api('/orders', { method: 'POST', body });
      onCreated({ order_code, order_id });
    } catch (e) {
      setServerError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="order-form">
      <button className="modal-x" onClick={onClose} aria-label="Close order form">×</button>
      <span className="page-indicator">Page {step}</span>
      <h2 className="form-title">Order Form</h2>
      <div className="center"><span className="form-badge">{step === 1 ? 'Customer Details' : `${serviceType} Details`}</span></div>

      {step === 1 && (
        <div className="order-page one">
          <div className="customer-fields">
            <Field id="firstname" error={show('firstname', e1)} label="First Name">
              <input id="firstname" className="input pill" value={customer.firstname} onChange={(e) => setC('firstname', e.target.value)} onBlur={() => touch('firstname')} placeholder="First Name" />
            </Field>
            <Field id="lastname" error={show('lastname', e1)} label="Last Name">
              <input id="lastname" className="input pill" value={customer.lastname} onChange={(e) => setC('lastname', e.target.value)} onBlur={() => touch('lastname')} placeholder="Last Name" />
            </Field>
            <Field id="email" error={show('email', e1)} label="Email Address">
              <input id="email" type="email" className="input pill" value={customer.email} onChange={(e) => setC('email', e.target.value)} onBlur={() => touch('email')} placeholder="example@mail.com" />
            </Field>
            <Field id="phone" error={show('phone', e1)} label="Phone Number">
              <input id="phone" inputMode="numeric" maxLength={11} className="input pill" value={customer.phone} onChange={(e) => setC('phone', e.target.value.replace(/\D/g, ''))} onBlur={() => touch('phone')} placeholder="09XXXXXXXXX" />
            </Field>
            <div>
              <div className="toggle-pair">
                {['Alteration', 'Tailoring'].map((s) => (
                  <button key={s} type="button" className={`chip ${serviceType === s ? 'active' : ''}`} onClick={() => setServiceType(s)}>{s}</button>
                ))}
              </div>
              <span className="small purple">Service</span>
            </div>
          </div>
          <div className="center"><button className="btn btn-olive" onClick={next}>Next</button></div>
        </div>
      )}

      {step === 2 && (
        <div className="order-page two">
          <div className="two-cols">
            <div className="left-panel">
              <span className="panel-label">Suit Type</span>
              <div className="chip-row">
                {SUIT_TYPES.map((s) => (
                  <button key={s.value} type="button" className={`chip sm ${suitType === s.value ? 'active' : ''}`} onClick={() => chooseSuit(s.value)}>{s.label}</button>
                ))}
              </div>

              {serviceType === 'Tailoring' && (
                <>
                  <span className="panel-label">Color</span>
                  <div className="chip-row">
                    {COLORS.map((c) => (
                      <button key={c.value} type="button" title={c.value} aria-label={c.value} aria-pressed={fabric.color === c.value}
                        className={`color-bubble ${fabric.color === c.value ? 'active' : ''}`} style={{ background: c.hex }}
                        onClick={() => setFabric({ ...fabric, color: c.value })} />
                    ))}
                  </div>
                  <span className="panel-label">Pattern</span>
                  <div className="chip-row">
                    {PATTERNS.map((p) => (
                      <button key={p} type="button" className={`attr ${fabric.pattern === p ? 'active' : ''}`} onClick={() => setFabric({ ...fabric, pattern: p })}>{clean(p)}</button>
                    ))}
                  </div>
                  <span className="panel-label">Material</span>
                  <div className="chip-row">
                    {MATERIALS.map((m) => (
                      <button key={m} type="button" className={`attr ${fabric.material === m ? 'active' : ''}`} onClick={() => setFabric({ ...fabric, material: m })}>{clean(m)}</button>
                    ))}
                  </div>
                </>
              )}

              <span className="panel-label">Garment Components and Service Rates</span>
              <div className="comp-grid">
                {SUIT_GARMENTS[suitType].flatMap((g) => COMPONENTS[g].map((c) => {
                  const k = `${g}:${c}`;
                  return <button key={k} type="button" className={`chip sm ${selected.includes(k) ? 'active' : ''}`} onClick={() => toggle(k)}>{clean(c)}</button>;
                }))}
              </div>
              {attempted && e2.rows && <span className="field-error">{e2.rows}</span>}

              <div className="split2">
                <div className="field">
                  <label htmlFor="pickup" className="center-label">Estimated Pick-up Date</label>
                  <input id="pickup" type="date" min={today} className="input" value={pickup} onChange={(e) => setPickup(e.target.value)} onBlur={() => touch('pickup')} />
                  {show('pickup', e2) && <span className="field-error">{show('pickup', e2)}</span>}
                </div>
                <div className="field">
                  <label htmlFor="tailor" className="center-label">Assigned Tailor</label>
                  <select id="tailor" className="input" value={tailorId} onChange={(e) => setTailorId(e.target.value)}>
                    {tailors.map((t) => <option key={t.employee_id} value={t.employee_id}>{t.firstname} {t.lastname} (Tailor)</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="right-panel">
              <span className="panel-label">Item-Line</span>
              {SUIT_GARMENTS[suitType].map((g) => {
                const gRows = rows.filter((k) => k.startsWith(`${g}:`));
                if (!gRows.length) return null;
                return (
                  <div key={g} className="spec-group">
                    <div className="spec-head">GARMENT: <strong>{g.toUpperCase()}</strong></div>
                    <div className="spec-cols muted small"><span>Component</span><span>Measurement Specification</span><span>Price</span></div>
                    {gRows.map((k) => {
                      const c = k.split(':')[1];
                      const l = lines[k] || {};
                      return (
                        <div className="spec-row" key={k}>
                          <div className="comp-badge">{clean(c)}</div>
                          <input className={`input pill sm ${attempted && e2[`${k}:m`] ? 'invalid' : ''}`} value={l.measurement || ''} onChange={(e) => setLine(k, { measurement: e.target.value })} placeholder="Value" aria-label={`${c} measurement`} />
                          <input className={`input pill sm ${attempted && e2[`${k}:p`] ? 'invalid' : ''}`} type="number" min="0" step="0.01" value={l.price ?? ''} onChange={(e) => setLine(k, { price: e.target.value })} placeholder="Price" aria-label={`${c} price`} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {serverError && <div className="error-banner tight" role="alert">{serverError}</div>}
          <div className="form-footer">
            <button className="btn btn-outline-olive" onClick={() => { setAttempted(false); setStep(1); }}>← Back</button>
            <div className="total-box"><span className="total-text">Total Price:</span><span className="total-badge">{peso(total)}</span></div>
            <button className="btn btn-olive" onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create Order'}</button>
          </div>
        </div>
      )}
      {step === 1 && serverError && <div className="error-banner tight" role="alert">{serverError}</div>}
    </div>
  );
}
