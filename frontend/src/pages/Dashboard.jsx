import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import { Avatar, PriorityBadge, fmtDate, timeLeft } from "../components/ui.jsx";

function Stat({ label, value, tone, hint }) {
  return (
    <div className={`stat ${tone || ""}`}>
      <div className="stat-val">{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

function MiniList({ items, empty }) {
  if (!items.length) return <p className="muted pad">{empty}</p>;
  return (
    <ul className="mini-list">
      {items.map((t) => (
        <li key={t.id}>
          <div>
            <b>{t.title}</b>
            <small>
              {t.assigned_to?.name} · due {fmtDate(t.due_date)}
            </small>
          </div>
          <div className="mini-right">
            <PriorityBadge priority={t.priority} />
            <span className={t.is_overdue ? "late" : "muted small"}>{timeLeft(t.due_date, t.status === "done")}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () => api.dashboard().then(setD).catch((e) => setError(e.message));
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (!d) return <p className="muted">Loading…</p>;
  const t = d.totals;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hello, {user.name.split(" ")[0]} 👋</h1>
          <p className="muted">
            You have <b>{d.mine.open}</b> open task{d.mine.open === 1 ? "" : "s"}
            {d.mine.overdue > 0 && (
              <>
                , <b className="late">{d.mine.overdue} overdue</b>
              </>
            )}
            .
          </p>
        </div>
        <Link to="/tasks" className="btn primary">
          Go to tasks
        </Link>
      </div>

      <div className="stats">
        <Stat label="Open tasks" value={t.open} />
        <Stat label="In progress" value={t.in_progress} tone="blue" />
        <Stat label="Overdue" value={t.overdue} tone={t.overdue ? "red" : ""} />
        <Stat label="Completed" value={t.done} tone="green" />
        <Stat label="Finished on time" value={t.on_time_rate == null ? "—" : `${t.on_time_rate}%`} tone="orange" hint="of completed tasks" />
      </div>

      <div className="grid-2">
        <section className="card">
          <h3>Overdue tasks</h3>
          <MiniList items={d.overdue_tasks} empty="Nothing overdue. 🎉" />
        </section>
        <section className="card">
          <h3>Due in the next 48 hours</h3>
          <MiniList items={d.due_soon} empty="Nothing due soon." />
        </section>
      </div>

      <section className="card">
        <h3>Team workload</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Open</th>
                <th>In progress</th>
                <th>Overdue</th>
                <th>Done</th>
                <th style={{ width: "28%" }}>Progress</th>
              </tr>
            </thead>
            <tbody>
              {d.workload.map((w) => {
                const total = w.open + w.done;
                const pct = total ? Math.round((100 * w.done) / total) : 0;
                return (
                  <tr key={w.id}>
                    <td>
                      <div className="person">
                        <Avatar name={w.name} />
                        <div>
                          <b>{w.name}</b>
                          <small>{w.designation}</small>
                        </div>
                      </div>
                    </td>
                    <td>{w.open}</td>
                    <td>{w.in_progress}</td>
                    <td className={w.overdue ? "late" : ""}>{w.overdue}</td>
                    <td>{w.done}</td>
                    <td>
                      <div className="bar">
                        <div style={{ width: `${pct}%` }} />
                      </div>
                      <small className="muted">{pct}% complete</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
