import './Legal.css'

const EFFECTIVE_DATE = 'August 8, 2026'

export default function Terms({ theme = 'light', onBack }) {
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
        <h1 className="legal-title">Terms of Service</h1>
        <p className="legal-meta">Effective date: {EFFECTIVE_DATE} · Governing law: Nepal</p>

        <div className="legal-highlight">
          <p>Vyapaar is a record-keeping tool, not certified accounting or tax software. Always verify your figures with a qualified accountant before filing any tax returns.</p>
        </div>

        <div className="legal-section">
          <h2>1. Acceptance of Terms</h2>
          <p>By creating an account or using Vyapaar ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These terms apply to all users of Vyapaar.</p>
        </div>

        <div className="legal-divider" />

        <div className="legal-section">
          <h2>2. Description of Service</h2>
          <p>Vyapaar is a web-based purchase management application that helps small businesses in Nepal track purchase invoices, supplier payments, and VAT figures. The Service is provided "as is" and is intended for record-keeping purposes only.</p>
          <p>Vyapaar is <strong>not</strong>:</p>
          <ul>
            <li>Certified accounting software</li>
            <li>A tax filing service</li>
            <li>A substitute for professional financial or legal advice</li>
            <li>An audited or government-approved system</li>
          </ul>
        </div>

        <div className="legal-divider" />

        <div className="legal-section">
          <h2>3. No Warranty — Data Accuracy</h2>
          <p>The Service is provided <strong>"as is" and "as available"</strong> without warranties of any kind, express or implied. We do not warrant that:</p>
          <ul>
            <li>The Service will be error-free or uninterrupted</li>
            <li>Data entered or displayed is accurate, complete, or legally valid</li>
            <li>Calculations (including VAT figures) are correct for your specific circumstances</li>
            <li>The Service meets requirements for any regulatory filing</li>
          </ul>
          <p>You are solely responsible for verifying all financial data before use in any official capacity.</p>
        </div>

        <div className="legal-divider" />

        <div className="legal-section">
          <h2>4. Limitation of Liability</h2>
          <p>To the maximum extent permitted by applicable law, Vyapaar and its creators shall not be liable for any direct, indirect, incidental, special, or consequential damages, including but not limited to:</p>
          <ul>
            <li>Financial losses arising from incorrect data or calculations</li>
            <li>Penalties or fines from tax authorities</li>
            <li>Loss of business data</li>
            <li>Loss of profits or revenue</li>
            <li>Any claim arising from reliance on information displayed in the Service</li>
          </ul>
          <p>Your sole remedy for dissatisfaction with the Service is to stop using it.</p>
        </div>

        <div className="legal-divider" />

        <div className="legal-section">
          <h2>5. User Responsibilities</h2>
          <p>You agree to:</p>
          <ul>
            <li>Provide accurate information when creating your account</li>
            <li>Keep your login credentials secure and confidential</li>
            <li>Use the Service only for lawful purposes</li>
            <li>Not attempt to access other users' data</li>
            <li>Not use the Service to store fraudulent or fabricated financial records</li>
          </ul>
        </div>

        <div className="legal-divider" />

        <div className="legal-section">
          <h2>6. Account Termination</h2>
          <p>You may delete your account at any time from the Settings page. Upon deletion, all your data — including purchase entries, supplier records, and payment history — will be permanently removed from our systems within 30 days.</p>
          <p>We reserve the right to suspend or terminate accounts that violate these Terms, with or without notice.</p>
        </div>

        <div className="legal-divider" />

        <div className="legal-section">
          <h2>7. Service Availability</h2>
          <p>We do not guarantee continuous, uninterrupted access to the Service. The Service may be temporarily unavailable due to maintenance, updates, or infrastructure issues. We are not liable for any losses caused by downtime.</p>
        </div>

        <div className="legal-divider" />

        <div className="legal-section">
          <h2>8. Changes to Terms</h2>
          <p>We reserve the right to update these Terms at any time. Continued use of the Service after changes are posted constitutes your acceptance of the revised Terms. We will update the effective date above when changes are made.</p>
        </div>

        <div className="legal-divider" />

        <div className="legal-section">
          <h2>9. Governing Law</h2>
          <p>These Terms are governed by the laws of Nepal. Any disputes shall be subject to the jurisdiction of the courts of Nepal.</p>
        </div>

        <div className="legal-contact">
          <p>Questions about these Terms? Contact us at <a href="mailto:legal@vyapaar.app">legal@vyapaar.app</a> — we'll respond within 5 business days.</p>
        </div>
      </div>
    </div>
  )
}
