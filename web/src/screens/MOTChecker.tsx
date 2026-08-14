import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Car, Calendar, ShieldAlert, Award, FileText, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

const MOCK_VEHICLES: Record<string, any> = {
  'AB18 CDE': {
    registration: 'AB18 CDE',
    make: 'FORD',
    model: 'FOCUS TDCI',
    year: '2018',
    color: 'Metallic Grey',
    fuelType: 'Diesel',
    engineSize: '1499cc',
    status: 'PASS',
    expiryDate: '12 July 2027',
    testDate: '13 July 2026',
    testNumber: '8910 2345 6789',
    mileage: '48,250 miles',
    advisories: [
      'Front brake pads wearing thin (minor)',
      'Nearside rear tyre worn close to legal limit (advisory)',
      'Front suspension arm pin or bush worn but not resulting in excessive movement (advisory)',
    ],
    failures: [],
  },
  'LD65 XYZ': {
    registration: 'LD65 XYZ',
    make: 'VAUXHALL',
    model: 'CORSA ECOFLEX',
    year: '2015',
    color: 'Red',
    fuelType: 'Petrol',
    engineSize: '1398cc',
    status: 'FAIL',
    expiryDate: 'Expired (14 Jan 2026)',
    testDate: '15 Jan 2026',
    testNumber: '1122 3344 5566',
    mileage: '67,890 miles',
    advisories: [
      'Nearside front tyre slightly damaged (advisory)',
      'Monitor oil leak from gearbox area (minor)',
    ],
    failures: [
      'Nearside front headlamp not working on dipped beam (major failure)',
      'Offside rear brake disc worn below limit (major failure)',
      'Exhaust emissions exceed limit values (major failure)',
    ],
  },
  'MH07 KKK': {
    registration: 'MH07 KKK',
    make: 'BMW',
    model: '320D M SPORT',
    year: '2019',
    color: 'White',
    fuelType: 'Diesel',
    engineSize: '1995cc',
    status: 'PASS',
    expiryDate: '28 October 2026',
    testDate: '29 October 2025',
    testNumber: '9988 7766 5544',
    mileage: '32,100 miles',
    advisories: [],
    failures: [],
  },
};

export default function MOTChecker() {
  const navigate = useNavigate();
  const [regNo, setRegNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPlate = regNo.trim().toUpperCase();
    if (!cleanPlate) return;

    setLoading(true);
    setResult(null);
    setHasSearched(true);

    setTimeout(() => {
      setLoading(false);
      let data = MOCK_VEHICLES[cleanPlate];
      if (!data) {
        // Dynamic mock data generation based on parity of plate length (mirroring mobile)
        const isPass = cleanPlate.length % 2 === 0;
        data = {
          registration: cleanPlate,
          make: 'TOYOTA',
          model: 'AURIS HYBRID',
          year: '2017',
          color: 'Silver',
          fuelType: 'Hybrid',
          engineSize: '1798cc',
          status: isPass ? 'PASS' : 'FAIL',
          expiryDate: isPass ? '18 October 2026' : 'Expired (05 April 2026)',
          testDate: isPass ? '19 October 2025' : '06 April 2026',
          testNumber: '5739 1234 4820',
          mileage: isPass ? '55,300 miles' : '82,140 miles',
          advisories: isPass ? ['Rear brake pads wearing close to limit'] : [],
          failures: isPass ? [] : ['Nearside rear shock absorber has a serious leak (major failure)'],
        };
      }
      setResult(data);
    }, 1000);
  };

  return (
    <div style={styles.container}>
      {/* Navbar Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.brand}>
            <div style={styles.logo}>
              <Car size={22} color="#FFFFFF" />
            </div>
            <span style={styles.brandName}>MOT Checker & Smart Garage</span>
          </div>
          <div style={styles.authLinks}>
            <Link to="/login" style={styles.loginLink}>Login</Link>
            <Link to="/signup" style={styles.signupBtn}>Sign Up</Link>
          </div>
        </div>
      </header>

      {/* Main SaaS Portal */}
      <main style={styles.main}>
        {/* Hero Section */}
        <section style={styles.heroSection}>
          <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
            <span style={{ 
              backgroundColor: 'rgba(79, 70, 229, 0.1)', 
              color: '#818CF8', 
              fontSize: '0.85rem', 
              fontWeight: '700', 
              padding: '0.4rem 1rem', 
              borderRadius: '20px', 
              textTransform: 'uppercase',
              letterSpacing: '1px',
              border: '1px solid rgba(79, 70, 229, 0.2)'
            }}>
              Automated Vehicle Maintenance SaaS
            </span>
            <h1 style={{ ...styles.title, fontSize: '3rem', marginTop: '1.5rem', lineHeight: '1.15' }}>
              Next-Gen Maintenance & <br />
              <span style={{ background: 'linear-gradient(135deg, #60A5FA 0%, #818CF8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Smart Garage Automation
              </span>
            </h1>
            <p style={{ ...styles.subtitle, fontSize: '1.15rem', color: 'var(--text-secondary)', maxWidth: '720px', margin: '1rem auto 2.5rem auto' }}>
              A complete vehicle maintenance ecosystem. Connect to live DVLA registries, schedule multi-channel alert reminders (SMS/Email/WhatsApp), log client response audits, and book appointments automatically.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                onClick={() => document.getElementById('checker-section')?.scrollIntoView({ behavior: 'smooth' })} 
                className="btn btn-primary" 
                style={{ padding: '0.8rem 2rem', fontSize: '1rem', boxShadow: '0 4px 15px rgba(79, 70, 229, 0.4)' }}
              >
                Check Vehicle History
              </button>
              <Link 
                to="/signup" 
                className="btn btn-outline" 
                style={{ padding: '0.8rem 2rem', fontSize: '1rem', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </section>

        {/* Feature Grid Showcase */}
        <section style={{ padding: '4rem 1.5rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'rgba(15, 23, 42, 0.3)' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0 }}>Far Ahead of a Simple MOT Checker</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Automated maintenance controls built for modern fleets and garage operators</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
              <div className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Car size={22} />
                </div>
                <h3 style={{ margin: 0, fontWeight: '700', fontSize: '1.1rem' }}>DVLA Fleet Registry</h3>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Look up vehicle plates instantly. Sync real-time specifications, MOT milestones, failure logs, and road safety advisories directly from registry services.
                </p>
              </div>

              <div className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '8px', backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldAlert size={22} />
                </div>
                <h3 style={{ margin: 0, fontWeight: '700', fontSize: '1.1rem' }}>Omnichannel Reminders</h3>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Send automated maintenance reminders via Email, SMS, and WhatsApp. Configure notification schedules at 45, 30, and 7 days.
                </p>
              </div>

              <div className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={22} />
                </div>
                <h3 style={{ margin: 0, fontWeight: '700', fontSize: '1.1rem' }}>Smart Booking Desk</h3>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Allocates morning and afternoon appointment slots. Offers calendar rescheduling, resource load checking, and notes logging.
                </p>
              </div>

              <div className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Award size={22} />
                </div>
                <h3 style={{ margin: 0, fontWeight: '700', fontSize: '1.1rem' }}>Self-Service Hub</h3>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Empower clients with secure, passwordless magic links. Customers can manage their vehicles, report sold status, and review schedules.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard Preview Stats Counter */}
        <section style={{ padding: '4rem 1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', textAlign: 'center' }} className="stats-grid">
              <div>
                <h2 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--primary)', margin: 0 }}>99.8%</h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Delivery Rate</p>
              </div>
              <div>
                <h2 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--secondary)', margin: 0 }}>15k+</h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Vehicles Monitored</p>
              </div>
              <div>
                <h2 style={{ fontSize: '2.5rem', fontWeight: '900', color: '#10B981', margin: 0 }}>88%</h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>MOT Pass Rate</p>
              </div>
              <div>
                <h2 style={{ fontSize: '2.5rem', fontWeight: '900', color: '#8B5CF6', margin: 0 }}>24/7</h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>DVLA Sync</p>
              </div>
            </div>
          </div>
        </section>

        {/* Process workflow steps */}
        <section style={{ padding: '4rem 1.5rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'rgba(15, 23, 42, 0.3)' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0 }}>Operational Workflow</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>How we automate maintenance milestones from scan to dispatch</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>1</div>
                <div>
                  <h4 style={{ margin: 0, fontWeight: '700', fontSize: '1.1rem' }}>Scan and Autofill Vehicle Specs</h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Type the registration number. The system retrieves specifications, years, colors, and MOT dates immediately from registry archives.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>2</div>
                <div>
                  <h4 style={{ margin: 0, fontWeight: '700', fontSize: '1.1rem' }}>Monitor Maintenance Deadlines</h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    The daily scan cron engine calculates exact days remaining, selecting vehicles due within reminder thresholds.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>3</div>
                <div>
                  <h4 style={{ margin: 0, fontWeight: '700', fontSize: '1.1rem' }}>Dispatch Custom Templates</h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Reminders are sent using templates set by operators. The messages contain passwordless magic links for easy booking.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>4</div>
                <div>
                  <h4 style={{ margin: 0, fontWeight: '700', fontSize: '1.1rem' }}>Manage Bookings & Slots</h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Customers book slots. Garage staff review notifications, adjust times, approve bookings, and download metrics.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DVLA MOT History Checker (Interactive Section) */}
        <section id="checker-section" style={{ padding: '5rem 1.5rem', scrollMarginTop: '60px' }}>
          <div style={{ maxWidth: '750px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0 0 0.5rem 0' }}>Interactive Plate Lookup Tool</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem' }}>
              Check any vehicle's status instantly using our simulated DVLA registry mirror.
            </p>

            <form onSubmit={handleSearch} style={styles.searchForm}>
              <div style={styles.inputContainer}>
                <div style={styles.plateDesign}>
                  <span style={styles.ukCountryCode}>GB</span>
                </div>
                <input
                  type="text"
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value)}
                  placeholder="E.g. AB18 CDE"
                  maxLength={8}
                  style={styles.searchInput}
                />
              </div>
              <button type="submit" disabled={loading} style={styles.searchBtn}>
                {loading ? 'Searching...' : <><Search size={18} /> Check Vehicle</>}
              </button>
            </form>
            <div style={styles.quickPlates}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '500' }}>Try these plates:</span>
              <button type="button" onClick={() => { setRegNo('AB18 CDE'); }} style={styles.quickPlateBtn}>AB18 CDE</button>
              <button type="button" onClick={() => { setRegNo('LD65 XYZ'); }} style={styles.quickPlateBtn}>LD65 XYZ</button>
              <button type="button" onClick={() => { setRegNo('MH07 KKK'); }} style={styles.quickPlateBtn}>MH07 KKK</button>
            </div>
          </div>
        </section>

        {/* Search Results Display */}
        {hasSearched && (
          <section style={styles.resultsSection} className="animate-fade-in">
            {loading ? (
              <div style={styles.loadingWrapper}>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
                  <div style={styles.spinner} />
                  <span style={{ fontWeight: '600' }}>Fetching registry details from DVLA database...</span>
                </div>
              </div>
            ) : result ? (
              <div className="card" style={styles.resultCard}>
                {/* Result Top Row */}
                <div style={styles.resultHeader}>
                  <div>
                    <div className="uk-plate" style={{ fontSize: '1.4rem', padding: '0.5rem 1.2rem' }}>
                      {result.registration}
                    </div>
                    <h2 style={styles.vehicleTitle}>{result.make} {result.model}</h2>
                    <p style={styles.vehicleMeta}>
                      Manufactured {result.year} • {result.color} • {result.fuelType} • {result.engineSize}
                    </p>
                  </div>

                  <div style={styles.statusSection}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>MOT STATUS</span>
                    <div style={{
                      ...styles.statusBadge,
                      backgroundColor: result.status === 'PASS' ? 'var(--success-light)' : 'var(--error-light)',
                      color: result.status === 'PASS' ? 'var(--success)' : 'var(--error)'
                    }}>
                      {result.status === 'PASS' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                      <span>{result.status}</span>
                    </div>
                  </div>
                </div>

                {/* Expiry Banner */}
                <div style={{
                  ...styles.expiryBanner,
                  backgroundColor: result.status === 'PASS' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  borderColor: result.status === 'PASS' ? 'var(--success)' : 'var(--error)'
                }}>
                  <Calendar size={20} color={result.status === 'PASS' ? 'var(--success)' : 'var(--error)'} />
                  <div>
                    <span style={{ fontWeight: '500', color: 'var(--text-secondary)' }}>
                      {result.status === 'PASS' ? 'MOT Expiry Date:' : 'MOT Status Warning:'}
                    </span>
                    <strong style={{ marginLeft: '0.35rem', color: result.status === 'PASS' ? 'var(--success)' : 'var(--error)' }}>
                      {result.expiryDate}
                    </strong>
                  </div>
                </div>

                {/* Technical stats grid */}
                <div style={styles.statsGrid}>
                  <div style={styles.statBox}>
                    <span style={styles.statLabel}>Latest Test Date</span>
                    <strong style={styles.statValue}>{result.testDate}</strong>
                  </div>
                  <div style={styles.statBox}>
                    <span style={styles.statLabel}>Recorded Mileage</span>
                    <strong style={styles.statValue}>{result.mileage}</strong>
                  </div>
                  <div style={styles.statBox}>
                    <span style={styles.statLabel}>DVLA Test Number</span>
                    <strong style={styles.statValue}>{result.testNumber}</strong>
                  </div>
                </div>

                {/* Failures List */}
                {result.failures && result.failures.length > 0 && (
                  <div style={styles.defectBlock}>
                    <h3 style={{ ...styles.defectTitle, color: 'var(--error)' }}>
                      <AlertTriangle size={18} /> Major Defects & Failures ({result.failures.length})
                    </h3>
                    <ul style={styles.defectList}>
                      {result.failures.map((fail: string, idx: number) => (
                        <li key={idx} style={styles.defectItem}>
                          <span style={styles.defectBullet}>•</span>
                          <span style={styles.defectText}>{fail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Advisories List */}
                <div style={styles.defectBlock}>
                  <h3 style={{ ...styles.defectTitle, color: 'var(--warning)' }}>
                    <ShieldAlert size={18} /> Minor Advisories & Warnings ({result.advisories.length})
                  </h3>
                  {result.advisories.length === 0 ? (
                    <p style={styles.emptyDefects}>No advisory warnings recorded during the test.</p>
                  ) : (
                    <ul style={styles.defectList}>
                      {result.advisories.map((adv: string, idx: number) => (
                        <li key={idx} style={styles.defectItem}>
                          <span style={styles.defectBullet}>•</span>
                          <span style={styles.defectText}>{adv}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Call to action */}
                <div style={styles.ctaRow}>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Want to receive automatic reminders and easily request bookings?
                  </p>
                  <Link to="/signup" style={styles.ctaLink}>
                    Register Account <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            ) : null}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer style={styles.footerBar}>
        <p style={{ margin: 0 }}>© 2026 Garage MOT Reminder Systems. Powered by local mock registry services.</p>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--bg-primary)',
  },
  header: {
    height: '70px',
    backgroundColor: '#0F172A',
    borderBottom: '1px solid #1E293B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 1.5rem',
  },
  headerContent: {
    width: '100%',
    maxWidth: '1200px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  logo: {
    backgroundColor: '#4F46E5',
    padding: '0.45rem',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontWeight: '800',
    color: '#FFFFFF',
    fontSize: '1.2rem',
    fontFamily: 'Outfit',
    letterSpacing: '-0.3px',
  },
  authLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
  },
  loginLink: {
    color: '#94A3B8',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '0.95rem',
    transition: 'color 0.2s',
  },
  signupBtn: {
    backgroundColor: '#4F46E5',
    color: '#FFFFFF',
    padding: '0.5rem 1.1rem',
    borderRadius: '6px',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '0.9rem',
    transition: 'background-color 0.2s',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '3rem 1.5rem',
  },
  heroSection: {
    textAlign: 'center',
    maxWidth: '740px',
    margin: '0 auto 3rem auto',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: '900',
    letterSpacing: '-0.75px',
    color: 'var(--text-primary)',
    marginBottom: '1rem',
    lineHeight: '1.15',
  },
  subtitle: {
    fontSize: '1.05rem',
    lineHeight: '1.6',
    color: 'var(--text-secondary)',
    marginBottom: '2rem',
  },
  searchForm: {
    display: 'flex',
    gap: '0.75rem',
    backgroundColor: 'var(--bg-secondary)',
    padding: '0.5rem',
    borderRadius: '12px',
    boxShadow: 'var(--card-shadow)',
    border: '1px solid var(--border-color)',
    alignItems: 'center',
  },
  inputContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    border: '1.5px solid var(--border-color)',
    borderRadius: '8px',
    overflow: 'hidden',
    height: '46px',
    backgroundColor: 'var(--bg-primary)',
  },
  plateDesign: {
    backgroundColor: '#002F6C', /* Blue bar */
    color: '#FFFFFF',
    fontSize: '0.65rem',
    fontWeight: 'bold',
    width: '32px',
    height: '100%',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: '4px',
    position: 'relative',
  },
  ukCountryCode: {
    letterSpacing: '0.5px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    padding: '0 1rem',
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    backgroundColor: 'transparent',
    textTransform: 'uppercase',
  },
  searchBtn: {
    backgroundColor: '#4F46E5',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    height: '46px',
    padding: '0 1.5rem',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  quickPlates: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    marginTop: '1.25rem',
  },
  quickPlateBtn: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    padding: '0.25rem 0.65rem',
    fontSize: '0.8rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  resultsSection: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  loadingWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '2rem',
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '3px solid var(--border-color)',
    borderTopColor: '#4F46E5',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  resultCard: {
    padding: '2rem',
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1.5rem',
    flexWrap: 'wrap',
    marginBottom: '1.5rem',
  },
  vehicleTitle: {
    fontSize: '1.6rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    marginTop: '0.75rem',
    marginBottom: '0.25rem',
  },
  vehicleMeta: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  statusSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.35rem',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.45rem 1rem',
    borderRadius: '8px',
    fontWeight: '800',
    fontSize: '0.95rem',
  },
  expiryBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem',
    borderRadius: '8px',
    borderLeft: '4px solid',
    marginBottom: '1.75rem',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
    marginBottom: '1.75rem',
  },
  statBox: {
    backgroundColor: 'var(--bg-tertiary)',
    padding: '1rem',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  statLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statValue: {
    fontSize: '1rem',
    color: 'var(--text-primary)',
    fontWeight: '700',
  },
  defectBlock: {
    marginBottom: '1.5rem',
  },
  defectTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.75rem',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '0.5rem',
  },
  defectList: {
    listStyleType: 'none',
    paddingLeft: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  defectItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
  },
  defectBullet: {
    color: 'var(--text-muted)',
    fontWeight: 'bold',
  },
  defectText: {
    fontSize: '0.925rem',
    color: 'var(--text-primary)',
    lineHeight: '1.4',
  },
  emptyDefects: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    margin: 0,
    fontStyle: 'italic',
  },
  ctaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '1.5rem',
    marginTop: '2rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  ctaLink: {
    color: '#4F46E5',
    textDecoration: 'none',
    fontWeight: '700',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    transition: 'transform 0.2s',
  },
  footerBar: {
    backgroundColor: '#0F172A',
    color: '#64748B',
    padding: '1.5rem',
    textAlign: 'center',
    fontSize: '0.85rem',
    borderTop: '1px solid #1E293B',
  },
};
