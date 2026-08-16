'use client'

import Image from 'next/image'
import { useEffect } from 'react'

export default function DashboardPage() {
  useEffect(() => {
    if (document.querySelector('script[data-argos-ui]')) return

    const script = document.createElement('script')
    // Keep the UI runtime cacheable while ensuring remote tablets do not reuse
    // the pre-hydration build that rendered only the persistent navigation.
    script.src = '/argos-ui/app.js?v=20260817-modal-scroll-lock-1'
    script.dataset.argosUi = 'true'
    document.body.appendChild(script)
  }, [])

  return (
    <>
      <div className="app-frame">
        <header className="topbar">
          <button className="brand" type="button" data-route="home" aria-label="Go to home">
            <span className="brand-logo" aria-hidden="true">
              <Image src="/argos-ui/assets/brand/argos-one-logo-yellow.svg" alt="" width={212} height={47} priority />
            </span>
          </button>
          <button
            className="workshop-clock"
            type="button"
            data-action="open-calendar"
            aria-label="Open workshop calendar"
          >
            <span id="workshop-time">16:45</span>
            <span className="clock-divider" aria-hidden="true" />
            <span id="workshop-date">Wed 12 Aug</span>
          </button>
          <button
            id="theme-toggle"
            className="icon-button theme-shortcut"
            type="button"
            data-action="theme-toggle"
            aria-label="Switch theme"
          >
            <span data-theme-icon aria-hidden="true" />
          </button>
          <button
            className="icon-button profile-button"
            type="button"
            data-action="open-profile"
            aria-label="Open technician profile"
            aria-haspopup="dialog"
          >
            <span>DM</span>
          </button>
        </header>

        <main id="app" tabIndex={-1} />

        <nav className="bottom-nav" aria-label="Primary navigation">
          <button type="button" data-route="home" className="nav-item is-active">
            <span className="nav-icon" data-icon="home" />
            <span>Home</span>
          </button>
          <button type="button" data-route="jobs" className="nav-item">
            <span className="nav-icon" data-icon="clipboard" />
            <span>Jobs</span>
          </button>
          <button type="button" data-route="new" className="nav-new">
            <span className="nav-plus" data-icon="plus" />
            <span>New</span>
          </button>
          <button type="button" data-route="knowledge" className="nav-item">
            <span className="nav-icon" data-icon="database" />
            <span>Library</span>
          </button>
          <button type="button" data-route="settings" className="nav-item">
            <span className="nav-icon" data-icon="settings" />
            <span>Settings</span>
          </button>
        </nav>

        <button
          id="scroll-cue"
          className="scroll-cue"
          type="button"
          data-action="scroll-next"
          aria-label="Scroll down for more content"
          aria-hidden="true"
          tabIndex={-1}
        >
          <span data-icon="down" />
        </button>
      </div>

      <div id="sheet-layer" className="sheet-layer" hidden />
      <div id="toast" className="toast" role="status" aria-live="polite" />
      <div id="dictation-dock" className="dictation-dock" role="group" aria-label="Active voice recording" hidden>
        <button className="dictation-cancel" type="button" data-action="cancel-dictation" aria-label="Cancel dictation">
          <span data-icon="close" />
        </button>
        <span className="dictation-mark" data-icon="mic" aria-hidden="true" />
        <span className="soundwave" aria-hidden="true">
          <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
        </span>
        <button className="dictation-send" type="button" data-action="send-dictation" aria-label="Transcribe and add recording">
          <span data-icon="send" />
        </button>
      </div>

      <input id="photo-input" className="visually-hidden" type="file" accept="image/*" capture="environment" multiple />
      <input id="vin-camera-input" className="visually-hidden" type="file" accept="image/*" capture="environment" />

    </>
  )
}
