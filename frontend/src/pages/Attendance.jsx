
import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import FaceCamera from "../components/FaceCamera.jsx";
import { fmtDate } from "../components/ui.jsx";

// Get the user's current GPS location
function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(
        new Error("Your browser does not support location.")
      );
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        reject(
          new Error(
            error.code === 1
              ? "Please allow location access."
              : "Could not get your location. Try again outdoors."
          )
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

export default function Attendance() {
  const { isAdmin } = useAuth();

  // Attendance data
  const [status, setStatus] = useState(null);
  const [rows, setRows] = useState([]);

  // Office settings
  const [office, setOffice] = useState({
    name: "Main Office",
    latitude: "",
    longitude: "",
    radius_m: 200,
    max_accuracy_m: 100,
    enabled: false,
  });

  // UI states
  const [photo, setPhoto] = useState("");
  const [date, setDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );

  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Load attendance information
  const load = useCallback(async () => {
    try {
      setError("");

      if (isAdmin) {
        const [records, officeSettings] = await Promise.all([
          api.attendanceRecords(date),
          api.officeSettings(),
        ]);

        setRows(records);
        setOffice(officeSettings);
      } else {
        const result = await api.attendanceStatus();
        setStatus(result);
      }
    } catch (e) {
      setError(e.message);
    }
  }, [isAdmin, date]);

  useEffect(() => {
    load();
  }, [load]);

  // Mark attendance
  const mark = async (event) => {
    setBusy(true);
    setError("");
    setMsg("");

    try {
      if (!photo) {
        throw new Error("Capture a fresh selfie first.");
      }

      const location = await getLocation();

      const result = await api.markAttendance({
        event,
        photo,
        ...location,
      });

      setMsg(
        `${result.message} Office distance: ${result.office_distance_m}m.`
      );

      setPhoto("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Save office geofence settings
  const saveOffice = async (e) => {
    e.preventDefault();

    setBusy(true);
    setError("");
    setMsg("");

    try {
      await api.saveOfficeSettings(office);

      setMsg("Office attendance location saved.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Use current GPS location for office settings
  const useCurrent = async () => {
    setError("");

    try {
      const position = await getLocation();

      setOffice((previous) => ({
        ...previous,
        latitude: position.latitude,
        longitude: position.longitude,
      }));

      setMsg("Current location added. Save office settings to apply it.");
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      {/* Page heading */}
      <div className="page-head">
        <div>
          <h1>Attendance</h1>

          <p className="muted">
            Face verification and office GPS geofence. A fresh selfie
            and location are required for each event.
          </p>
        </div>

        <button
          className="btn ghost"
          onClick={load}
          disabled={busy}
        >
          Refresh
        </button>
      </div>

      {/* Success and error messages */}
      {msg && (
        <div className="alert ok">
          {msg}
        </div>
      )}

      {error && (
        <div className="alert error">
          {error}
        </div>
      )}

      {/* ADMIN ATTENDANCE PAGE */}
      {isAdmin ? (
        <>
          {/* Office geofence settings */}
          <div className="card">
            <h2>Office geofence settings</h2>

            <p className="muted">
              Set the office coordinates. The default radius is
              200 metres. Attendance remains blocked until the
              office location is enabled.
            </p>

            <form
              className="form"
              onSubmit={saveOffice}
            >
              <label>
                Office name

                <input
                  value={office.name}
                  onChange={(e) =>
                    setOffice({
                      ...office,
                      name: e.target.value,
                    })
                  }
                />
              </label>

              <div className="row">
                <label>
                  Latitude

                  <input
                    type="number"
                    step="any"
                    value={office.latitude}
                    onChange={(e) =>
                      setOffice({
                        ...office,
                        latitude: e.target.value,
                      })
                    }
                    required
                  />
                </label>

                <label>
                  Longitude

                  <input
                    type="number"
                    step="any"
                    value={office.longitude}
                    onChange={(e) =>
                      setOffice({
                        ...office,
                        longitude: e.target.value,
                      })
                    }
                    required
                  />
                </label>
              </div>

              <div className="row">
                <label>
                  Allowed radius (metres)

                  <input
                    type="number"
                    min="25"
                    max="2000"
                    value={office.radius_m}
                    onChange={(e) =>
                      setOffice({
                        ...office,
                        radius_m: Number(e.target.value),
                      })
                    }
                  />
                </label>

                <label>
                  Maximum GPS accuracy (metres)

                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={office.max_accuracy_m}
                    onChange={(e) =>
                      setOffice({
                        ...office,
                        max_accuracy_m: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>

              <label className="checkline">
                <input
                  type="checkbox"
                  checked={!!office.enabled}
                  onChange={(e) =>
                    setOffice({
                      ...office,
                      enabled: e.target.checked,
                    })
                  }
                />

                Enable office geofence attendance
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={useCurrent}
                  disabled={busy}
                >
                  Use my current location
                </button>

                <button
                  className="btn primary"
                  disabled={busy}
                >
                  {busy
                    ? "Saving..."
                    : "Save office settings"}
                </button>
              </div>
            </form>
          </div>

          {/* All employee attendance records */}
          <div className="page-head">
            <div>
              <h2>All employee attendance</h2>

              <p className="muted">
                Admin view of daily check-in and check-out records.
              </p>
            </div>

            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="card flush">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Date</th>
                    <th>Check in</th>
                    <th>Check out</th>
                    <th>Check-in distance</th>
                    <th>Check-out distance</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <b>{record.employee_name}</b>
                        <small>{record.employee_email}</small>
                      </td>

                      <td>{record.work_date}</td>

                      <td>{fmtDate(record.check_in_at)}</td>

                      <td>{fmtDate(record.check_out_at)}</td>

                      <td>
                        {record.check_in_distance_m == null
                          ? "—"
                          : `${record.check_in_distance_m} m`}
                      </td>

                      <td>
                        {record.check_out_distance_m == null
                          ? "—"
                          : `${record.check_out_distance_m} m`}
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan="6">
                        No attendance records for this date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* EMPLOYEE ATTENDANCE PAGE */
        <>
          <div className="card">
            <h2>My attendance today</h2>

            {status && (
              <p>
                Face enrolled:{" "}
                <b>{status.enrolled ? "Yes" : "No"}</b>

                {" · "}

                Office location:{" "}
                <b>
                  {status.office_configured
                    ? `Configured (${status.office_radius_m}m radius)`
                    : "Not configured"}
                </b>
              </p>
            )}

            {status?.today && (
              <p>
                Check-in:{" "}
                <b>{fmtDate(status.today.check_in_at)}</b>

                {" · "}

                Check-out:{" "}
                <b>{fmtDate(status.today.check_out_at)}</b>
              </p>
            )}

            {!status?.enrolled && (
              <div className="alert error">
                Your face has not been registered. Contact the admin.
              </div>
            )}

            <FaceCamera
              onCapture={setPhoto}
              label="Capture fresh attendance selfie"
              disabled={!status?.enrolled}
            />

            {photo && (
              <div className="alert ok">
                Selfie captured. It will be sent securely for
                verification and not retained as a photo.
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn primary"
                disabled={
                  busy ||
                  !photo ||
                  !status?.enrolled ||
                  !!status?.today?.check_in_at
                }
                onClick={() => mark("check_in")}
              >
                {busy ? "Verifying..." : "Check in"}
              </button>

              <button
                className="btn primary"
                disabled={
                  busy ||
                  !photo ||
                  !status?.today?.check_in_at ||
                  !!status?.today?.check_out_at
                }
                onClick={() => mark("check_out")}
              >
                {busy ? "Verifying..." : "Check out"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
