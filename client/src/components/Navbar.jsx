import { Link } from 'react-router-dom';

export function ScissorsIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}

export default function Navbar({ right }) {
  return (
    <header className="navbar">
      <Link className="brand" to="/">
        <span className="brand-icon"><ScissorsIcon /></span>
        <span className="brand-name">Swift Tailoring</span>
      </Link>
      <div className="nav-right">{right}</div>
    </header>
  );
}
