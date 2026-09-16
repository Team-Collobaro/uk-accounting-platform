with open('app/(dashboard)/course/[moduleId]/page.tsx', 'r') as f:
    content = f.read()

old_vars = """  const activeMobileIncidents = Object.entries(mobileIncidents)
  const hardMobileIncident = activeMobileIncidents.find(([, incident]) => incident.severity === 'hard')
  const isMobileViolating = activeMobileIncidents.length > 0
  const mobileWarning = hardMobileIncident?.[1].message || activeMobileIncidents[0]?.[1].message || ''"""

new_vars = """  const activeMobileIncidents = Object.entries(mobileIncidents)
  const hardMobileIncidents = activeMobileIncidents.filter(([, incident]) => incident.severity === 'hard' || incident.severity === 'technical')
  const warningMobileIncidents = activeMobileIncidents.filter(([, incident]) => incident.severity === 'warning' || incident.severity === 'soft')
  const hardMobileIncident = hardMobileIncidents[0]"""

content = content.replace(old_vars, new_vars)

old_ui = """            {isMobileViolating && mobileWarning && (
              <div
                role="alert"
                aria-live="assertive"
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  marginBottom: 20,
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(239, 68, 68, 0.55)',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>
                    Mobile Camera Warning
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--ink)' }}>
                    {activeMobileIncidents.map(([type, incident]) => (
                      <div key={type} style={{ marginBottom: 4 }}>{incident.message}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}"""

new_ui = """            {hardMobileIncidents.length > 0 && (
              <div
                role="alert"
                aria-live="assertive"
                style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12,
                  padding: '12px 14px', borderRadius: 10,
                  border: '1px solid rgba(239, 68, 68, 0.55)', background: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444', fontFamily: 'Inter, sans-serif',
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>🛑</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>
                    Monitoring Incident (Exam Locked)
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--ink)' }}>
                    {hardMobileIncidents.map(([type, incident]) => (
                      <div key={type} style={{ marginBottom: 4 }}>{incident.message}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {warningMobileIncidents.length > 0 && (
              <div
                role="alert"
                aria-live="polite"
                style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20,
                  padding: '12px 14px', borderRadius: 10,
                  border: '1px solid rgba(245, 158, 11, 0.55)', background: 'rgba(245, 158, 11, 0.12)',
                  color: '#d97706', fontFamily: 'Inter, sans-serif',
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>
                    Provisional Warning
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--ink)' }}>
                    {warningMobileIncidents.map(([type, incident]) => (
                      <div key={type} style={{ marginBottom: 4 }}>{incident.message}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}"""

content = content.replace(old_ui, new_ui)

with open('app/(dashboard)/course/[moduleId]/page.tsx', 'w') as f:
    f.write(content)
