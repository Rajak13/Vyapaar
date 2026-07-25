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

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')


export default function Settings({ user, onToast }) {
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
  const [activeTab, setActiveTab] = useState('business-profile') // 'business-profile' | 'fiscal-periods'
  const [profileBannerDismissed, setProfileBannerDismissed] = useState(false)

  // Fetch business profile and fiscal periods on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [profileRes, periodsRes] = await Promise.all([
          fetch(`${API_URL}/api/settings/business-profile`, { credentials: 'include' }),
          fetch(`${API_URL}/api/fiscal-periods`, { credentials: 'include' })
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newFiscalPeriod)
      })
      if (res.ok) {
        if (onToast) onToast('Fiscal period added successfully.', 'success')
        // Refresh the fiscal periods list
        const periodsRes = await fetch(`${API_URL}/api/fiscal-periods`, {
          credentials: 'include'
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

  return (
    <div className="set-page">
      {/* Header */}
      <div className="set-header">
        <div>
          <h2 className="set-title">Settings</h2>
          <p className="set-subtitle">Manage business profile credentials and BS fiscal period calendar</p>
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
      </div>
    </div>
  )
}
