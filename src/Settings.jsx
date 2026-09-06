import { useEffect, useState } from 'react'
import './Settings.css'

// ── Icons ─────────────────────────────────────────────────────────────────────
function SettingsIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>
}
function BuildingIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01"/></svg>
}
function CalendarIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
}
function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
}
function SaveIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
}
function UserIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
}
function TrashIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
}
function DatabaseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
}
function DownloadCloudIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/></svg>
}
function UploadCloudIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>
}

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

function getAuthHeaders() {
  const rawToken = localStorage.getItem('vyapaaar_token')
  const token = (rawToken && rawToken !== 'undefined' && rawToken !== 'null') ? rawToken : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

export default function Settings({ user, onToast, onLogout }) {
  const [businessProfile, setBusinessProfile] = useState({
    taxpayer_name: '',
    taxpayer_registration_no: '',
    pan: '',
    address: ''
  })
  const [fiscalPeriods, setFiscalPeriods] = useState([])
  const [newFiscalPeriod, setNewFiscalPeriod] = useState({
    fiscal_year_bs: '',
    bs_year: '',
    bs_month: '',
    fiscal_month_index: ''
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addingPeriod, setAddingPeriod] = useState(false)
  const [showAddPeriod, setShowAddPeriod] = useState(false)
  const [activeTab, setActiveTab] = useState('business-profile') // 'business-profile' | 'fiscal-periods' | 'backups' | 'account'
  const [profileBannerDismissed, setProfileBannerDismissed] = useState(false)
  // Backup & Restore state
  const [backupStats, setBackupStats]             = useState(null)
  const [downloadingBackup, setDownloadingBackup] = useState(false)
  const [restoringBackup, setRestoringBackup]     = useState(false)
  const [restoreFile, setRestoreFile]             = useState(null)
  const [restoreSummary, setRestoreSummary]       = useState(null)
  const [restoreError, setRestoreError]           = useState('')
  // Account deletion state
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')
  const [deleteError, setDeleteError]   = useState('')
  const [deleting, setDeleting]         = useState(false)
  const [deleteStep, setDeleteStep]     = useState(1) // 1=warning, 2=confirm input

  // Fetch business profile and fiscal periods on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [profileRes, periodsRes] = await Promise.all([
          fetch(`${API_URL}/api/settings/business-profile`, { credentials: 'include', headers: getAuthHeaders() }),
          fetch(`${API_URL}/api/fiscal-periods`, { credentials: 'include', headers: getAuthHeaders() })
        ])

        if (profileRes.ok) {
          const profileData = await profileRes.json()
          if (profileData.profile) {
            setBusinessProfile(profileData.profile)
          }
        }

        if (periodsRes.ok) {
          const periodsData = await periodsRes.json()
          setFiscalPeriods(periodsData.periods || [])
        }
      } catch (err) {
        console.error('Failed to fetch settings data:', err)
        if (onToast) onToast('Failed to load settings data', 'error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [onToast])

  // Handle business profile input change
  const handleProfileChange = (e) => {
    const { name, value } = e.target
    setBusinessProfile(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Handle fiscal period input change
  const handlePeriodChange = (e) => {
    const { name, value } = e.target
    setNewFiscalPeriod(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Save business profile
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/settings/business-profile`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(businessProfile)
      })
      if (res.ok) {
        if (onToast) onToast('Business profile saved successfully.', 'success')
      } else {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to save business profile')
      }
    } catch (err) {
      console.error('Failed to save business profile:', err)
      if (onToast) onToast(err.message || 'Failed to save business profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Add new fiscal period
  const handleAddPeriod = async (e) => {
    e.preventDefault()
    setAddingPeriod(true)
    try {
      const res = await fetch(`${API_URL}/api/fiscal-periods`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(newFiscalPeriod)
      })
      if (res.ok) {
        if (onToast) onToast('Fiscal period added successfully.', 'success')
        // Refresh the fiscal periods list
        const periodsRes = await fetch(`${API_URL}/api/fiscal-periods`, {
          credentials: 'include',
          headers: getAuthHeaders()
        })
        if (periodsRes.ok) {
          const periodsData = await periodsRes.json()
          setFiscalPeriods(periodsData.periods || [])
        }
        // Reset form & hide
        setNewFiscalPeriod({
          fiscal_year_bs: '',
          bs_year: '',
          bs_month: '',
          fiscal_month_index: ''
        })
        setShowAddPeriod(false)
      } else {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to add fiscal period')
      }
    } catch (err) {
      console.error('Failed to add fiscal period:', err)
      if (onToast) onToast(err.message || 'Failed to add fiscal period', 'error')
    } finally {
      setAddingPeriod(false)
    }
  }

  // Backup & Restore logic
  const fetchBackupStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings/backup/stats`, {
        credentials: 'include',
        headers: getAuthHeaders()
      })
      if (res.ok) {
        const data = await res.json()
        setBackupStats(data.stats)
      }
    } catch (err) {
      console.error('Failed to fetch backup stats:', err)
    }
  }

  useEffect(() => {
    if (activeTab === 'backups') {
      fetchBackupStats()
    }
  }, [activeTab])

  const handleDownloadBackup = async () => {
    setDownloadingBackup(true)
    try {
      const res = await fetch(`${API_URL}/api/settings/backup/download`, {
        credentials: 'include',
        headers: getAuthHeaders()
      })
      if (!res.ok) throw new Error('Failed to generate backup')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vyapaar-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      if (onToast) onToast('Complete database snapshot downloaded to your device!', 'success')
    } catch (err) {
      console.error(err)
      if (onToast) onToast('Download failed: ' + err.message, 'error')
    } finally {
      setDownloadingBackup(false)
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    setRestoreError('')
    setRestoreSummary(null)
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result)
        if (json.app !== 'Vyapaar' || !json.data) {
          setRestoreError('Invalid backup file. Must be an official Vyapaar JSON backup.')
          setRestoreFile(null)
          return
        }
        setRestoreFile(file)
        setRestoreSummary({
          exported_at: json.exported_at,
          suppliers: json.counts?.suppliers ?? json.data?.suppliers?.length ?? 0,
          purchase_entries: json.counts?.purchase_entries ?? json.data?.purchase_entries?.length ?? 0,
          payments: json.counts?.supplier_payments ?? json.data?.supplier_payments?.length ?? 0,
        })
      } catch {
        setRestoreError('Could not parse file. Please upload a valid JSON backup file.')
        setRestoreFile(null)
      }
    }
    reader.readAsText(file)
  }

  const handleRestoreSubmit = async () => {
    if (!restoreFile) return
    setRestoringBackup(true)
    setRestoreError('')
    try {
      const text = await restoreFile.text()
      const json = JSON.parse(text)
      const res = await fetch(`${API_URL}/api/settings/backup/restore`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ backup: json })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Restore failed')
      setRestoreFile(null)
      setRestoreSummary(null)
      fetchBackupStats()
      if (onToast) onToast(`Restored ${result.restored.purchase_entries} bills and ${result.restored.suppliers} suppliers!`, 'success')
    } catch (err) {
      console.error(err)
      setRestoreError(err.message)
      if (onToast) onToast('Restore failed: ' + err.message, 'error')
    } finally {
      setRestoringBackup(false)
    }
  }

  return (
    <div className="set-page">
      {/* Header */}
      <div className="set-header">
        <div>
          <h2 className="set-title">Settings</h2>
          <p className="set-subtitle">Manage business profile credentials, BS fiscal period calendar, and data backups</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="set-tabs">
        <button
          type="button"
          className={`set-tab ${activeTab === 'business-profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('business-profile')}
        >
          <BuildingIcon />
          <span>Business Profile</span>
        </button>
        <button
          type="button"
          className={`set-tab ${activeTab === 'fiscal-periods' ? 'active' : ''}`}
          onClick={() => setActiveTab('fiscal-periods')}
        >
          <CalendarIcon />
          <span>Fiscal Periods</span>
        </button>
        <button
          type="button"
          className={`set-tab ${activeTab === 'backups' ? 'active' : ''}`}
          onClick={() => setActiveTab('backups')}
        >
          <DatabaseIcon />
          <span>Data & Backups</span>
        </button>
        <button
          type="button"
          className={`set-tab ${activeTab === 'account' ? 'active' : ''}`}
          onClick={() => setActiveTab('account')}
        >
          <UserIcon />
          <span>Account</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="set-content">
        {activeTab === 'business-profile' && (
          <div className="set-card">
            <div className="set-card-header">
              <div>
                <h3 className="set-card-title">Business Information</h3>
                <p className="set-card-desc">Configure your taxpayer name, registration number, PAN, and official address</p>
              </div>
            </div>
            <div className="set-card-divider" />

            {/* Incomplete profile warning */}
            {!profileBannerDismissed && !loading && (
              (businessProfile.taxpayer_name === 'My Business' ||
               !businessProfile.taxpayer_name ||
               !businessProfile.pan) && (
                <div className="set-incomplete-banner">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <div className="set-incomplete-text">
                    <strong>Profile incomplete.</strong> Fill in your real taxpayer name, PAN, and registration number before generating IRD reports. Using placeholder data will result in invalid submissions.
                  </div>
                  <button className="set-incomplete-dismiss" onClick={() => setProfileBannerDismissed(true)} aria-label="Dismiss">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              )
            )}

            <form onSubmit={handleSaveProfile} className="set-form">
              <div className="set-grid">
                <div className="set-field">
                  <label className="set-label" htmlFor="taxpayer_name">
                    TAXPAYER NAME <span className="set-req">*</span>
                  </label>
                  <input
                    className="set-input"
                    id="taxpayer_name"
                    name="taxpayer_name"
                    type="text"
                    placeholder="e.g. Kathmandu Traders Pvt. Ltd."
                    value={businessProfile.taxpayer_name}
                    onChange={handleProfileChange}
                    required
                  />
                </div>

                <div className="set-field">
                  <label className="set-label" htmlFor="taxpayer_registration_no">
                    REGISTRATION NO.
                  </label>
                  <input
                    className="set-input"
                    id="taxpayer_registration_no"
                    name="taxpayer_registration_no"
                    type="text"
                    placeholder="e.g. REG-109283-NP"
                    value={businessProfile.taxpayer_registration_no}
                    onChange={handleProfileChange}
                  />
                </div>

                <div className="set-field">
                  <label className="set-label" htmlFor="pan">
                    PAN / VAT NO.
                  </label>
                  <input
                    className="set-input set-mono"
                    id="pan"
                    name="pan"
                    type="text"
                    placeholder="e.g. 601928374"
                    value={businessProfile.pan}
                    onChange={handleProfileChange}
                  />
                </div>

                <div className="set-field set-span-full">
                  <label className="set-label" htmlFor="address">
                    REGISTERED ADDRESS
                  </label>
                  <textarea
                    className="set-input set-textarea"
                    id="address"
                    name="address"
                    rows={3}
                    placeholder="Full street address, Ward No., City, District"
                    value={businessProfile.address}
                    onChange={handleProfileChange}
                  />
                </div>
              </div>

              <div className="set-form-actions">
                <button type="submit" className="set-btn-primary" disabled={saving}>
                  <span>{saving ? 'Saving Profile...' : 'Save Profile'}</span>
                  {saving ? <span className="set-spinner" aria-hidden="true" /> : <SaveIcon />}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'fiscal-periods' && (
          <div className="set-card">
            <div className="set-card-header set-flex-header">
              <div>
                <h3 className="set-card-title">Fiscal Periods</h3>
                <p className="set-card-desc">Define and manage financial calendar periods according to Nepal government rules</p>
              </div>
              <button
                type="button"
                className={`set-btn-secondary ${showAddPeriod ? 'active' : ''}`}
                onClick={() => setShowAddPeriod(v => !v)}
              >
                <PlusIcon />
                <span>{showAddPeriod ? 'Close Form' : 'Add New Period'}</span>
              </button>
            </div>
            <div className="set-card-divider" />

            {showAddPeriod && (
              <form onSubmit={handleAddPeriod} className="set-form set-add-period-panel">
                <h4 className="set-form-subheading">CREATE NEW FISCAL PERIOD</h4>
                <div className="set-grid">
                  <div className="set-field">
                    <label className="set-label" htmlFor="fiscal_year_bs">
                      FISCAL YEAR (BS) <span className="set-req">*</span>
                    </label>
                    <input
                      className="set-input"
                      id="fiscal_year_bs"
                      name="fiscal_year_bs"
                      type="text"
                      placeholder="e.g. 2081/82"
                      value={newFiscalPeriod.fiscal_year_bs}
                      onChange={handlePeriodChange}
                      required
                    />
                  </div>

                  <div className="set-field">
                    <label className="set-label" htmlFor="bs_year">
                      BS YEAR <span className="set-req">*</span>
                    </label>
                    <input
                      className="set-input"
                      id="bs_year"
                      name="bs_year"
                      type="number"
                      min="2000"
                      max="2150"
                      placeholder="e.g. 2081"
                      value={newFiscalPeriod.bs_year}
                      onChange={handlePeriodChange}
                      required
                    />
                  </div>

                  <div className="set-field">
                    <label className="set-label" htmlFor="bs_month">
                      BS MONTH <span className="set-req">*</span>
                    </label>
                    <input
                      className="set-input"
                      id="bs_month"
                      name="bs_month"
                      type="number"
                      min="1"
                      max="12"
                      placeholder="1 - 12"
                      value={newFiscalPeriod.bs_month}
                      onChange={handlePeriodChange}
                      required
                    />
                  </div>

                  <div className="set-field">
                    <label className="set-label" htmlFor="fiscal_month_index">
                      FISCAL MONTH INDEX <span className="set-req">*</span>
                    </label>
                    <input
                      className="set-input"
                      id="fiscal_month_index"
                      name="fiscal_month_index"
                      type="number"
                      min="1"
                      max="12"
                      placeholder="1 - 12"
                      value={newFiscalPeriod.fiscal_month_index}
                      onChange={handlePeriodChange}
                      required
                    />
                  </div>
                </div>

                <div className="set-form-actions">
                  <button type="submit" className="set-btn-primary" disabled={addingPeriod}>
                    <span>{addingPeriod ? 'Adding Period...' : 'Save Fiscal Period'}</span>
                    {addingPeriod ? <span className="set-spinner" aria-hidden="true" /> : <PlusIcon />}
                  </button>
                </div>
              </form>
            )}

            <div className="set-table-wrap">
              <table className="set-table">
                <thead>
                  <tr>
                    <th>Fiscal Year (BS)</th>
                    <th>BS Year</th>
                    <th>BS Month</th>
                    <th>Fiscal Month Index</th>
                    <th className="set-col-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && [...Array(3)].map((_, i) => (
                    <tr key={i} className="set-skeleton-row">
                      {[...Array(5)].map((_, j) => (
                        <td key={j}>
                          <span className="set-skeleton" style={{ width: `${45 + j * 10}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))}

                  {!loading && fiscalPeriods.length === 0 && (
                    <tr>
                      <td colSpan={5} className="set-empty">
                        <div className="set-empty-inner">
                          <p className="set-empty-title">No fiscal periods defined yet</p>
                          <p className="set-empty-body">Define your first Nepal BS fiscal period to start tracking accounting cycles.</p>
                          {!showAddPeriod && (
                            <button className="set-empty-btn" onClick={() => setShowAddPeriod(true)}>
                              <PlusIcon /> Add Fiscal Period
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading && fiscalPeriods.map((period, index) => (
                    <tr key={period.id || index} className="set-row">
                      <td>
                        <span className="set-fy-badge">{period.fiscal_year_bs || '—'}</span>
                      </td>
                      <td className="set-td-muted">{period.bs_year || '—'}</td>
                      <td className="set-td-muted">{period.bs_month || '—'}</td>
                      <td className="set-td-muted">{period.fiscal_month_index || '—'}</td>
                      <td className="set-col-right">
                        <span className="set-status-pill">Configured</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Account Tab ── */}
        {activeTab === 'backups' && (
          <div className="set-card">
            <div className="set-card-header">
              <div>
                <h3 className="set-card-title">Data Backup & Cloud Safety (डेटा ब्याकअप)</h3>
                <p className="set-card-desc">
                  Protect your business records. Download offline snapshots or restore data anytime with complete peace of mind.
                </p>
              </div>
            </div>
            <div className="set-card-divider" />

            {/* Cloud Health & Free Tier Reality Info */}
            <div className="set-backup-health-banner">
              <div className="set-backup-health-icon">
                <DatabaseIcon />
              </div>
              <div className="set-backup-health-content">
                <div className="set-backup-health-title">
                  <span>Neon PostgreSQL Cloud:</span>
                  <span className="set-badge-healthy">Active Free Tier (0.5 GB Quota)</span>
                </div>
                <p className="set-backup-health-text">
                  Your billing and supplier data consists of lightweight text records. A <strong>500 MB quota stores over 200,000+ invoices</strong> (decades of typical SME business). However, saving periodic offline backups guarantees you never lose access if cloud hosting policies ever change or expire.
                </p>
              </div>
            </div>

            {/* Record summary stats */}
            <div className="set-backup-stats-row">
              <div className="set-backup-stat-card">
                <span className="set-backup-stat-val">{backupStats?.suppliers ?? '—'}</span>
                <span className="set-backup-stat-lbl">Suppliers</span>
              </div>
              <div className="set-backup-stat-card">
                <span className="set-backup-stat-val">{backupStats?.purchase_entries ?? '—'}</span>
                <span className="set-backup-stat-lbl">Purchase Invoices</span>
              </div>
              <div className="set-backup-stat-card">
                <span className="set-backup-stat-val">{backupStats?.payments ?? '—'}</span>
                <span className="set-backup-stat-lbl">Payments</span>
              </div>
              <div className="set-backup-stat-card">
                <span className="set-backup-stat-val">{backupStats?.fiscal_periods ?? '—'}</span>
                <span className="set-backup-stat-lbl">Fiscal Periods</span>
              </div>
            </div>

            <div className="set-card-divider" />

            {/* 1-Click Manual Backup Download */}
            <div className="set-backup-section">
              <div className="set-backup-section-header">
                <div>
                  <h4 className="set-backup-section-title">1. One-Click Complete Data Backup</h4>
                  <p className="set-backup-section-desc">
                    Download an offline JSON snapshot of all your suppliers, purchase bills, and payments directly to your mobile phone or computer.
                  </p>
                </div>
                <button
                  type="button"
                  className="set-btn-primary set-btn-backup-download"
                  onClick={handleDownloadBackup}
                  disabled={downloadingBackup}
                >
                  <DownloadCloudIcon />
                  <span>{downloadingBackup ? 'Generating Backup…' : 'Download Complete Backup (.json)'}</span>
                </button>
              </div>
            </div>

            <div className="set-card-divider" />

            {/* Restore from Backup */}
            <div className="set-backup-section">
              <h4 className="set-backup-section-title">2. Restore / Import from Backup</h4>
              <p className="set-backup-section-desc">
                Need to recover data or transfer to another device? Upload your previously downloaded Vyapaar JSON backup file below.
              </p>

              <div className="set-restore-box">
                <label className="set-restore-dropzone">
                  <UploadCloudIcon />
                  <span className="set-restore-dropzone-text">
                    {restoreFile ? restoreFile.name : 'Click or tap to select Vyapaar backup JSON file'}
                  </span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </label>

                {restoreError && (
                  <div className="set-restore-error">
                    {restoreError}
                  </div>
                )}

                {restoreSummary && (
                  <div className="set-restore-preview">
                    <div className="set-restore-preview-title">
                      ✓ Valid Backup File Detected ({new Date(restoreSummary.exported_at).toLocaleDateString()})
                    </div>
                    <div className="set-restore-preview-details">
                      Contains {restoreSummary.purchase_entries} invoices, {restoreSummary.suppliers} suppliers, and {restoreSummary.payments} payments.
                    </div>
                    <button
                      type="button"
                      className="set-btn-primary set-btn-restore"
                      onClick={handleRestoreSubmit}
                      disabled={restoringBackup}
                    >
                      {restoringBackup ? 'Restoring records…' : 'Confirm & Restore Records'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="set-card-divider" />

            {/* Automated GitHub Actions Backup Info */}
            <div className="set-backup-section">
              <h4 className="set-backup-section-title">3. Automated Scheduled Cloud Backups ($0 / Month)</h4>
              <p className="set-backup-section-desc">
                An automated GitHub Action workflow (<code>.github/workflows/db-backup.yml</code>) runs on a weekly schedule. Every Sunday at midnight UTC, it automatically executes <code>pg_dump</code> against your Neon PostgreSQL instance, compresses it, and securely saves the archive in your private GitHub repository at zero cost.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'account' && (
          <div className="set-card">
            <div className="set-card-header">
              <div>
                <h3 className="set-card-title">Account</h3>
                <p className="set-card-desc">Manage your account details and data</p>
              </div>
            </div>
            <div className="set-card-divider" />

            {/* Account info */}
            <div className="set-account-info">
              <div className="set-account-avatar">{user?.full_name?.[0]?.toUpperCase() ?? '?'}</div>
              <div>
                <div className="set-account-name">{user?.full_name}</div>
                <div className="set-account-email">{user?.email}</div>
              </div>
            </div>

            {/* Legal links */}
            <div className="set-legal-row">
              <a href="#terms" target="_blank" rel="noopener noreferrer" className="set-legal-link">
                Terms of Service
              </a>
              <span className="set-legal-sep">·</span>
              <a href="#privacy" target="_blank" rel="noopener noreferrer" className="set-legal-link">
                Privacy Policy
              </a>
            </div>

            <div className="set-card-divider" style={{ marginTop: 24 }} />

            {/* Danger zone */}
            <div className="set-danger-zone">
              <div className="set-danger-header">
                <TrashIcon />
                <div>
                  <div className="set-danger-title">Delete Account</div>
                  <div className="set-danger-desc">Permanently delete your account and all data — purchases, suppliers, payments. This cannot be undone.</div>
                </div>
              </div>

              {deleteStep === 1 && (
                <button
                  className="set-danger-btn"
                  onClick={() => { setDeleteStep(2); setDeleteError('') }}
                >
                  Delete my account
                </button>
              )}

              {deleteStep === 2 && (
                <div className="set-danger-confirm">
                  <p className="set-danger-confirm-label">
                    Type your email address <strong>{user?.email}</strong> to confirm:
                  </p>
                  <input
                    className="set-danger-input"
                    type="email"
                    placeholder={user?.email}
                    value={deleteConfirmEmail}
                    onChange={e => { setDeleteConfirmEmail(e.target.value); setDeleteError('') }}
                    autoComplete="off"
                  />
                  {deleteError && (
                    <p className="set-danger-error" role="alert">{deleteError}</p>
                  )}
                  <div className="set-danger-actions">
                    <button
                      className="set-btn-secondary"
                      type="button"
                      onClick={() => { setDeleteStep(1); setDeleteConfirmEmail(''); setDeleteError('') }}
                      disabled={deleting}
                    >
                      Cancel
                    </button>
                    <button
                      className="set-danger-btn-confirm"
                      type="button"
                      disabled={deleting || !deleteConfirmEmail}
                      onClick={async () => {
                        setDeleting(true)
                        setDeleteError('')
                        try {
                          const res = await fetch(`${API_URL}/api/settings/account`, {
                            method: 'DELETE',
                            headers: getAuthHeaders(),
                            credentials: 'include',
                            body: JSON.stringify({ confirm_email: deleteConfirmEmail }),
                          })
                          const json = await res.json().catch(() => ({}))
                          if (!res.ok) {
                            setDeleteError(json.error ?? 'Deletion failed. Please try again.')
                            setDeleting(false)
                            return
                          }
                          // Clear local session and log out
                          localStorage.removeItem('vyapaar_has_session')
                          localStorage.removeItem('vyapaaar_token')
                          if (onLogout) onLogout()
                        } catch {
                          setDeleteError('Could not reach the server. Check your connection.')
                          setDeleting(false)
                        }
                      }}
                    >
                      {deleting
                        ? <span className="auth-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} aria-hidden="true" />
                        : <><TrashIcon /> Delete permanently</>
                      }
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
