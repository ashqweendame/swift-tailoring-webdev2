import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Modal from '../components/Modal.jsx';
import Receipt from '../components/Receipt.jsx';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import OrderForm from './OrderForm.jsx';
import Pickup from './Pickup.jsx';

const IMG = {
  hero: 'https://images.pexels.com/photos/6065984/pexels-photo-6065984.jpeg',
  suits: 'https://images.pexels.com/photos/1545348/pexels-photo-1545348.jpeg',
  about: 'https://images.pexels.com/photos/31517347/pexels-photo-31517347.jpeg',
};
const CATALOG = [
  { name: 'Black Tuxedo', price: '₱5,000', img: 'https://images.pexels.com/photos/27691960/pexels-photo-27691960.jpeg' },
  { name: 'Navy Plain Wool', price: '₱4,000', img: 'https://images.pexels.com/photos/4246645/pexels-photo-4246645.jpeg' },
  { name: 'Brown Plain Wool', price: '₱6,500', img: 'https://plus.unsplash.com/premium_photo-1760612414300-4a1e49a8cae5?q=80&w=735&auto=format&fit=crop' },
];

function Card({ img, title, sub, actions, large }) {
  return (
    <section className={`dash-card ${large ? 'large' : ''}`} style={{ backgroundImage: `url('${img}')` }}>
      <div className="purple-overlay" />
      <div className="dash-card-content">
        <h2>{title}</h2>
        <p>{sub}</p>
        {actions.map((a) => <button key={a.label} className="action-btn" onClick={a.onClick}>{a.label}</button>)}
      </div>
    </section>
  );
}

export default function Service() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [created, setCreated] = useState(null); // { order_code, order_id }
  const [formKey, setFormKey] = useState(0);
  const [receipt, setReceipt] = useState(null);

  // Load the order, render the hidden receipt, then open the browser print dialog.
  const printReceipt = async (orderId) => {
    try { setReceipt(await api(`/orders/${orderId}`)); }
    catch (e) { toast(e.message, 'error'); }
  };
  useEffect(() => {
    if (!receipt) return undefined;
    const done = () => setReceipt(null);
    window.addEventListener('afterprint', done);
    const t = setTimeout(() => window.print(), 100);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [receipt]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(created.order_code); toast('Order code copied'); }
    catch { toast('Couldn’t copy. Select the code and copy it manually.', 'error'); }
  };

  return (
    <div className="service-page">
      <Navbar right={
        <>
          <span className="small muted hide-sm">{user.firstname} {user.lastname}</span>
          <button className="btn btn-primary btn-pill" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
        </>
      } />

      <main className="dash-grid">
        <Card large img={IMG.hero} title="SWIFT TAILORING" sub="Elegance in Motion"
          actions={[{ label: 'CREATE ORDER', onClick: () => setModal('order') }, { label: 'ORDER PICKUP', onClick: () => setModal('pickup') }]} />
        <Card img={IMG.suits} title="SUITS" sub="Classic Style and Formal Statements" actions={[{ label: 'DISCOVER MORE', onClick: () => setModal('suits') }]} />
        <Card img={IMG.about} title="ABOUT US" sub="Get in Touch with Our Workshop Terminal" actions={[{ label: 'CONTACT US', onClick: () => setModal('about') }]} />
      </main>

      {modal === 'suits' && (
        <Modal className="catalog-card" onClose={() => setModal(null)}>
          <div className="catalog-grid">
            {CATALOG.map((c) => (
              <div className="catalog-item" key={c.name}>
                <img src={c.img} alt={c.name} />
                <h3>{c.name}</h3>
                <p>{c.price}</p>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {modal === 'about' && (
        <Modal className="about-card" onClose={() => setModal(null)}>
          <h2 className="about-title">ABOUT US</h2>
          <table className="about-table"><tbody>
            <tr><td>Email:</td><td>swifttailoring@gmail.com</td></tr>
            <tr><td>Phone:</td><td>63+ 991 436 2261</td></tr>
            <tr><td>Address:</td><td>Unit 67, 14<sup>th</sup> Avenue St., Brgy. Talamban,<br />Mandaue City, 6014 Cebu, Philippines</td></tr>
          </tbody></table>
        </Modal>
      )}

      {modal === 'order' && (
        <Modal className="order-modal" persistent>
          <OrderForm key={formKey} onClose={() => setModal(null)} onCreated={(c) => { setModal(null); setCreated(c); }} />
        </Modal>
      )}

      {modal === 'pickup' && (
        <Modal className="pickup-modal" onClose={() => setModal(null)}>
          <Pickup onClose={() => setModal(null)} onPrint={printReceipt} />
        </Modal>
      )}

      {created && (
        <Modal className="success-modal" persistent>
          <h2>Order Created Successfully</h2>
          <p className="muted">Please provide this Order Code to the customer.</p>
          <div className="code-row">
            <input readOnly value={created.order_code} aria-label="Order code" onFocus={(e) => e.target.select()} />
            <button className="btn btn-primary" onClick={copy}>Copy</button>
          </div>
          <button className="btn btn-outline-olive" onClick={() => printReceipt(created.order_id)}>Print receipt</button>
          <button className="btn btn-olive" onClick={() => { setCreated(null); setFormKey((k) => k + 1); setModal('order'); }}>✔ Done</button>
        </Modal>
      )}

      {receipt && <Receipt order={receipt} />}
    </div>
  );
}
