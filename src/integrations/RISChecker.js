const ENGINES_KEY = 'imagemasker.risEngines';

function withParams(base, params) {
  const url = new URL(base);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

/** Reverse image search sites, each building its search page for an image URL. */
export const RIS_ENGINES = [
  { id: 'tineye', label: 'TinEye', build: (url) => withParams('https://www.tineye.com/search/', { url }) },
  { id: 'yandex', label: 'Yandex', build: (url) => withParams('https://yandex.com/images/search', { url, rpt: 'imageview' }) },
  { id: 'lens', label: 'Google Lens', build: (url) => withParams('https://lens.google.com/uploadbyurl', { url }) },
  { id: 'bing', label: 'Bing', build: (url) => withParams('https://www.bing.com/images/searchbyimage', { cbir: 'ssbi', imgurl: url }) },
];

/** Reverse image search pages for an image URL, with the URL safely encoded as a parameter. */
export function risUrls(imageUrl, engineIds = RIS_ENGINES.map((engine) => engine.id)) {
  return RIS_ENGINES.filter((engine) => engineIds.includes(engine.id)).map((engine) => engine.build(imageUrl));
}

export class RISChecker {
  constructor(notify = () => {}) {
    this.notify = notify;
  }

  /** The sites ticked in the header's RIS menu (all of them by default). */
  getEngineIds() {
    try {
      const stored = JSON.parse(localStorage.getItem(ENGINES_KEY) ?? 'null');

      if (Array.isArray(stored)) {
        const known = stored.filter((id) => RIS_ENGINES.some((engine) => engine.id === id));

        if (known.length) {
          return known;
        }
      }
    } catch {
      // Fall back to every site.
    }

    return RIS_ENGINES.map((engine) => engine.id);
  }

  setEngineIds(ids) {
    localStorage.setItem(ENGINES_KEY, JSON.stringify(ids));
  }

  check(imageUrl, engineIds = this.getEngineIds()) {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const urls = risUrls(imageUrl, engineIds);

    if (!urls.length) {
      return;
    }

    if (isSafari) {
      urls.forEach((url) => {
        setTimeout(() => window.open(url), 2000);
      });
      return;
    }

    const popUp = window.open(urls[0]);

    if (popUp == null || typeof popUp === 'undefined') {
      this.notify('The RIS sites were blocked by the browser. Please allow popups for this site.', 'warning');
      return;
    }

    popUp.focus();
    urls.slice(1).forEach((url) => window.open(url));
  }

  /**
   * Opens a waiting tab straight away (still inside the click, so popup blockers allow it), then
   * points it at the first RIS site once `getUrl` resolves and opens the rest. Resolves to the URL.
   */
  async checkPending(getUrl, engineIds = this.getEngineIds()) {
    const placeholder = window.open('', '_blank');

    if (placeholder) {
      try {
        placeholder.document.title = 'Uploading…';
        placeholder.document.body.style.cssText = 'font: 16px system-ui, sans-serif; padding: 2rem; color: #555';
        placeholder.document.body.textContent = 'Uploading the picture for a reverse image search…';
      } catch {
        // Some browsers do not let the opener write into the new tab; it just stays blank.
      }
    }

    let imageUrl;

    try {
      imageUrl = await getUrl();
    } catch (error) {
      placeholder?.close();
      throw error;
    }

    const urls = risUrls(imageUrl, engineIds);
    let blocked = 0;

    urls.forEach((url, index) => {
      if (index === 0 && placeholder && !placeholder.closed) {
        placeholder.opener = null;
        placeholder.location.href = url;
        return;
      }

      if (!window.open(url)) {
        blocked += 1;
      }
    });

    if (blocked) {
      this.notify(
        `${blocked} RIS ${blocked === 1 ? 'site was' : 'sites were'} blocked by the browser. Allow popups for this site to open them all at once.`,
        'warning',
        5200
      );
    }

    return imageUrl;
  }
}
