import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth.jsx";

export default function Profile() {
  const { user } = useAuth();
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (f.next !== f.confirm) return setMsg({ type: "error", text: "New passwords do not match." });
    try {
      await api.changePassword(f.current, f.next);
      setMsg({ type: "ok", text: "Password changed." });
      setF({ current: "", next: "", confirm: "" });
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>My account</h1>
      </div>
      <div className="grid-2">
        <section className="card">
          <h3>Details</h3>
          <dl className="details">
            <dt>Name</dt>
            <dd>{user.name}</dd>
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Designation</dt>
            <dd>{user.designation || "—"}</dd>
            <dt>Role</dt>
            <dd>{user.role === "admin" ? "Admin" : "Employee"}</dd>
          </dl>
        </section>
        <section className="card">
          <h3>Change password</h3>
          <form className="form" onSubmit={submit}>
            <label>
              Current password
              <input type="password" value={f.current} onChange={set("current")} required autoComplete="current-password" />
            </label>
            <label>
              New password
              <input type="password" value={f.next} onChange={set("next")} required minLength={6} autoComplete="new-password" />
            </label>
            <label>
              Confirm new password
              <input type="password" value={f.confirm} onChange={set("confirm")} required autoComplete="new-password" />
            </label>
            {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}
            <button className="btn primary">Update password</button>
          </form>
        </section>
      </div>
    </>
  );
}
