export class RISChecker {
  constructor(notify = () => {}) {
    this.notify = notify;
  }

  check(imageUrl) {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const urls = [
      `https://yandex.com/images/search?url=${imageUrl}&rpt=imageview`,
      `http://www.tineye.com/search/?url=${imageUrl}`,
      `https://lens.google.com/uploadbyurl?url=${imageUrl}`,
      `https://www.google.com/searchbyimage?sbisrc=cr_1_5_2&image_url=${imageUrl}`,
      `https://www.bing.com/images/searchbyimage?cbir=ssbi&imgurl=${imageUrl}`,
    ];

    if (isSafari) {
      urls.forEach((url) => {
        setTimeout(() => window.open(url), 2000);
      });
      return;
    }

    const popUp = window.open(urls[1]);

    if (popUp == null || typeof popUp === 'undefined') {
      this.notify(
        'The other RIS sites were blocked by the browser. Please allow popups for this site.',
        'warning'
      );
      return;
    }

    popUp.focus();
    window.open(urls[0]);
    window.open(urls[2]);
    window.open(urls[3]);
    window.open(urls[4]);
  }
}
