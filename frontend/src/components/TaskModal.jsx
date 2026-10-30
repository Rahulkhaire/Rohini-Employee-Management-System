
import { useEffect, useState } from "react";
import { api } from "../api";
import { Modal, fromLocalInput, toLocalInput } from "./ui.jsx";

/** Create (task == null) or edit a task. */
export default function TaskModal({ task, users, me, onClose, onSaved }) {
  const [f, setF] = useState({
    title: task?.title || "",
    description: task?.description || "",
    assigned_to: task?.assigned_to?.id || "",
    priority: task?.priority || "medium",
    due_date: toLocalInput(task?.due_date),
  });

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState([]);

  const set = (key) => (e) => {
    setF((previous) => ({
      ...previous,
      [key]: e.target.value,
    }));
  };

  // Load existing attachments when editing a task.
  useEffect(() => {
    if (!task?.id) return;

    api.taskAttachments(task.id)
      .then((data) => {
        setExistingAttachments(
          Array.isArray(data) ? data : data.attachments || []
        );
      })
      .catch((err) => setError(err.message));
  }, [task?.id]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      const body = {
        ...f,
        assigned_to: Number(f.assigned_to),
        due_date: fromLocalInput(f.due_date),
      };

      let savedTask;

      if (task) {
        await api.updateTask(task.id, body);
        savedTask = task;
      } else {
        savedTask = await api.createTask(body);
      }

      // Upload selected attachments after the task is saved.
      if (selectedFiles.length > 0) {
        await api.uploadTaskAttachments(savedTask.id, selectedFiles);
      }

      onSaved();
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <Modal
      title={task ? "Edit task" : "Assign a new task"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="form">
        <label>
          Task title
          <input
            value={f.title}
            onChange={set("title")}
            required
            maxLength={200}
            autoFocus
          />
        </label>

        <label>
          Details
          <textarea
            rows={3}
            value={f.description}
            onChange={set("description")}
          />
        </label>

        <div className="row">
          <label>
            Assign to
            <select
              value={f.assigned_to}
              onChange={set("assigned_to")}
              required
            >
              <option value="">Select employee…</option>

              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.id === me.id ? " (me)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            Priority
            <select
              value={f.priority}
              onChange={set("priority")}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <label>
          Deadline
          <input
            type="datetime-local"
            value={f.due_date}
            onChange={set("due_date")}
            required
          />
        </label>

        {/* Attachments */}
        <div className="field">
          <label>
            Attachments
            <input
              type="file"
              multiple
              accept=".xlsx,.xls,.docx,.doc,.pptx,.ppt"
              onChange={(e) =>
                setSelectedFiles(Array.from(e.target.files || []))
              }
            />
          </label>

          <p className="muted small">
            Allowed: Excel, Word and PowerPoint files.
            Maximum 15 MB per file.
          </p>

          {selectedFiles.length > 0 && (
            <div>
              <strong>Selected files</strong>
              <ul>
                {selectedFiles.map((file, index) => (
                  <li key={`${file.name}-${index}`}>
                    {file.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {existingAttachments.length > 0 && (
            <div>
              <strong>Existing attachments</strong>

              <ul>
                {existingAttachments.map((attachment) => (
  <li
    key={attachment.id}
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
      marginBottom: "8px",
    }}
  >
    <span>{attachment.original_name}</span>

    <button
      type="button"
      className="btn ghost"
      onClick={() =>
        api.downloadTaskAttachment(task.id, attachment.id)
      }
    >
      Download
    </button>

    {(me.role === "admin" || task.assigned_by?.id === me.id) && (
      <button
        type="button"
        className="btn ghost"
        onClick={async () => {
          try {
            await api.deleteTaskAttachment(task.id, attachment.id);
            setExistingAttachments((previous) =>
              previous.filter((item) => item.id !== attachment.id)
            );
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        Delete
      </button>
    )}
  </li>
))}
              </ul>
            </div>
          )}
        </div>

        <p className="muted small">
          If the task is not marked Done by this time, the assignee is
          emailed automatically.
        </p>

        {error && (
          <div className="alert error">
            {error}
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>

          <button
            className="btn primary"
            disabled={busy}
          >
            {busy
              ? "Saving…"
              : task
                ? "Save changes"
                : "Assign task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
