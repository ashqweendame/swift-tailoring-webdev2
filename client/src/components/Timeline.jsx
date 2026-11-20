import { STAGES } from '../lib/constants.js';

export default function Timeline({ status }) {
  if (status === 'Cancelled') return <div className="cancelled-note">This order was cancelled. Please contact us if you have questions.</div>;
  const current = Math.max(0, STAGES.indexOf(status));
  return (
    <ol className="timeline" aria-label={`Order progress: ${status}`}>
      {STAGES.map((stage, i) => {
        const filled = i <= current;
        const done = i < current;
        return (
          <li key={stage} className="tl-step">
            <div className="tl-row">
              <span className={`tl-line ${i === 0 ? 'none' : filled ? 'on' : ''}`} />
              <span className={`tl-dot ${filled ? 'filled' : ''}`} />
              <span className={`tl-line ${i === STAGES.length - 1 ? 'none' : done ? 'on' : ''}`} />
            </div>
            <span className={`tl-label ${filled ? 'active' : ''}`}>{stage}</span>
          </li>
        );
      })}
    </ol>
  );
}
