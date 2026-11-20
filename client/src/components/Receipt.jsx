import { clean, dateShort, peso } from '../lib/fmt.js';

// Hidden on screen; shown only when printing (see @media print in styles.css).
export default function Receipt({ order }) {
  const link = `${window.location.origin}/?code=${encodeURIComponent(order.order_code)}`;
  return (
    <div className="receipt">
      <h1>Swift Tailoring</h1>
      <p className="r-center">Elegance In Motion</p>
      <p className="r-center r-small">University of San Carlos, Talamban Campus<br />Mon-Fri 8AM-7PM | Sat 9AM-5PM</p>
      <hr />
      <p className="r-center r-small">Order code</p>
      <p className="r-code">{order.order_code}</p>
      <p className="r-center r-small">Keep this code. You will need it to track and collect your order.</p>
      <hr />
      <table className="r-meta"><tbody>
        <tr><td>Customer</td><td>{order.customer.firstname} {order.customer.lastname}</td></tr>
        <tr><td>Phone</td><td>{order.customer.phone}</td></tr>
        <tr><td>Service</td><td>{order.service_type} · {clean(order.suit_type)}</td></tr>
        {order.fabric && <tr><td>Fabric</td><td>{order.fabric.color}, {clean(order.fabric.pattern)} {clean(order.fabric.material)}</td></tr>}
        <tr><td>Tailor</td><td>{order.tailor_name}</td></tr>
        <tr><td>Est. pickup</td><td>{dateShort(order.due_date)}</td></tr>
      </tbody></table>
      <hr />
      <table className="r-items"><tbody>
        {order.items.map((i) => (
          <tr key={i.id}>
            <td>{clean(i.garment_type)} · {clean(i.component)}<br /><span className="r-small">{i.measurement}</span></td>
            <td className="r-right">{peso(i.price)}</td>
          </tr>
        ))}
      </tbody></table>
      <hr />
      <p className="r-total"><span>Total</span><span>{peso(order.total)}</span></p>
      <hr />
      <p className="r-center r-small">Track your order online:<br />{link}</p>
    </div>
  );
}
