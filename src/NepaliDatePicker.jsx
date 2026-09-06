import { useState, useMemo, useEffect, useRef } from 'react'
import nepaliDatePkg from 'nepali-date-converter'
import './NepaliDatePicker.css'

const NepaliDate = nepaliDatePkg.default || nepaliDatePkg

export const BS_MONTHS = [
  { en: 'Baisakh', np: 'बैशाख', num: '01' },
  { en: 'Jestha',  np: 'जेठ',   num: '02' },
  { en: 'Ashadh',  np: 'असार',  num: '03' },
  { en: 'Shrawan', np: 'साउन',  num: '04' },
  { en: 'Bhadra',  np: 'भदौ',   num: '05' },
  { en: 'Ashwin',  np: 'असोज',  num: '06' },
  { en: 'Kartik',  np: 'कात्तिक', num: '07' },
  { en: 'Mangsir', np: 'मंसिर', num: '08' },
  { en: 'Poush',   np: 'पुस',   num: '09' },
  { en: 'Magh',    np: 'माघ',   num: '10' },
  { en: 'Falgun',  np: 'फागुन', num: '11' },
  { en: 'Chaitra', np: 'चैत',   num: '12' },
]

const DAYS_HEADER = [
  { en: 'Su', np: 'आइत' },
  { en: 'Mo', np: 'सोम' },
  { en: 'Tu', np: 'मंग' },
  { en: 'We', np: 'बुध' },
  { en: 'Th', np: 'बिही' },
  { en: 'Fr', np: 'शुक्र' },
  { en: 'Sa', np: 'शनि' },
]

function getDaysInMonth(year, month) {
  for (let day = 29; day <= 32; day++) {
    try {
      const testDate = new NepaliDate(year, month, day)
      if (testDate.getMonth() !== month) return day - 1
    } catch {
      return day - 1
    }
  }
  return 32
}

export default function NepaliDatePicker({ value, onChange, onClose, theme = 'dark' }) {
  const popoverRef = useRef(null)

  // Parse initial date or default to today's BS date
  const initial = useMemo(() => {
    const today = new NepaliDate()
    if (!value || typeof value !== 'string') {
      return { y: today.getYear(), m: today.getMonth(), d: today.getDate() }
    }
    const parts = value.split('-').map(Number)
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return { y: parts[0], m: parts[1] - 1, d: parts[2] }
    }
    return { y: today.getYear(), m: today.getMonth(), d: today.getDate() }
  }, [value])

  const [viewYear, setViewYear]   = useState(initial.y)
  const [viewMonth, setViewMonth] = useState(initial.m)

  // Close on outside click / tap
  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose?.()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [onClose])

  // Calendar matrix calculation
  const { totalDays, startDayOfWeek } = useMemo(() => {
    const days = getDaysInMonth(viewYear, viewMonth)
    let startDay = 0
    try {
      const firstDay = new NepaliDate(viewYear, viewMonth, 1)
      startDay = firstDay.getDay()
    } catch {
      startDay = 0
    }
    return { totalDays: days, startDayOfWeek: startDay }
  }, [viewYear, viewMonth])

  // Selected date matching
  const isSelected = (day) => {
    return initial.y === viewYear && initial.m === viewMonth && initial.d === day
  }

  // Today check
  const today = useMemo(() => {
    const nd = new NepaliDate()
    return { y: nd.getYear(), m: nd.getMonth(), d: nd.getDate() }
  }, [])

  const isToday = (day) => {
    return today.y === viewYear && today.m === viewMonth && today.d === day
  }

  function handleSelectDay(day) {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    onChange(`${viewYear}-${mm}-${dd}`)
    onClose?.()
  }

  function handleSetToday() {
    setViewYear(today.y)
    setViewMonth(today.m)
    const mm = String(today.m + 1).padStart(2, '0')
    const dd = String(today.d).padStart(2, '0')
    onChange(`${today.y}-${mm}-${dd}`)
    onClose?.()
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear(y => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth(m => m - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear(y => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth(m => m + 1)
    }
  }

  // Year options list (2070 BS to 2085 BS)
  const years = useMemo(() => {
    const list = []
    for (let y = 2070; y <= 2085; y++) list.push(y)
    return list
  }, [])

  return (
    <div className={`nepali-calendar-overlay ${theme === 'light' ? 'cal-light' : 'cal-dark'}`}>
      <div className="nepali-calendar-popover" ref={popoverRef} role="dialog" aria-label="Nepali Calendar">
        
        {/* Calendar Header Controls */}
        <div className="nepali-cal-nav">
          <button type="button" className="nepali-cal-btn-icon" onClick={prevMonth} aria-label="Previous Month">
            ‹
          </button>
          
          <div className="nepali-cal-selectors">
            <select
              className="nepali-cal-select"
              value={viewMonth}
              onChange={e => setViewMonth(parseInt(e.target.value, 10))}
            >
              {BS_MONTHS.map((m, idx) => (
                <option key={idx} value={idx}>
                  {m.np} ({m.en})
                </option>
              ))}
            </select>

            <select
              className="nepali-cal-select nepali-cal-select-year"
              value={viewYear}
              onChange={e => setViewYear(parseInt(e.target.value, 10))}
            >
              {years.map(y => (
                <option key={y} value={y}>{y} वि.सं.</option>
              ))}
            </select>
          </div>

          <button type="button" className="nepali-cal-btn-icon" onClick={nextMonth} aria-label="Next Month">
            ›
          </button>
        </div>

        {/* Days of Week Row */}
        <div className="nepali-cal-weekdays">
          {DAYS_HEADER.map((d, i) => (
            <div key={i} className={`nepali-cal-weekday${i === 6 ? ' saturday' : ''}`}>
              <span>{d.np}</span>
            </div>
          ))}
        </div>

        {/* Month Days Grid */}
        <div className="nepali-cal-grid">
          {/* Empty spacer slots for offset */}
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="nepali-cal-day empty" />
          ))}

          {/* Actual days */}
          {Array.from({ length: totalDays }).map((_, i) => {
            const day = i + 1
            const dayOfWeek = (startDayOfWeek + i) % 7
            const isSat = dayOfWeek === 6
            const selected = isSelected(day)
            const currentToday = isToday(day)

            return (
              <button
                key={day}
                type="button"
                className={`nepali-cal-day${selected ? ' selected' : ''}${currentToday ? ' today' : ''}${isSat ? ' saturday' : ''}`}
                onClick={() => handleSelectDay(day)}
              >
                {day}
              </button>
            )
          })}
        </div>

        {/* Footer shortcuts */}
        <div className="nepali-cal-footer">
          <button type="button" className="nepali-cal-today-btn" onClick={handleSetToday}>
            आज ({today.y}-{String(today.m + 1).padStart(2, '0')}-{String(today.d).padStart(2, '0')})
          </button>
          <button type="button" className="nepali-cal-close-btn" onClick={onClose}>
            बन्द
          </button>
        </div>

      </div>
    </div>
  )
}
