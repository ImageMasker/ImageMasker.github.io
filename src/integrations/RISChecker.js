function withParams(base, params) {
  const url = new URL(base);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

/** Reverse image search pages for an image URL, with the URL safely encoded as a parameter. */
export function risUrls(imageUrl) {
  return [
    withParams('https://www.tineye.com/search/', { url: imageUrl }),
    withParams('https://yandex.com/images/search', { url: imageUrl, rpt: 'imageview' }),
    withParams('https://lens.google.com/uploadbyurl', { url: imageUrl }),
    withParams('https://www.google.com/searchbyimage', { sbisrc: 'cr_1_5_2', image_url: imageUrl }),
    withParams('https://www.bing.com/images/searchbyimage', { cbir: 'ssbi', imgurl: imageUrl }),
  ];
}

export class RISChecker {
  constructor(notify = () => {}) {
    this.notify = notify;
  }

  check(imageUrl) {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const urls = risUrls(imageUrl);

    if (isSafari) {
      urls.forEach((url) => {
        setTimeout(() => window.open(url), 2000);
      });
      return;
    }

    const popUp = window.open(urls[0]);

    if (popUp == null || typeof popUp === 'undefined') {
      this.notify('The other RIS sites were blocked by the browser. Please allow popups for this site.', 'warning');
      return;
    }

    popUp.focus();
    urls.slice(1).forEach((url) => window.open(url));
  }
}
