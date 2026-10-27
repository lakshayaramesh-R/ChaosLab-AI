import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./App.css";

const API = "http://127.0.0.1:8000";

// Demo severity rules for this simulator (not a production risk assessment).
const getIncidentSeverity = (serviceName, failureType) => {
  if (
    failureType === "shutdown" &&
    ["Database", "API Gateway"].includes(serviceName)
  ) {
    return "CRITICAL";
  }

  if (failureType === "shutdown" || failureType === "overload") {
    return "HIGH";
  }

  if (failureType === "latency") {
    return "MEDIUM";
  }

  return "LOW";
};

const SERVICE_NAMES = [
  "API Gateway",
  "User Service",
  "Payment Service",
  "Database",
];

const DEPENDENCIES = [
  ["API Gateway", "User Service"],
  ["API Gateway", "Payment Service"],
  ["User Service", "Database"],
  ["Payment Service", "Database"],
];

function getStatus(service) {
  const value = String(service?.status || "healthy").toLowerCase();

  if (value.includes("fail") || value.includes("down")) {
    return "failed";
  }

  if (value.includes("recover")) {
    return "recovering";
  }

  if (value.includes("slow") || value.includes("latency") || value.includes("overload")) {
    return "slow";
  }

  return "healthy";
}

function ServiceNode({ data }) {
  const status = data.status || "healthy";

  return (
    <div className={`service-node service-${status}`}>
      <Handle type="target" position={Position.Top} />

      <div className="service-node-top">
        <span className={`status-dot status-dot-${status}`} />
        <span className="service-node-status">
          {status.toUpperCase()}
        </span>
      </div>

      <h3>{data.label}</h3>

      <p>
        {status === "failed"
          ? "Service unavailable"
          : status === "recovering"
          ? "Recovery in progress"
          : status === "slow"
          ? "Performance degraded"
          : "Service operational"}
      </p>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = {
  serviceNode: ServiceNode,
};

function App() {
  const [services, setServices] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedService, setSelectedService] = useState("Payment Service");
  const [failureType, setFailureType] = useState("shutdown");
  const [incident, setIncident] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [events, setEvents] = useState([]);
  const [eventFilter, setEventFilter] = useState("all");
  
  const [incidentHistory, setIncidentHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("chaoslab-incident-history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [incidentSearch, setIncidentSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");


  useEffect(() => {
    try {
      localStorage.setItem(
        "chaoslab-incident-history",
        JSON.stringify(incidentHistory.slice(0, 50))
      );
    } catch {
      // The dashboard can still work if browser storage is unavailable.
    }
  }, [incidentHistory]);

  const addEvent = useCallback((message, type = "info") => {
    setEvents((previous) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        time: new Date().toLocaleTimeString(),
        message,
        type,
      },
      ...previous,
    ].slice(0, 30));
  }, []);

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const text = await response.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { detail: text };
    }

    if (!response.ok) {
      throw new Error(
        data.detail || data.message || `Request failed (${response.status})`
      );
    }

    return data;
  }, []);

  const loadSystem = useCallback(async (showError = true) => {
    try {
      const data = await request("/system");
      const rawServices = data.services || data;

      setServices((previous) => {
        const next = {};

        SERVICE_NAMES.forEach((name) => {
          const service =
            rawServices[name] ||
            rawServices[name.toLowerCase().replaceAll(" ", "_")] ||
            previous[name] ||
            {};

          next[name] = {
            ...service,
            name,
            status: getStatus(service),
          };
        });

        return next;
      });

      setError("");
      return data;
    } catch (err) {
      if (showError) {
        setError(
          `Could not load the system: ${err.message}. Check that the backend is running.`
        );
      }

      return null;
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    loadSystem();
  }, [loadSystem]);

  const failedServices = useMemo(
    () =>
      SERVICE_NAMES.filter(
        (name) => services[name]?.status === "failed"
      ),
    [services]
  );

  const nonHealthyServices = useMemo(
    () => SERVICE_NAMES.filter((name) => services[name]?.status !== "healthy"),
    [services]
  );

  const healthyCount = SERVICE_NAMES.filter(
    (name) => services[name]?.status === "healthy"
  ).length;

  const incidentResolved =
    Boolean(incident) &&
    SERVICE_NAMES.every((name) => services[name]?.status === "healthy");

  const nodes = useMemo(() => {
    const positions = {
      "API Gateway": { x: 260, y: 20 },
      "User Service": { x: 60, y: 190 },
      "Payment Service": { x: 460, y: 190 },
      Database: { x: 260, y: 360 },
    };

    return SERVICE_NAMES.map((name) => ({
      id: name,
      type: "serviceNode",
      position: positions[name],
      data: {
        label: name,
        status: services[name]?.status || "healthy",
      },
    }));
  }, [services]);

  const edges = useMemo(
    () =>
      DEPENDENCIES.map(([source, target]) => {
        const sourceFailed = services[source]?.status === "failed";
        const targetFailed = services[target]?.status === "failed";

        return {
          id: `${source}-${target}`,
          source,
          target,
          animated: !sourceFailed && !targetFailed,
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
          style: {
            stroke:
              sourceFailed || targetFailed ? "#ef4444" : "#8793a8",
            strokeWidth: 2,
          },
        };
      }),
    [services]
  );

  const createIncident = useCallback((serviceName, type) => {
    const related = DEPENDENCIES
      .filter(([source, target]) =>
        source === serviceName || target === serviceName
      )
      .flatMap(([source, target]) => [source, target])
      .filter((name) => name !== serviceName);

    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      service_name: serviceName,
      failure_type: type,
      severity: getIncidentSeverity(serviceName, type),
      status: "Active",
      title: `${serviceName} incident`,
      description:
        type === "shutdown"
          ? `${serviceName} was shut down.`
          : type === "latency"
          ? `${serviceName} is experiencing high latency.`
          : `${serviceName} is experiencing an overload.`,
      related_services: [...new Set(related)],
      timestamp: new Date().toLocaleString(),
    };
  }, []);

  const analyzeIncident = useCallback(async (incidentData) => {
    setAnalysisLoading(true);
    setAnalysisError("");
    setAiAnalysis("");

    try {
      const data = await request("/analyze", {
        method: "POST",
        body: JSON.stringify({
          service_name: incidentData.service_name,
          failure_type: incidentData.failure_type,
        }),
      });

      const result =
        data.analysis ??
        data.ai_analysis ??
        data.report ??
        data.result ??
        data.message ??
        "";

      if (typeof result === "string" && result.trim()) {
        setAiAnalysis(result);
        addEvent("Groq AI incident analysis completed", "success");
      } else {
        setAnalysisError(
          "The analysis endpoint responded, but no analysis text was returned."
        );
      }
    } catch (err) {
      setAnalysisError(`AI analysis failed: ${err.message}`);
      addEvent(`AI analysis failed: ${err.message}`, "error");
    } finally {
      setAnalysisLoading(false);
    }
  }, [request, addEvent]);

  const triggerFailure = async () => {
    if (busy) return;

    setBusy(true);
    setError("");
    setAnalysisError("");
    setAiAnalysis("");

    try {
      await request("/failure", {
        method: "POST",
        body: JSON.stringify({
          service_name: selectedService,
          failure_type: failureType,
        }),
      });

      const newIncident = createIncident(selectedService, failureType);
      setIncident(newIncident);
      setIncidentHistory((previous) =>
        [
          {
            id: newIncident.id,
            service_name: newIncident.service_name,
            failure_type: newIncident.failure_type,
            severity: newIncident.severity,
            timestamp: newIncident.timestamp,
            status: "Active",
          },
          ...previous,
        ].slice(0, 50)
      );

      addEvent(
        `${selectedService}: ${failureType} failure triggered`,
        "error"
      );

      await loadSystem(false);
      await analyzeIncident(newIncident);
    } catch (err) {
      setError(`Could not trigger failure: ${err.message}`);
      addEvent(`Failure action failed: ${err.message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const recoverService = async (serviceName) => {
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      await request(
        `/recover/${encodeURIComponent(serviceName)}`,
        { method: "POST" }
      );

      addEvent(`${serviceName}: recovery requested`, "success");
      const systemData = await loadSystem(false);
      const rawServices = systemData?.services || systemData || {};
      const allHealthy = SERVICE_NAMES.every((name) => {
        const service =
          rawServices[name] ||
          rawServices[name.toLowerCase().replaceAll(" ", "_")];
        return service ? getStatus(service) === "healthy" : false;
      });

      if (incident?.id) {
        setIncidentHistory((previous) =>
          previous.map((item) =>
            item.id === incident.id
              ? {
                  ...item,
                  status: allHealthy ? "Recovered" : "Recovery in progress",
                }
              : item
          )
        );
      }
    } catch (err) {
      setError(`Recovery failed: ${err.message}`);
      addEvent(`Recovery failed for ${serviceName}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const resetSystem = async () => {
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      await request("/reset", { method: "POST" });

      if (incident?.id) {
        setIncidentHistory((previous) =>
          previous.map((item) =>
            item.id === incident.id && item.status !== "Recovered"
              ? { ...item, status: "Recovered by reset" }
              : item
          )
        );
      }

      setIncident(null);
      setAiAnalysis("");
      setAnalysisError("");
      setEvents([]);
      addEvent("System reset successfully", "success");

      await loadSystem(false);
    } catch (err) {
      setError(`Reset failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const recoveredIncidentCount = incidentHistory.filter((item) =>
    ["Recovered", "Recovered by reset"].includes(item.status)
  ).length;

  const recoveryRate = incidentHistory.length
    ? Math.round((recoveredIncidentCount / incidentHistory.length) * 100)
    : 0;

  const serviceCounts = incidentHistory.reduce((counts, item) => {
    counts[item.service_name] = (counts[item.service_name] || 0) + 1;
    return counts;
  }, {});

  const mostAffectedService = Object.entries(serviceCounts).sort(
    (a, b) => b[1] - a[1]
  )[0];

  const activeIncidentCount = incidentHistory.filter(
    (item) => item.status === "Active"
  ).length;

  const inProgressIncidentCount = incidentHistory.filter(
    (item) => item.status === "Recovery in progress"
  ).length;

  const incidentStatusTotal = incidentHistory.length || 1;

  const filteredIncidentHistory = incidentHistory.filter((item) => {
    const search = incidentSearch.trim().toLowerCase();

    const severity =
      item.severity ||
      getIncidentSeverity(item.service_name, item.failure_type);

    const matchesSearch =
      !search ||
      item.service_name?.toLowerCase().includes(search) ||
      item.failure_type?.toLowerCase().includes(search) ||
      item.status?.toLowerCase().includes(search) ||
      severity.toLowerCase().includes(search);

    const matchesSeverity =
      severityFilter === "All" || severity === severityFilter;

    const status = (item.status || "").toLowerCase();

    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Active" && status === "active") ||
      (statusFilter === "Recovered" &&
        ["recovered", "recovered by reset"].includes(status)) ||
      (statusFilter === "Recovery in Progress" &&
        status === "recovery in progress");

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const filteredEvents = events.filter((event) => {
    if (eventFilter === "all") return true;
    return event.type === eventFilter;
  });

  if (loading) {
    return (
      <main className="app-shell">
        <div className="loading-screen">
          <div className="loading-spinner" />
          <h2>Starting ChaosLab AI...</h2>
          <p>Connecting to your simulation backend.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell command-dashboard">
      <header className="app-header command-header">
        <div className="brand-block">
          <p className="eyebrow">AI-POWERED RESILIENCE SIMULATOR</p>
          <h1>ChaosLab <span>AI</span></h1>
          <p className="app-tagline">
            Break it. Observe it. Recover it.
          </p>
        </div>

        <div className="header-actions">
          <span className={`system-indicator ${failedServices.length ? "system-degraded" : ""}`}>
            <span className="status-dot" />
            {nonHealthyServices.length ? "System degraded" : "System monitored"}
          </span>

          <button
            className="button button-secondary"
            onClick={resetSystem}
            disabled={busy}
          >
            Reset System
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <strong>Error:</strong> {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}

      <section className="overview-heading">
        <div>
          <p className="eyebrow">COMMAND CENTER</p>
          <h2>System overview</h2>
          <p className="muted">
            Monitor service health, simulate incidents, and inspect AI recovery recommendations.
          </p>
        </div>

        <span className="overview-count">
          {nonHealthyServices.length === 0
            ? "ALL SYSTEMS NOMINAL"
            : `${nonHealthyServices.length} SERVICE${nonHealthyServices.length === 1 ? "" : "S"} NEED ATTENTION`}
        </span>
      </section>

      <section className="metrics-grid">
        <article className="metric-card">
          <span>Total services</span>
          <strong>{SERVICE_NAMES.length}</strong>
          <small>Services being monitored</small>
        </article>

        <article className="metric-card">
          <span>Healthy services</span>
          <strong>{healthyCount}</strong>
          <small>Currently operational</small>
        </article>

        <article className="metric-card">
          <span>Failed services</span>
          <strong>{failedServices.length}</strong>
          <small>Requiring attention</small>
        </article>

        <article className="metric-card">
          <span>Failure events</span>
          <strong>{events.filter((event) => event.type === "error").length}</strong>
          <small>Recorded in this session</small>
        </article>
      </section>

      <section className="workspace-grid">
        <article className="panel dependency-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">LIVE TOPOLOGY</p>
              <h2>Service dependency map</h2>
              <p className="muted">
                Follow connections between your services.
              </p>
            </div>

            <button
              className="button button-small"
              onClick={() => loadSystem()}
              disabled={busy}
            >
              Refresh
            </button>
          </div>

          <div className="dependency-map">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#344055" gap={20} />
              <Controls />
            </ReactFlow>
          </div>

          <div className="legend">
            <span><i className="legend-dot healthy" /> Healthy</span>
            <span><i className="legend-dot failed" /> Failed</span>
            <span><i className="legend-dot recovering" /> Recovering</span>
          </div>
        </article>

        <article className="panel failure-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">CHAOS EXPERIMENT</p>
              <h2>Failure controls</h2>
              <p className="muted">
                Inject a controlled failure and observe the impact.
              </p>
            </div>
          </div>

          <div className="failure-form">
            <label htmlFor="service-select">Target service</label>
            <select
              id="service-select"
              value={selectedService}
              onChange={(event) => setSelectedService(event.target.value)}
              disabled={busy}
            >
              {SERVICE_NAMES.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            <label htmlFor="failure-select">Failure type</label>
            <select
              id="failure-select"
              value={failureType}
              onChange={(event) => setFailureType(event.target.value)}
              disabled={busy}
            >
              <option value="shutdown">Shutdown</option>
              <option value="latency">High latency</option>
              <option value="overload">Overload</option>
            </select>

            <button
              className="button button-danger full-width"
              onClick={triggerFailure}
              disabled={busy}
            >
              {busy ? "Processing..." : "Trigger failure"}
            </button>
          </div>

          <div className="service-status-list">
            <div className="status-list-heading">
              <h3>Service health</h3>
              <span>{healthyCount}/{SERVICE_NAMES.length} healthy</span>
            </div>

            {SERVICE_NAMES.map((name) => {
              const status = services[name]?.status || "healthy";

              return (
                <div className="service-status-row" key={name}>
                  <div className="service-status-name">
                    <span className={`status-dot status-dot-${status}`} />
                    <span>{name}</span>
                  </div>

                  <span className={`status-label ${status}`}>
                    {status}
                  </span>

                  {status !== "healthy" && (
                    <button
                      className="button button-small"
                      onClick={() => recoverService(name)}
                      disabled={busy}
                    >
                      Recover
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="intelligence-grid">
        <article className="panel incident-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">INCIDENT INTELLIGENCE</p>
              <h2>Incident report</h2>
            </div>

            {incident && (
              <span className="incident-badge">
                {incidentResolved ? "Previous incident · recovered" : "Incident detected"}
              </span>
            )}
          </div>

          {!incident ? (
            <div className="empty-state">
              <span className="empty-state-icon">⌁</span>
              <h3>No active incident</h3>
              <p>
                Trigger a service failure to generate an incident report.
              </p>
            </div>
          ) : (
            <div className="incident-details">
              <div className="incident-summary">
                <div>
                  <span className="detail-label">Affected service</span>
                  <h3>{incident.service_name}</h3>
                </div>

                <div>
                  <span className="detail-label">Failure type</span>
                  <strong>{incident.failure_type}</strong>
                </div>

                <div>
                  <span className="detail-label">Severity</span>
                  <strong
                    className={`severity-badge severity-${(
                      incident.severity ||
                      getIncidentSeverity(
                        incident.service_name,
                        incident.failure_type
                      )
                    ).toLowerCase()}`}
                  >
                    {incident.severity ||
                      getIncidentSeverity(
                        incident.service_name,
                        incident.failure_type
                      )}
                  </strong>
                </div>

                <div>
                  <span className="detail-label">Detected at</span>
                  <strong>{incident.timestamp}</strong>
                </div>
              </div>

              <p>{incident.description}</p>

              {incidentResolved && (
                <div className="recovery-notice">
                  <strong>System recovered</strong>
                  <p>
                    All services are healthy. This report is kept as a record
                    of the previous incident; it does not mean the failure is
                    still active.
                  </p>
                </div>
              )}

              <div className="related-services">
                <strong>Related services</strong>
                <div className="related-service-tags">
                  {incident.related_services.map((name) => (
                    <span key={name}>{name}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </article>

        <article className="panel ai-analysis">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">GROQ AI</p>
              <h2>AI incident analysis</h2>
            </div>

            {analysisLoading && (
              <span className="analysis-status">
                <span className="loading-spinner small" />
                Analysing...
              </span>
            )}
          </div>

          {!incident ? (
            <div className="empty-state compact">
              <p>
                AI analysis will appear here after a failure is triggered.
              </p>
            </div>
          ) : analysisLoading ? (
            <div className="analysis-loading">
              <div className="loading-spinner" />
              <h3>Analysing the incident...</h3>
              <p>
                Groq AI is preparing the root cause, impact, recovery plan,
                and prevention recommendations.
              </p>
            </div>
          ) : analysisError ? (
            <div className="error-banner">
              <p>{analysisError}</p>
              <button onClick={() => analyzeIncident(incident)}>
                Retry analysis
              </button>
            </div>
          ) : aiAnalysis ? (
            <div className="ai-analysis-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h2 className="ai-report-title">{children}</h2>
                  ),
                  h2: ({ children }) => (
                    <h3 className="ai-report-heading">{children}</h3>
                  ),
                  h3: ({ children }) => (
                    <h4 className="ai-report-subheading">{children}</h4>
                  ),
                  p: ({ children }) => (
                    <p className="ai-report-paragraph">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="ai-report-list">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="ai-report-list ai-report-ordered">
                      {children}
                    </ol>
                  ),
                  table: ({ children }) => (
                    <div className="ai-table-wrap">
                      <table className="ai-report-table">{children}</table>
                    </div>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="ai-report-quote">
                      {children}
                    </blockquote>
                  ),
                  code: ({ children }) => (
                    <code className="ai-report-code">{children}</code>
                  ),
                  pre: ({ children }) => (
                    <pre className="ai-report-pre">{children}</pre>
                  ),
                  a: ({ children, href }) => (
                    <a href={href} target="_blank" rel="noreferrer">
                      {children}
                    </a>
                  ),
                }}
              >
                {aiAnalysis}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="empty-state compact">
              <p>No analysis text was received yet.</p>
              <button
                className="button button-secondary"
                onClick={() => analyzeIncident(incident)}
                disabled={analysisLoading}
              >
                Generate AI analysis
              </button>
            </div>
          )}
        </article>
      </section>

      <section className="panel event-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">SYSTEM ACTIVITY</p>
            <h2>Event log</h2>
          </div>

          <select
            aria-label="Filter event log"
            value={eventFilter}
            onChange={(event) => setEventFilter(event.target.value)}
          >
            <option value="all">All events</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="error">Errors</option>
          </select>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="empty-state compact">
            <p>No events to display. Start an experiment to see activity.</p>
          </div>
        ) : (
          <div className="event-list">
            {filteredEvents.map((event) => (
              <div className="event-row" key={event.id}>
                <span className="event-time">{event.time}</span>
                <span className={`event-type ${event.type}`}>
                  {event.type}
                </span>
                <span className="event-message">{event.message}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="metrics-grid incident-analytics">
        <article className="metric-card">
          <span>Total incidents</span>
          <strong>{incidentHistory.length}</strong>
          <small>Recorded in this browser</small>
        </article>
        <article className="metric-card">
          <span>Recovered incidents</span>
          <strong>{recoveredIncidentCount}</strong>
          <small>Recovery confirmed or reset</small>
        </article>
        <article className="metric-card">
          <span>Recovery rate</span>
          <strong>{recoveryRate}%</strong>
          <small>Based on recorded incidents</small>
        </article>
        <article className="metric-card">
          <span>Most affected service</span>
          <strong style={{ fontSize: "1.25rem" }}>
            {mostAffectedService ? mostAffectedService[0] : "—"}
          </strong>
          <small>
            {mostAffectedService
              ? `${mostAffectedService[1]} recorded incident${mostAffectedService[1] === 1 ? "" : "s"}`
              : "No incidents recorded"}
          </small>
        </article>
      </section>

      <section className="panel incident-chart-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">INCIDENT VISUALIZATION</p>
            <h2>Incident status overview</h2>
            <p className="muted">
              Live breakdown of incidents saved in this browser.
            </p>
          </div>
          <span className="overview-count">
            {incidentHistory.length} TOTAL
          </span>
        </div>

        {incidentHistory.length === 0 ? (
          <div className="empty-state compact">
            <p>Trigger a failure to populate the incident status chart.</p>
          </div>
        ) : (
          <div className="incident-chart">
            {[
              {
                label: "Recovered",
                count: recoveredIncidentCount,
                color: "#22c55e",
              },
              {
                label: "Active",
                count: activeIncidentCount,
                color: "#ef4444",
              },
              {
                label: "Recovery in Progress",
                count: inProgressIncidentCount,
                color: "#eab308",
              },
            ].map((item) => {
              const percentage = Math.round(
                (item.count / incidentStatusTotal) * 100
              );

              return (
                <div className="incident-chart-row" key={item.label}>
                  <div className="incident-chart-label">
                    <span>{item.label}</span>
                    <strong>
                      {item.count} · {percentage}%
                    </strong>
                  </div>
                  <div
                    className="incident-chart-track"
                    role="progressbar"
                    aria-label={`${item.label} incidents`}
                    aria-valuemin={0}
                    aria-valuemax={incidentHistory.length}
                    aria-valuenow={item.count}
                  >
                    <div
                      className="incident-chart-fill"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      
      <section className="panel event-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">INCIDENT RECORDS</p>
            <h2>Incident history</h2>
            <p className="muted">
              Search and filter incidents saved in this browser.
            </p>
          </div>
          <span className="overview-count">
            {filteredIncidentHistory.length} MATCHING / {incidentHistory.length} RECORDS
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <input
            type="search"
            value={incidentSearch}
            onChange={(event) => setIncidentSearch(event.target.value)}
            placeholder="Search incidents..."
            aria-label="Search incidents"
            style={{
              width: "100%",
              minWidth: 0,
              padding: "11px 12px",
              borderRadius: "8px",
              border: "1px solid #344055",
              background: "#111827",
              color: "#f8fafc",
            }}
          />

          <select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
            aria-label="Filter incidents by severity"
            style={{
              padding: "11px 12px",
              borderRadius: "8px",
              border: "1px solid #344055",
              background: "#111827",
              color: "#f8fafc",
            }}
          >
            <option value="All">All severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter incidents by status"
            style={{
              padding: "11px 12px",
              borderRadius: "8px",
              border: "1px solid #344055",
              background: "#111827",
              color: "#f8fafc",
            }}
          >
            <option value="All">All statuses</option>
            <option value="Active">Active</option>
            <option value="Recovered">Recovered</option>
            <option value="Recovery in Progress">
              Recovery in Progress
            </option>
          </select>

          <button
            className="button button-secondary"
            onClick={() => {
              setIncidentSearch("");
              setSeverityFilter("All");
              setStatusFilter("All");
            }}
          >
            Clear filters
          </button>
        </div>

        {filteredIncidentHistory.length === 0 ? (
          <div className="empty-state compact">
            <p>
              {incidentHistory.length === 0
                ? "No incidents recorded yet. Trigger a failure to create your first record."
                : "No incidents match your search or filters. Try changing them or clearing all filters."}
            </p>
          </div>
        ) : (
          <div className="event-list">
            {filteredIncidentHistory.map((item) => {
              const severity =
                item.severity ||
                getIncidentSeverity(item.service_name, item.failure_type);

              const recovered = [
                "Recovered",
                "Recovered by reset",
              ].includes(item.status);

              return (
                <div className="event-row" key={item.id}>
                  <span className="event-time">{item.timestamp}</span>

                  <span className="event-type error">
                    {item.failure_type}
                  </span>

                  <span
                    className={`severity-badge severity-${severity.toLowerCase()}`}
                  >
                    {severity}
                  </span>

                  <span className="event-message">
                    {item.service_name}
                  </span>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 9px",
                      borderRadius: "999px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      color: recovered
                        ? "#86efac"
                        : item.status === "Active"
                        ? "#fca5a5"
                        : "#fde68a",
                      background: recovered
                        ? "rgba(34, 197, 94, 0.12)"
                        : item.status === "Active"
                        ? "rgba(239, 68, 68, 0.12)"
                        : "rgba(234, 179, 8, 0.12)",
                    }}
                  >
                    {item.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>


      <style>{`
        .severity-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          padding: 4px 9px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          line-height: 1.4;
          white-space: nowrap;
        }

        .severity-critical {
          color: #fecaca;
          background: rgba(239, 68, 68, 0.18);
          border: 1px solid rgba(248, 113, 113, 0.35);
        }

        .severity-high {
          color: #fed7aa;
          background: rgba(249, 115, 22, 0.16);
          border: 1px solid rgba(251, 146, 60, 0.32);
        }

        .severity-medium {
          color: #fde68a;
          background: rgba(234, 179, 8, 0.14);
          border: 1px solid rgba(250, 204, 21, 0.3);
        }

        .severity-low {
          color: #bbf7d0;
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(74, 222, 128, 0.28);
        }

        .incident-chart {
          display: grid;
          gap: 20px;
          padding: 8px 0 4px;
        }

        .incident-chart-row {
          display: grid;
          gap: 9px;
        }

        .incident-chart-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: #dbe4f0;
          font-size: 0.9rem;
        }

        .incident-chart-label strong {
          color: #f8fafc;
          font-variant-numeric: tabular-nums;
          font-size: 0.85rem;
        }

        .incident-chart-track {
          width: 100%;
          height: 10px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.15);
        }

        .incident-chart-fill {
          height: 100%;
          min-width: 0;
          border-radius: inherit;
          transition: width 250ms ease;
        }
      `}</style>

      <footer className="app-footer">
        <span>ChaosLab AI</span>
        <span>AI-powered service failure and recovery simulation</span>
      </footer>
    </main>
  );
}

export default App;