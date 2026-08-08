import './Legal.css'

const EFFECTIVE_DATE = 'August 8, 2026'

export default function Privacy({ theme = 'light', onBack }) {
  return (
    <div className={`legal-page app-${theme}`}>
      <nav className="legal-nav">
        <div className="legal-nav-brand" onClick={onBack} role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onBack()}>
          <div className="legal-nav-logo">V</div>
          <span className="legal-nav-name">Vyapaar</span>
        </div>
        <button className="legal-nav-back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back
        </button>
      </nav>

      <div className="legal-container">
        <span className="legal-badge">Legal</span>
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-meta">Effective date: {EFFECTIVE_DATE} · Governing law: Nepal</p>

        <div className="legal-highlight">
          <p>We do not sell your data. We do not share it with advertisers. Your financial records belong to you.</p>
        </div>

        <div className="legal-section">
          <h2>1. Who We Are</h2>
          <p>Vyapaar is a purchase management application built for small businesses in Nepal. This Privacy Policy explains what personal data we collect, how we use it, and your rights over it.</p>
        </div>

        <div className="legal-divider" />

        <div className="legal-section">
          <h2>2. Data We Collect</h2>
          <p><strong>Account data:</strong></p>
          <ul>
            <li>Full name</li>
            <li>Email address</li>
            <li>Password (stored as a bcrypt hash — we cannot read your password)</li>
            <li>Date and time you agreed to these Terms</li>
          </ul>
          <p><strong>Business data you enter:</strong></p>
          <ul>
            <li>Business name, PAN, address</li>
            <li>Supplier names, PAN numbers, phone numbers</li>
            <li>Purchase invoice details (dates, amounts, VAT figures)</li>
            <li>Payment records</li>
          </ul>
          <p><strong>Technical data:</strong></p>
          <ul>
            <li>Timestamps of account creation and last login</li>
            <li>Server-side error logs (no personal data included)</li>
          </ul>
          <p>We do <strong>not</strong> collect: location data, device identifiers, browsing history, or analytics beyond what's described above.</p>
        </div>

        <div className="legal-divider" />

        <div className="legal-section">
          <h2>3. How We Use Your Data</h2>
          <ul>
            <li>To provide and operate the Service</li>
            <li>To authenticate your account and keep your session secure</li>
            <li>To display your business records back to you</li>
            <li>To send service-related emails if necessary (not marketing)</li>
          </ul>
          <p>We do <strong>not</strong> use your data for advertising, profiling, or any automated decision-making.</p>
        </div>

        <div className="legal-divider" />

        <div className="legal-section">
          <h2>4. Where Your Data Is Stored</h2>
          <p>Your data is stored in a PostgreSQL database hosted on <strong>Neon</strong> (neon.tech), with servers located in the <strong>Asia Pacific (Singapore)</strong> region. The application backend is hosted on <strong>Render</strong> (render.com) and the frontend on <strong>Vercel</strong> (vercel.com).</p>
          <p>These are third-party infrastructure providers. They do not have access to your business data and operate under their own privacy policies and security standards.</p>
        </div>

        <div className="legal-divider" />

        <div className="legal-section">
          <h2>5. Data Sharing</h2>
          <p>We do not sell, rent, or share your personal or business data with any third parties except:</p>
          <ul>
            <li>Infrastructure providers listed above (data storage and hosting only)</li>
            <li>If required by law or a valid legal order from a Nepali court</li>
          </ul>
        </div>

        <div className="legal-divider" />

        <div className="legal-section">
          <h2>6. Data Security</h2>
          <p>We use industry-standard protections including:</p>
          <ul>
            <li>HTTPS for all data in transit</li>
            <li>bcrypt password hashing (cost factor 12)</li>
            <li>JWT-based authentication with 7-day expiry</li>
            <li>All database queries scoped to your user ID — no cross-account data access</li>
          </ul>
          <p>No system is completely secure. We cannot guarantee absolute security of your data, and you use the Service at your own risk.</p>
        </div>

        <div className="legal-divider" />

        <div className="legal-section">
          <h2>7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access:</strong> View all data associated with your account within the app</li>
            <li><strong>Export:</strong> Download your purchase register as CSV from the Register page</li>
            <li><strong>Delete:</strong> Permanently delete your account and all associated data from Settings → Account → Delete Account. Deletion is irreversible and processed within 30 days.</li>
            <li><strong>Correct:</strong> Update your business profile and account details at any time in Settings</li>
          </ul>
          <p>To request a full data export or any other data-related request, contact us at the email below.</p>
        </div>

        <div className="legal-divider" />

        <div className="legal-section">
          <h2>8. Data Retention</h2>
          <p>We retain your data for as long as your account is active. If you delete your account, all personal and business data is permanently removed from our systems within 30 days. Anonymised, non-identifiable aggregate statistics may be retained.</p>
        </div>

        <div className="legal-divider" />

        <div className="legal-section">
          <h2>9. Cookies</h2>
          <p>We use a single HTTP-only cookie (<code>vyapaaar_token</code>) for authentication. This cookie:</p>
          <ul>
            <li>Is required for the Service to function</li>
            <li>Contains only your session token — no tracking data</li>
            <li>Expires after 7 days</li>
            <li>Is never shared with third parties</li>
          </ul>
          <p>We do not use advertising cookies, analytics cookies, or any third-party tracking scripts.</p>
        </div>

        <div className="legal-divider" />

        <div className="legal-section">
          <h2>10. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. The effective date above will be updated when changes are made. Continued use of the Service after changes constitutes acceptance of the revised Policy.</p>
        </div>

        <div className="legal-contact">
          <p>Questions or data requests? Contact us at <a href="mailto:privacy@vyapaar.app">privacy@vyapaar.app</a> — we'll respond within 5 business days.</p>
        </div>
      </div>
    </div>
  )
}
