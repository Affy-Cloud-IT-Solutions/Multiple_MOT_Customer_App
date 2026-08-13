import React, { useState, useEffect } from 'react';
import { useWebData, BASE_URL } from '../context/WebDataContext';
import { useToast } from '../components/Toast';
import { 
  FileClock, 
  Settings, 
  Download, 
  Play, 
  Save, 
  FileText, 
  Check, 
  Loader,
  AlertCircle,
  FileSpreadsheet,
  CalendarDays,
  Activity
} from 'lucide-react';

export default function AdminReminders() {
  const { showToast } = useToast();
  const { audits, vehicles, alerts, token, templates, saveTemplates, triggerCronScan, refreshData } = useWebData();

  const [activeTab, setActiveTab] = useState<'logs' | 'reports' | 'templates'>('logs');
  
  // Templates state
  const [t45, setT45] = useState('');
  const [t30, setT30] = useState('');
  const [t7, setT7] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Trigger scanning cron state
  const [triggeringCron, setTriggeringCron] = useState(false);

  useEffect(() => {
    if (templates) {
      setT45(templates.t45);
      setT30(templates.t30);
      setT7(templates.t7);
    }
  }, [templates]);

  const handleSaveTemplates = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTemplate(true);
    try {
      await saveTemplates({ t45, t30, t7 });
      showToast('Reminder templates saved successfully.');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to save templates.', 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleTriggerCron = async () => {
    if (!window.confirm('Trigger immediate daily scanning scan? This will run expiration checks for all active vehicles.')) return;
    
    setTriggeringCron(true);
    try {
      const res = await triggerCronScan();
      showToast(`Scan completed. Scanned: ${res.scannedCount || 0}, Dispatched Reminders: ${res.dispatchedCount || 0}`);
      await refreshData();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to trigger reminder check.', 'error');
    } finally {
      setTriggeringCron(false);
    }
  };

  const handleExport = (reportName: string, format: 'PDF' | 'Excel' | 'CSV') => {
    let endpoint = '';
    if (reportName === 'MOT Due Report') endpoint = 'due-mots';
    else if (reportName === 'Reminder Sent Report') endpoint = 'reminder-sent';
    else if (reportName === 'Customer Response Report') endpoint = 'customer-response';
    else if (reportName === 'Booked MOT Report') endpoint = 'booked-mots';

    const formatParam = format === 'Excel' ? 'excel' : format.toLowerCase();
    const downloadUrl = `${BASE_URL}/reports/${endpoint}?format=${formatParam}&token=${token}`;

    showToast(`Downloading ${reportName} in ${format} format...`);
    window.open(downloadUrl, '_blank');
  };

  // Dynamically compute stats for report cards
  const activeVehiclesCount = vehicles.filter(v => v.status === 'Active').length;
  const remindersSentCount = audits.filter(a => a.activity.toLowerCase().includes('sent') || a.activity.toLowerCase().includes('reminder')).length;
  const customerResponsesCount = audits.filter(a => a.activity.toLowerCase().includes('request') || a.activity.toLowerCase().includes('change') || a.activity.toLowerCase().includes('book')).length;
  const bookedMotsCount = alerts.filter(a => a.type === 'BOOKED').length;

  const reportsList = [
    { 
      name: 'MOT Due Report', 
      desc: 'Active vehicles scheduled for MOT renewal soon', 
      count: activeVehiclesCount, 
      tag: 'active vehicles', 
      color: '#F59E0B', 
      icon: <AlertCircle size={22} /> 
    },
    { 
      name: 'Reminder Sent Report', 
      desc: 'Audit records of automated communication logs', 
      count: remindersSentCount, 
      tag: 'dispatched', 
      color: '#8B5CF6', 
      icon: <FileClock size={22} /> 
    },
    { 
      name: 'Customer Response Report', 
      desc: 'Logs of client self-service portal actions', 
      count: customerResponsesCount, 
      tag: 'actions logged', 
      color: '#10B981', 
      icon: <Activity size={22} /> 
    },
    { 
      name: 'Booked MOT Report', 
      desc: 'Scheduled MOT appointments and slot usage metrics', 
      count: bookedMotsCount, 
      tag: 'appointments', 
      color: '#3B82F6', 
      icon: <CalendarDays size={22} /> 
    },
  ];

  return (
    <div className="animate-fade-in" style={{ padding: '0.5rem 0' }}>
      {/* Header Title */}
      <div style={styles.dashboardHeader}>
        <div>
          <h2 style={{ fontWeight: '800', fontSize: '1.6rem', margin: 0 }}>Reminders & Operations</h2>
          <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Configure schedules, generate operational reports, and trigger automated reminders scans.
          </p>
        </div>

        {activeTab === 'logs' && (
          <button 
            onClick={handleTriggerCron} 
            disabled={triggeringCron} 
            className="btn btn-secondary"
            style={{ height: '40px' }}
          >
            {triggeringCron ? (
              <Loader size={16} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Play size={16} />
            )}
            <span>Trigger Reminder Run</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <FileClock size={18} /> Audit logs
          </div>
        </button>
        <button className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <FileText size={18} /> Reports Export
          </div>
        </button>
        <button className={`tab-btn ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Settings size={18} /> Templates Setup
          </div>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'logs' && (
        <div className="animate-fade-in card">
          <h3 style={{ marginBottom: '1.25rem', fontWeight: '700' }}>Garage System Audit Trail</h3>

          {audits.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
              No system logs recorded yet.
            </p>
          ) : (
            <div style={styles.logList}>
              {audits.map((log) => {
                let borderLeftColor = 'var(--primary)';
                const act = log.activity.toLowerCase();
                
                if (act.includes('sent') || act.includes('send')) {
                  borderLeftColor = 'var(--success)';
                } else if (act.includes('book') || act.includes('slot')) {
                  borderLeftColor = 'var(--secondary)';
                } else if (act.includes('status') || act.includes('change') || act.includes('sold')) {
                  borderLeftColor = 'var(--warning)';
                } else if (act.includes('reject') || act.includes('fail')) {
                  borderLeftColor = 'var(--error)';
                }

                return (
                  <div 
                    key={log.id} 
                    style={{ ...styles.logCard, borderLeft: `4px solid ${borderLeftColor}` }}
                    className="animate-fade-in"
                  >
                    <div style={styles.logHeader}>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{log.activity}</span>
                      <span style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>{log.date}</span>
                    </div>
                    <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {log.details}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="animate-fade-in">
          <div className="responsive-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
            {reportsList.map((rep) => (
              <div 
                key={rep.name} 
                className="card card-hover" 
                style={{
                  ...styles.reportCard,
                  borderTop: `4px solid ${rep.color}`
                }}
              >
                <div style={styles.repHeader}>
                  <div style={{ ...styles.repIconWrapper, backgroundColor: `${rep.color}12`, color: rep.color }}>
                    {rep.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                      {rep.name}
                    </h4>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {rep.desc}
                    </p>
                  </div>
                </div>

                <div style={styles.repDetailsRow}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>RECORDS</span>
                  <span className="badge" style={{ backgroundColor: `${rep.color}15`, color: rep.color, fontWeight: 'bold' }}>
                    {rep.count} {rep.tag}
                  </span>
                </div>

                <div style={styles.exportActions}>
                  <button 
                    onClick={() => handleExport(rep.name, 'CSV')} 
                    className="btn btn-outline" 
                    style={{ ...styles.exportBtn, color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
                  >
                    <Download size={14} /> CSV
                  </button>
                  <button 
                    onClick={() => handleExport(rep.name, 'Excel')} 
                    className="btn btn-outline" 
                    style={{ ...styles.exportBtn, color: '#10B981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                  >
                    <FileSpreadsheet size={14} /> Excel
                  </button>
                  <button 
                    onClick={() => handleExport(rep.name, 'PDF')} 
                    className="btn btn-outline" 
                    style={{ ...styles.exportBtn, color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                  >
                    <FileText size={14} /> PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="animate-fade-in card" style={{ maxWidth: '720px' }}>
          <h3 style={{ marginBottom: '0.25rem', fontWeight: '700' }}>Customize Reminder Messaging</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Set standard templates for automated communications. You can use dynamic tags: <code>[Name]</code>, <code>[Vehicle]</code>, <code>[Reg]</code>, and <code>[Expiry]</code>.
          </p>

          <form onSubmit={handleSaveTemplates} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">45 Days Reminder (Friendly First Notice)</label>
              <textarea
                value={t45}
                onChange={(e) => setT45(e.target.value)}
                className="form-input"
                style={{ height: '70px', resize: 'none' }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">30 Days Reminder (Follow Up Notice)</label>
              <textarea
                value={t30}
                onChange={(e) => setT30(e.target.value)}
                className="form-input"
                style={{ height: '70px', resize: 'none' }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">7 Days Reminder (Urgent Warning Notice)</label>
              <textarea
                value={t7}
                onChange={(e) => setT7(e.target.value)}
                className="form-input"
                style={{ height: '70px', resize: 'none' }}
                required
              />
            </div>

            {/* Dynamic Tags Info */}
            <div style={styles.tagsInfo}>
              <strong style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem' }}>Placeholder Tags:</strong>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['[Name]', '[Vehicle]', '[Reg]', '[Expiry]'].map(tag => (
                  <span key={tag} style={styles.tagPill}>{tag}</span>
                ))}
              </div>
            </div>

            <button type="submit" disabled={savingTemplate} className="btn btn-primary" style={{ width: 'fit-content', padding: '0.65rem 2rem', marginLeft: 'auto' }}>
              {savingTemplate ? (
                <Loader size={16} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Save size={16} />
              )}
              <span>Save Templates</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  dashboardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  logList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  logCard: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '0.85rem 1.25rem',
  },
  logHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportCard: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  repHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
  },
  repIconWrapper: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  repDetailsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg-secondary)',
    padding: '0.65rem 1rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
  },
  exportActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  exportBtn: {
    flex: 1,
    padding: '0.5rem',
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
    fontWeight: 'bold',
  },
  tagsInfo: {
    backgroundColor: 'var(--bg-tertiary)',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
  },
  tagPill: {
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    fontSize: '0.785rem',
    fontWeight: '700',
    padding: '0.2rem 0.5rem',
    borderRadius: '6px',
  },
};
