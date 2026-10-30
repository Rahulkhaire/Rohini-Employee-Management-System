import { useEffect, useState } from "react";
import { api } from "../api";
import { fmtDate } from "../components/ui.jsx";

const STATUS = {
  sent: ["Sent", "st-done"],
  failed: ["Failed", "pr-high"],
  not_configured: ["SMTP off", "st-todo"],
};

export default function EmailLog() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = () => api.emails().then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const runNow = async () => {
    setMsg("");
    try {
      const { sent } = await api.runReminders();
      setMsg(sent ? `${sent} reminder${sent > 1 ? "s" : ""} processed.` : "No overdue tasks need a reminder right now.");
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Email log</h1>
          <p className="muted">Every email the system sends (overdue reminders and new-task alerts).</p>
        </div>
        <button className="btn primary" onClick={runNow}>
          Check overdue now
        </button>
      </div>
      {error && <div className="alert error">{error}</div>}
      {msg && <div className="alert ok">{msg}</div>}
      <div className="card flush">
        {rows.length === 0 ? (
          <p className="muted pad">No emails yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>To</th>
                  <th>Subject</th>
                  <th>Type</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const [label, cls] = STATUS[r.status] || [r.status, ""];
                  return (
                    <tr key={r.id}>
                      <td>{fmtDate(r.created_at)}</td>
                      <td>{r.to_email}</td>
                      <td>{r.subject}</td>
                      <td>{r.kind}</td>
                      <td>
                        <span className={`badge ${cls}`}>{label}</span>
                        {r.error && <small className="muted">{r.error}</small>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
