export const STATUS_LABEL = {
  todo: "New",
  in_progress: "In Progress",
  done: "Completed",
};
export const PRIORITY_LABEL = { low: "Low", medium: "Medium", high: "High" };

export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** ISO string -> value for <input type="datetime-local"> in the user's own timezone */
export function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 24 * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fromLocalInput = (v) => new Date(v).toISOString();

export function timeLeft(iso, done) {
  if (done) return "";
  const diff = new Date(iso) - new Date();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  let txt;
  if (mins < 60) txt = `${mins}m`;
  else if (mins < 60 * 24) txt = `${Math.round(mins / 60)}h`;
  else txt = `${Math.round(mins / 1440)}d`;
  return diff < 0 ? `${txt} overdue` : `${txt} left`;
}

export const StatusBadge = ({ status }) => <span className={`badge st-${status}`}>{STATUS_LABEL[status]}</span>;
export const PriorityBadge = ({ priority }) => <span className={`badge pr-${priority}`}>{PRIORITY_LABEL[priority]}</span>;

export function Avatar({ name, size = 32 }) {
  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initials}
    </span>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
