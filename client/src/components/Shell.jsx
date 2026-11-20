import { NavLink, useNavigate } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import { useAuth } from '../lib/auth.jsx';
import { initials } from '../lib/fmt.js';

// Navbar + sidebar frame used by the tailor and admin workspaces.
export default function Shell({ nav, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const out = () => { logout(); navigate('/login'); };

  return (
    <div className="app">
      <Navbar right={<button className="btn btn-primary btn-pill" onClick={out}>Logout</button>} />
      <div className="app-body">
        <aside className="sidebar">
          <div>
            <div className="sidebar-title">Navigation</div>
            <nav className="nav-menu">
              {nav.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <span>{n.label}</span>
                  {n.badge != null && <span className="nav-badge">{n.badge}</span>}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="profile">
            <div className="avatar sm">{initials(user.firstname, user.lastname)}</div>
            <div>
              <h4>{user.firstname} {user.lastname}</h4>
              <p>{user.role}</p>
            </div>
          </div>
        </aside>
        <main className="workspace">{children}</main>
      </div>
    </div>
  );
}
