export const FEATURED_BACKGROUND_MODAL_MARKUP = String.raw`
      <div
        id="background-featured-modal"
        class="featured-wallpaper-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="background-featured-modal-title"
        aria-hidden="true"
        inert
      >
        <div class="featured-wallpaper-panel">
          <header class="featured-wallpaper-head">
            <div>
              <p class="featured-wallpaper-kicker">Featured Gallery</p>
              <h3 id="background-featured-modal-title">选择精选图库壁纸</h3>
            </div>
            <div class="featured-wallpaper-actions">
              <span id="background-featured-status" class="featured-wallpaper-status" role="status" aria-live="polite" hidden></span>
              <button id="background-featured-refresh" class="featured-wallpaper-action" type="button">
                刷新图库
              </button>
              <button id="background-featured-modal-close" class="featured-wallpaper-close" type="button" aria-label="关闭精选图库">
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="m6.5 6.5 11 11M17.5 6.5l-11 11"></path>
                </svg>
              </button>
            </div>
          </header>
          <div
            id="background-featured-modal-grid"
            class="featured-wallpaper-grid"
            aria-label="精选图库壁纸列表"
          ></div>
        </div>
      </div>
`
