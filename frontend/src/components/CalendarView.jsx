
import { useMemo } from "react";
import "./CalendarView.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTaskDate(task) {
  if (!task.due_date) return "";
  const date = new Date(task.due_date);
  return Number.isNaN(date.getTime()) ? "" : getDateKey(date);
}

function formatDate(date) {
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function statusText(status) {
  if (status === "done") return "Completed";
  if (status === "in_progress") return "In Progress";
  return "New";
}

function CalendarView({
  tasks,
  calendarMonth,
  selectedDate,
  onMonthChange,
  onSelectDate,
  onEditTask,
  canEdit,
}) {
  const todayKey = getDateKey(new Date());

  const calendarDates = useMemo(() => {
    const firstDay = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1
    );

    const lastDay = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      0
    );

    const start = new Date(firstDay);
    start.setDate(start.getDate() - firstDay.getDay());

    const totalDays = Math.ceil(
      (firstDay.getDay() + lastDay.getDate()) / 7
    ) * 7;

    return Array.from({ length: totalDays }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [calendarMonth]);

  const tasksByDate = useMemo(() => {
    const grouped = {};

    tasks.forEach((task) => {
      const key = getTaskDate(task);
      if (!key) return;

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });

    return grouped;
  }, [tasks]);

  const selectedTasks = tasksByDate[selectedDate] || [];

  const completed = tasks.filter(
    (task) => task.status === "done"
  ).length;

  const inProgress = tasks.filter(
    (task) => task.status === "in_progress"
  ).length;

  const pending = tasks.filter(
    (task) => task.status === "todo"
  ).length;

  const overdue = tasks.filter(
    (task) => task.is_overdue
  ).length;

  const monthName = calendarMonth.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="calendar-dashboard">

      {/* Calendar heading */}
      <div className="calendar-heading">
        <div>
          <div className="calendar-eyebrow">
            WORK PLANNER
          </div>
          <h2>{monthName}</h2>
          <p>Manage deadlines and keep your team on track.</p>
        </div>

        <div className="calendar-navigation">
          <button
            className="calendar-today-btn"
            onClick={() => {
              const today = new Date();
              onMonthChange(
                new Date(today.getFullYear(), today.getMonth(), 1),
                getDateKey(today)
              );
            }}
          >
            Today
          </button>

          <button
            className="calendar-nav-btn"
            aria-label="Previous month"
            onClick={() => onMonthChange(
              new Date(
                calendarMonth.getFullYear(),
                calendarMonth.getMonth() - 1,
                1
              )
            )}
          >
            ‹
          </button>

          <button
            className="calendar-nav-btn"
            aria-label="Next month"
            onClick={() => onMonthChange(
              new Date(
                calendarMonth.getFullYear(),
                calendarMonth.getMonth() + 1,
                1
              )
            )}
          >
            ›
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="calendar-stats">
        <div className="calendar-stat">
          <div className="stat-icon total-icon">▦</div>
          <div>
            <span>Total tasks</span>
            <strong>{tasks.length}</strong>
          </div>
        </div>

        <div className="calendar-stat">
          <div className="stat-icon pending-icon">◷</div>
          <div>
            <span>New</span>
            <strong>{pending}</strong>
          </div>
        </div>

        <div className="calendar-stat">
          <div className="stat-icon progress-icon">↻</div>
          <div>
            <span>In progress</span>
            <strong>{inProgress}</strong>
          </div>
        </div>

        <div className="calendar-stat">
          <div className="stat-icon completed-icon">✓</div>
          <div>
            <span>Completed</span>
            <strong>{completed}</strong>
          </div>
        </div>

        <div className="calendar-stat">
          <div className="stat-icon overdue-icon">!</div>
          <div>
            <span>Overdue</span>
            <strong>{overdue}</strong>
          </div>
        </div>
      </div>

      {/* Calendar and selected day */}
      <div className="calendar-layout">

        <div className="calendar-main">
          <div className="calendar-grid">

            {WEEKDAYS.map((day) => (
              <div className="calendar-weekday" key={day}>
                {day}
              </div>
            ))}

            {calendarDates.map((date) => {
              const key = getDateKey(date);
              const dayTasks = tasksByDate[key] || [];

              const isCurrentMonth =
                date.getMonth() === calendarMonth.getMonth();

              const isToday = key === todayKey;
              const isSelected = key === selectedDate;

              return (
                <button
                  type="button"
                  key={key}
                  className={[
                    "calendar-day",
                    !isCurrentMonth ? "outside-month" : "",
                    isToday ? "today" : "",
                    isSelected ? "selected" : "",
                  ].join(" ")}
                  onClick={() => onSelectDate(key)}
                >
                  <div className="calendar-day-top">
                    <span className="calendar-day-number">
                      {date.getDate()}
                    </span>

                    {dayTasks.length > 0 && (
                      <span className="calendar-day-count">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>

                  <div className="calendar-day-tasks">
                    {dayTasks.slice(0, 2).map((task) => (
                      <div
                        key={task.id}
                        className={`calendar-task-chip status-${task.status}`}
                        title={`${task.title} — ${task.assigned_to?.name || ""}`}
                      >
                        <span className="calendar-task-dot" />
                        <span className="calendar-task-name">
                          {task.title}
                        </span>
                      </div>
                    ))}

                    {dayTasks.length > 2 && (
                      <div className="calendar-more">
                        +{dayTasks.length - 2} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="calendar-legend">
            <span><i className="legend-dot new-dot" /> New</span>
            <span><i className="legend-dot progress-dot" /> In Progress</span>
            <span><i className="legend-dot done-dot" /> Completed</span>
          </div>
        </div>

        {/* Selected date panel */}
        <aside className="calendar-agenda">
          <div className="agenda-header">
            <div>
              <span className="calendar-eyebrow">
                DAILY SCHEDULE
              </span>
              <h3>
                {new Date(`${selectedDate}T12:00:00`)
                  .toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
              </h3>
              <p>{formatDate(new Date(`${selectedDate}T12:00:00`))}</p>
            </div>

            <span className="agenda-count">
              {selectedTasks.length}
            </span>
          </div>

          <div className="agenda-list">
            {selectedTasks.length === 0 ? (
              <div className="agenda-empty">
                <div className="agenda-empty-icon">▦</div>
                <strong>No tasks scheduled</strong>
                <p>There are no deadlines for this date.</p>
              </div>
            ) : (
              selectedTasks.map((task) => (
                <div className="agenda-task" key={task.id}>
                  <div className="agenda-task-top">
                    <span className={`agenda-status status-${task.status}`}>
                      {statusText(task.status)}
                    </span>

                    {task.is_overdue && (
                      <span className="agenda-overdue">
                        Overdue
                      </span>
                    )}
                  </div>

                  <h4>{task.title}</h4>

                  {task.description && (
                    <p className="agenda-description">
                      {task.description}
                    </p>
                  )}

                  <div className="agenda-assignee">
                    <span className="agenda-avatar">
                      {(task.assigned_to?.name || "?")
                        .charAt(0).toUpperCase()}
                    </span>
                    <span>
                      {task.assigned_to?.name || "Unassigned"}
                    </span>
                  </div>

                  <div className="agenda-task-footer">
                    <span className="agenda-priority">
                      <i className={`priority-dot priority-${task.priority}`} />
                      {task.priority} priority
                    </span>

                    {canEdit(task) && (
                      <button
                        className="agenda-edit-btn"
                        onClick={() => onEditTask(task)}
                      >
                        Edit task →
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default CalendarView;
