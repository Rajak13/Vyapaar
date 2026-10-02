import { useEffect, useRef } from 'react'
import './LandingPage.css'

export default function LandingPage({ theme }) {
  const trackRef = useRef(null)
  const podRef = useRef(null)
  const leftRef = useRef(null)
  const rightRef = useRef(null)
  const centerRef = useRef(null)
  const vignetteRef = useRef(null)

  useEffect(() => {
    let animId
    let currentP = 0
    let targetP = 0

    const onScroll = () => {
      if (!trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const totalScrollable = trackRef.current.offsetHeight - window.innerHeight
      if (totalScrollable <= 0) return
      const scrolled = -rect.top
      targetP = Math.min(1, Math.max(0, scrolled / totalScrollable))
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    onScroll()

    const render = () => {
      // Buttery smooth linear interpolation (lerp)
      currentP += (targetP - currentP) * 0.085

      const isMobile = window.innerWidth < 768
      const baseW = isMobile ? 78 : 50
      const baseH = isMobile ? 56 : 64

      // Gradual expansion from centered card to full viewport
      const width = baseW + currentP * (100 - baseW)
      const height = baseH + currentP * (100 - baseH)
      const radius = Math.max(0, 42 * (1 - currentP * 1.08))

      if (podRef.current) {
        podRef.current.style.width = `${width}vw`
        podRef.current.style.height = `${height}vh`
        podRef.current.style.borderRadius = `${radius}px`
      }

      // Text reveal smoothly as image approaches full size
      const textP = Math.max(0, Math.min(1, (currentP - 0.28) / 0.72))
      const textOpacity = Math.pow(textP, 1.3)
      const slide = (1 - textP) * 45

      if (leftRef.current) {
        leftRef.current.style.opacity = textOpacity.toFixed(3)
        leftRef.current.style.transform = `translateX(${-slide.toFixed(1)}px)`
      }
      if (rightRef.current) {
        rightRef.current.style.opacity = textOpacity.toFixed(3)
        rightRef.current.style.transform = `translateX(${slide.toFixed(1)}px)`
      }
      if (centerRef.current) {
        centerRef.current.style.opacity = textOpacity.toFixed(3)
        centerRef.current.style.transform = `translateY(${(slide * 0.55).toFixed(1)}px) scale(${(0.93 + textP * 0.07).toFixed(3)})`
      }
      if (vignetteRef.current) {
        vignetteRef.current.style.opacity = (0.08 + textOpacity * 0.32).toFixed(3)
      }

      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(animId)
    }
  }, [])

  return (
    <div className={`hero-page app-${theme}`}>
      {/* ── Scroll Track: 300vh for luxurious, gradual expansion ── */}
      <div ref={trackRef} className="hero-scroll-track">
        <div className="hero-sticky-stage">
          {/* Gradually Expanding Image Container */}
          <div ref={podRef} className="hero-image-pod">
            {/* Main Hero Photo */}
            <img
              src="/main-hero.jpg"
              alt="Vyapaar Hero Architecture"
              className="hero-image-img"
            />

            {/* Contrast Vignette Layer */}
            <div ref={vignetteRef} className="hero-image-vignette" />

            {/* Typography Overlay (Revealed on Scroll) */}
            <div className="hero-text-overlay">
              {/* LEFT: VYA */}
              <div ref={leftRef} className="hero-massive-word hero-massive-word--left">
                VYA
              </div>

              {/* CENTER: vyapaar + ledger engineered for nepal */}
              <div ref={centerRef} className="hero-center-script">
                <div className="hero-script-brand">vyapaar</div>
                <div className="hero-script-tagline">
                  <span>ledger</span>
                  <span>engineered for</span>
                  <span>nepal</span>
                </div>
              </div>

              {/* RIGHT: PAAR */}
              <div ref={rightRef} className="hero-massive-word hero-massive-word--right">
                PAAR
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
