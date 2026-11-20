import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api.js';
import { initials } from '../lib/fmt.js';

const PURPLE = '#8b5a90';
const VIOLET = '#4b2558';

function ChartCard({ title, empty, children }) {
  return (
    <div className="card chart-card">
      <h3>{title}</h3>
      {empty ? <p className="muted small">No data yet.</p> : <div className="chart-box"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>}
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/stats/summary').then(setData).catch((e) => setError(e.message)); }, []);

  if (error) return <div className="page-view"><p className="pane-note error">{error}</p></div>;
  if (!data) return <div className="page-view"><p className="muted">Loading dashboard…</p></div>;

  const { cards, byStatus, weekly, materials, workload } = data;
  const metrics = [
    ['Active Tailors', cards.activeTailors], ['Open Orders', cards.openOrders], ['Active Tasks', cards.assigned],
    ['Ready Tasks', cards.ready], ['Collected Tasks', cards.collected], ['Overdue', cards.overdue],
  ];

  return (
    <div className="page-view">
      <section className="metrics">
        {metrics.map(([label, n]) => (
          <div className="card" key={label}><h3>{label}</h3><div className={`number ${label === 'Overdue' && n > 0 ? 'danger' : ''}`}>{n}</div></div>
        ))}
      </section>

      <section className="charts">
        <ChartCard title="Orders by status">
          <BarChart data={byStatus}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="status" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill={PURPLE} radius={[6, 6, 0, 0]} /></BarChart>
        </ChartCard>
        <ChartCard title="Orders per week (last 8 weeks)" empty={weekly.length === 0}>
          <LineChart data={weekly}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="week" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="count" stroke={VIOLET} strokeWidth={2} dot /></LineChart>
        </ChartCard>
        <ChartCard title="Popular fabric materials" empty={materials.length === 0}>
          <BarChart data={materials} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="material" width={90} /><Tooltip /><Bar dataKey="count" fill={VIOLET} radius={[0, 6, 6, 0]} /></BarChart>
        </ChartCard>
      </section>

      <h2 className="section-title">Tailor workload</h2>
      <div className="workload">
        <div className="workload-head"><div /><div>Name</div><div className="c">Active</div><div className="c">Done</div><div>Progress</div></div>
        {workload.length === 0 && <p className="pane-note">No active tailors.</p>}
        {workload.map((w) => (
          <div className="workload-row" key={w.employee_id}>
            <div className="avatar">{initials(...w.name.split(' ').filter(Boolean).slice(0, 1), w.name.split(' ').slice(-1)[0])}</div>
            <div><strong>{w.name}</strong><div className="muted small">Tailor</div></div>
            <div className="c big">{w.assigned}</div>
            <div className="c big green">{w.done}</div>
            <div className="progress-cell">
              <div className="progress-bg"><div className="progress-fill" style={{ width: `${w.progress}%` }} /></div>
              <span className="small">{w.progress}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
