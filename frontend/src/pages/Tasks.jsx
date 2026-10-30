
import { useCallback, useEffect, useState, Fragment } from "react";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import TaskModal from "../components/TaskModal.jsx";
import CalendarView from "../components/CalendarView.jsx";

import {
  Avatar,
  PriorityBadge,
  fmtDate,
  timeLeft,
} from "../components/ui.jsx";

const SCOPES = [
  ["mine", "My tasks"],
  ["created", "Assigned by you"],
  ["all", "Whole team"],
];

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function Tasks() {
  const { user, isAdmin } = useAuth();

  // Task filters
  const [scope, setScope] = useState("mine");
  const [filter, setFilter] = useState("open");
  const [assignee, setAssignee] = useState("");

  // Separate task data for List View and Calendar View
  const [tasks, setTasks] = useState([]);
  const [calendarTasks, setCalendarTasks] = useState([]);

  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null);

  // UI states
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");

  // Calendar states
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );
  });

  const [selectedDate, setSelectedDate] = useState(
    getDateKey(new Date())
  );

  // Attachment states
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [attachments, setAttachments] = useState({});
  const [attachmentLoading, setAttachmentLoading] = useState({});

  // Load filtered tasks for List View
  const load = useCallback(async () => {
    try {
      const params = {
        scope,
        assignee: scope === "all" ? assignee : "",
      };

      if (filter === "open") params.status = "open";
      if (filter === "done") params.status = "done";
      if (filter === "overdue") params.overdue = "1";

      const result = await api.tasks(params);

      setTasks(result);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [scope, filter, assignee]);

  // Load ALL task statuses for Calendar View
  const loadCalendarTasks = useCallback(async () => {
    try {
      const params = {
        scope,
        assignee: scope === "all" ? assignee : "",
      };

      // Do not apply the status filter here.
      // Calendar must show New, In Progress and Completed tasks.
      const result = await api.tasks(params);

      setCalendarTasks(result);
    } catch (e) {
      setError(e.message);
    }
  }, [scope, assignee]);

  // Refresh both datasets
  const refreshTasks = useCallback(async () => {
    await Promise.all([
      load(),
      loadCalendarTasks(),
    ]);
  }, [load, loadCalendarTasks]);

  // Load employees
  useEffect(() => {
    api.users()
      .then((result) =>
        setUsers(
          result.filter(
            (employee) => employee.is_active !== false
          )
        )
      )
      .catch(() => {});
  }, []);

  // Reload List View when its filters change
  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Reload Calendar View when scope or assignee changes
  useEffect(() => {
    loadCalendarTasks();
  }, [loadCalendarTasks]);

  // Load attachment information for List View tasks
  useEffect(() => {
    if (tasks.length === 0) return;

    let cancelled = false;

    const checkAttachments = async () => {
      const loadingState = {};

      tasks.forEach((task) => {
        loadingState[task.id] = true;
      });

      setAttachmentLoading((previous) => ({
        ...previous,
        ...loadingState,
      }));

      const results = await Promise.all(
        tasks.map(async (task) => {
          try {
            const result = await api.taskAttachments(task.id);

            const files = Array.isArray(result)
              ? result
              : result.attachments || [];

            return [task.id, files];
          } catch {
            return [task.id, []];
          }
        })
      );

      if (!cancelled) {
        setAttachments((previous) => ({
          ...previous,
          ...Object.fromEntries(results),
        }));

        setAttachmentLoading((previous) => {
          const updated = { ...previous };

          tasks.forEach((task) => {
            updated[task.id] = false;
          });

          return updated;
        });
      }
    };

    checkAttachments();

    return () => {
      cancelled = true;
    };
  }, [tasks]);

  // Permissions
  const canEdit = (task) =>
    isAdmin || task.assigned_by?.id === user.id;

  const canStatus = (task) =>
    canEdit(task) || task.assigned_to?.id === user.id;

  // Change task status
  const changeStatus = async (task, status) => {
    try {
      await api.setStatus(task.id, status);
      await refreshTasks();
    } catch (e) {
      setError(e.message);
    }
  };

  // Delete task
  const remove = async (task) => {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;

    try {
      await api.deleteTask(task.id);

      setAttachments((previous) => {
        const updated = { ...previous };
        delete updated[task.id];
        return updated;
      });

      if (expandedTaskId === task.id) {
        setExpandedTaskId(null);
      }

      await refreshTasks();
    } catch (e) {
      setError(e.message);
    }
  };

  // Calendar month navigation
  const handleMonthChange = (month, date) => {
    setCalendarMonth(month);

    if (date) {
      setSelectedDate(date);
    }

    setExpandedTaskId(null);
  };

  // Download attachment
  const downloadAttachment = async (taskId, attachmentId) => {
    try {
      await api.downloadTaskAttachment(taskId, attachmentId);
    } catch (e) {
      setError(`Download failed: ${e.message}`);
    }
  };

  // Show or hide task attachments
  const toggleAttachments = (taskId) => {
    setExpandedTaskId((previous) =>
      previous === taskId ? null : taskId
    );
  };

  // Attachment section
  const renderTaskAttachments = (task) => {
    if (expandedTaskId !== task.id) return null;

    const files = attachments[task.id] || [];

    return (
      <div
        style={{
          marginTop: "10px",
          padding: "12px",
          background: "#f7f9fb",
          borderRadius: "8px",
        }}
      >
        <strong>Attachments</strong>

        {files.length === 0 ? (
          <p className="muted small">
            No attachments available.
          </p>
        ) : (
          files.map((file) => (
            <div
              key={file.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "10px",
                padding: "8px 0",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <span>📎 {file.original_name}</span>

              <button
                type="button"
                className="btn primary sm"
                onClick={() =>
                  downloadAttachment(task.id, file.id)
                }
              >
                Download
              </button>
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <>
      {/* Page heading */}
      <div className="page-head">
        <div>
          <h1>Tasks</h1>
          <p className="muted">
            Assign work and track it until it is done.
          </p>
        </div>

        <button
          className="btn primary"
          onClick={() => setModal("new")}
        >
          + Assign task
        </button>
      </div>

      {/* List and calendar view selection */}
      <div className="toolbar">
        <div className="tabs">
          <button
            className={view === "list" ? "active" : ""}
            onClick={() => setView("list")}
          >
            List View
          </button>

          <button
            className={view === "calendar" ? "active" : ""}
            onClick={() => setView("calendar")}
          >
            Calendar View
          </button>
        </div>

        <div className="tools-right">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="open">Open</option>
            <option value="overdue">Overdue</option>
            <option value="done">Completed</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {/* Task scope */}
      <div className="toolbar">
        <div className="tabs">
          {SCOPES.map(([key, label]) => (
            <button
              key={key}
              className={scope === key ? "active" : ""}
              onClick={() => setScope(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {scope === "all" && (
          <div className="tools-right">
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Everyone</option>

              {users.map((employee) => (
                <option
                  key={employee.id}
                  value={employee.id}
                >
                  {employee.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="alert error">{error}</div>
      )}

      {/* Main content */}
      {loading ? (
        <div className="card">
          <p className="muted pad">Loading tasks...</p>
        </div>
      ) : view === "calendar" ? (

        /* Calendar View - all statuses */
        <CalendarView
          tasks={calendarTasks}
          calendarMonth={calendarMonth}
          selectedDate={selectedDate}
          onMonthChange={handleMonthChange}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setExpandedTaskId(null);
          }}
          onEditTask={(task) => setModal(task)}
          canEdit={canEdit}
        />

      ) : (

        /* List View - follows selected status filter */
        <div className="card flush">
          {tasks.length === 0 ? (
            <p className="muted pad">No tasks here.</p>
          ) : (
            <div className="table-wrap">
              <table className="tasks">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Assigned to</th>
                    <th>Deadline</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Attachments</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {tasks.map((task) => (
                    <Fragment key={task.id}>
                      <tr
                        className={
                          task.is_overdue ? "row-late" : ""
                        }
                      >
                        <td>
                          <b
                            className={
                              task.status === "done"
                                ? "struck"
                                : ""
                            }
                          >
                            {task.title}
                          </b>

                          {task.description && (
                            <small className="desc">
                              {task.description}
                            </small>
                          )}

                          <small>
                            by {task.assigned_by?.name}
                          </small>
                        </td>

                        <td>
                          <div className="person">
                            <Avatar
                              name={task.assigned_to?.name}
                              size={28}
                            />
                            {task.assigned_to?.name}
                          </div>
                        </td>

                        <td>
                          {fmtDate(task.due_date)}

                          <small
                            className={
                              task.is_overdue
                                ? "late"
                                : task.completed_late
                                  ? "late"
                                  : "muted"
                            }
                          >
                            {task.status === "done"
                              ? task.completed_late
                                ? "Finished late"
                                : "Finished on time"
                              : timeLeft(task.due_date)}

                            {task.is_overdue &&
                            task.reminder_count > 0
                              ? ` · ${task.reminder_count} reminder${task.reminder_count > 1 ? "s" : ""} sent`
                              : ""}
                          </small>
                        </td>

                        <td>
                          <PriorityBadge
                            priority={task.priority}
                          />
                        </td>

                        <td>
                          {canStatus(task) ? (
                            <select
                              className={`status-select st-${task.status}`}
                              value={task.status}
                              onChange={(e) =>
                                changeStatus(
                                  task,
                                  e.target.value
                                )
                              }
                            >
                              <option value="todo">New</option>
                              <option value="in_progress">
                                In Progress
                              </option>
                              <option value="done">
                                Completed
                              </option>
                            </select>
                          ) : (
                            <span
                              className={`badge st-${task.status}`}
                            >
                              {task.status.replace("_", " ")}
                            </span>
                          )}
                        </td>

                        <td>
                          {attachmentLoading[task.id] ? (
                            <span className="muted small">
                              Checking...
                            </span>
                          ) : attachments[task.id]?.length > 0 ? (
                            <button
                              className="btn ghost sm"
                              onClick={() =>
                                toggleAttachments(task.id)
                              }
                            >
                              {expandedTaskId === task.id
                                ? "Hide files"
                                : "View files"}
                            </button>
                          ) : null}
                        </td>

                        <td className="actions">
                          {canEdit(task) && (
                            <>
                              <button
                                className="btn ghost sm"
                                onClick={() => setModal(task)}
                              >
                                Edit
                              </button>

                              <button
                                className="btn ghost sm danger"
                                onClick={() => remove(task)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>

                      {expandedTaskId === task.id && (
                        <tr>
                          <td colSpan={7}>
                            {renderTaskAttachments(task)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Task modal */}
      {modal && (
        <TaskModal
          task={modal === "new" ? null : modal}
          users={users}
          me={user}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            setAttachments({});
            setExpandedTaskId(null);
            refreshTasks();
          }}
        />
      )}
    </>
  );
}
