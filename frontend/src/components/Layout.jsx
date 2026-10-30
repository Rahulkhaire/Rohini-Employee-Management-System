import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { Avatar } from "./ui.jsx";

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  const links = [
    ["/", "Dashboard", "▦"],
    ["/tasks", "Tasks", "✔"],
    ["/attendance", "Attendance", "◷"],
    ...(isAdmin
      ? [
          ["/team", "Team", "👥"],
          ["/emails", "Email log", "✉"],
        ]
      : []),
    ["/profile", "My account", "⚙"],
  ];

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <img src="/logo.png" alt="Rohini" className="side-logo" />
        <nav onClick={() => setOpen(false)}>
          {links.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
              <span className="nav-ico">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="side-user">
          <Avatar name={user.name} />
          <div className="side-user-text">
            <b>{user.name}</b>
            <small>{isAdmin ? "Admin" : user.designation || "Employee"}</small>
          </div>
          <button className="btn ghost sm" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(!open)} aria-label="Menu">
            ☰
          </button>
          <img src="/logo.png" alt="Rohini" className="top-logo" />
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
