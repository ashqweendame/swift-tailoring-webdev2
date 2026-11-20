export default function StatusBadge({ status, overdue = false }) {
  return (
    <>
      {overdue && <span className="badge status-overdue">Overdue</span>}
      <span className={`badge status-${String(status).toLowerCase()}`}>{status}</span>
    </>
  );
}
