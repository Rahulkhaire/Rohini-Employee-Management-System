import { useState } from "react";
import { useAuth } from "../auth.jsx";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-side">
        <h1>Rohini Team Manager</h1>
        <p>Assign work, track deadlines and keep every task moving, in one place.</p>
        <ul>
          <li>Assign tasks to any teammate</li>
          <li>Automatic email when a task goes overdue</li>
          <li>Live view of who is working on what</li>
        </ul>
        <small>Rohini People Technology Pvt. Ltd. · Pune</small>
      </div>
      <form className="login-card" onSubmit={submit}>
        <img src="/logo.png" alt="Rohini - empowering every possibility" />
        <h2>Sign in</h2>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required autoComplete="username" />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        {error && <div className="alert error">{error}</div>}
        <button className="btn primary block" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="muted small center">Forgot your password? Ask your admin to reset it.</p>
      </form>
    </div>
  );
}
