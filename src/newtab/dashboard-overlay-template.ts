export const DASHBOARD_OVERLAY_MARKUP = String.raw`
      <section
        id="newtab-dashboard-overlay"
        class="newtab-dashboard-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="书签仪表盘"
        aria-hidden="true"
        data-dashboard-ready="false"
        data-dashboard-error="false"
        tabindex="-1"
        hidden
      >
        <div class="newtab-dashboard-surface">
          <div class="newtab-dashboard-loading" role="status" aria-label="正在打开书签仪表盘">
            <div class="newtab-dashboard-loading-card">
              <svg class="dot-matrix-loader dot-matrix-loader--spiral newtab-dashboard-loading-loader" viewBox="0 0 56 56" aria-hidden="true" focusable="false">
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d00" cx="6" cy="6" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d01" cx="17" cy="6" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d02" cx="28" cy="6" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d03" cx="39" cy="6" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d04" cx="50" cy="6" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d10" cx="6" cy="17" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d11" cx="17" cy="17" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d12" cx="28" cy="17" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d13" cx="39" cy="17" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d14" cx="50" cy="17" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d20" cx="6" cy="28" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d21" cx="17" cy="28" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d22" cx="28" cy="28" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d23" cx="39" cy="28" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d24" cx="50" cy="28" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d30" cx="6" cy="39" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d31" cx="17" cy="39" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d32" cx="28" cy="39" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d33" cx="39" cy="39" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d34" cx="50" cy="39" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d40" cx="6" cy="50" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d41" cx="17" cy="50" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d42" cx="28" cy="50" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d43" cx="39" cy="50" r="3.1"></circle>
                <circle class="dot-matrix-loader-lit dot-matrix-loader-d44" cx="50" cy="50" r="3.1"></circle>
              </svg>
            </div>
          </div>
          <div
            id="newtab-dashboard-fallback"
            class="newtab-dashboard-fallback"
            role="alert"
            aria-live="assertive"
            hidden
          >
            <div class="newtab-dashboard-fallback-card">
              <p class="newtab-dashboard-fallback-kicker">Dashboard</p>
              <h2>书签仪表盘暂时无法打开</h2>
              <p id="newtab-dashboard-fallback-copy">加载耗时过长。你可以返回新标签页，或重试打开仪表盘。</p>
              <div class="newtab-dashboard-fallback-actions">
                <button class="newtab-button secondary" type="button" data-dashboard-fallback-action="return">返回新标签页</button>
                <button class="newtab-button" type="button" data-dashboard-fallback-action="retry">重试</button>
              </div>
            </div>
          </div>
          <iframe
            id="newtab-dashboard-frame"
            class="newtab-dashboard-frame"
            title="书签仪表盘"
            loading="lazy"
            tabindex="0"
          ></iframe>
        </div>
      </section>
`
