/**
 * FetchBar — a branded top-of-page progress indicator.
 *
 * Shows only when `active` is true AND at least 150ms have elapsed
 * (so instant cache hits never flash it). Fades out smoothly when done.
 *
 * Design: brand-orange bar with a soft glow and a travelling highlight
 * shimmer — feels fast and intentional, not like a generic spinner.
 */
import { useEffect, useState } from 'react'
import './FetchBar.css'

export default function FetchBar({ active }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      // Fade out immediately when fetch completes
      setVisible(false)
      return
    }
    // Only show after 150ms — fast responses stay invisible
    const timer = setTimeout(() => setVisible(true), 150)
    return () => clearTimeout(timer)
  }, [active])

  return (
    <div className={`fetch-bar-track${visible ? ' fetch-bar-track--visible' : ''}`} aria-hidden="true">
      <div className="fetch-bar-fill" />
    </div>
  )
}
