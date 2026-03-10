export default function SettingsPage() {
  return (
    <section className="settings-grid full-width">
      <article className="subtle-panel settings-card">
        <p className="section-kicker">Preferences</p>
        <h3>App experience</h3>
        <div className="settings-list">
          <div className="setting-row">
            <div>
              <strong>Smart budget alerts</strong>
              <p>Receive gentle nudges when spending pace starts drifting.</p>
            </div>
            <span className="toggle-pill active">On</span>
          </div>
          <div className="setting-row">
            <div>
              <strong>AI auto-categorization</strong>
              <p>Parse natural-language expenses into categories automatically.</p>
            </div>
            <span className="toggle-pill active">On</span>
          </div>
          <div className="setting-row">
            <div>
              <strong>Compact layout</strong>
              <p>Reduce card density for smaller screens and focused review sessions.</p>
            </div>
            <span className="toggle-pill">Off</span>
          </div>
        </div>
      </article>

      <article className="subtle-panel settings-card">
        <p className="section-kicker">Assistant controls</p>
        <h3>Chat panel behavior</h3>
        <div className="form-grid single-column">
          <label>
            <span>Default AI tone</span>
            <select defaultValue="Calm and concise">
              <option>Calm and concise</option>
              <option>Detailed coach</option>
              <option>Action-focused</option>
            </select>
          </label>
          <label>
            <span>Weekly summary cadence</span>
            <select defaultValue="Every Sunday evening">
              <option>Every Sunday evening</option>
              <option>Every Friday afternoon</option>
              <option>Only on request</option>
            </select>
          </label>
        </div>
      </article>
    </section>
  )
}
