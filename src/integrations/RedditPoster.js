export class RedditPoster {
  async nextRoundNumber() {
    const response = await fetch('https://api.picturega.me/current');
    const data = await response.json();
    const next = Number.parseInt(data.round.roundNumber, 10) + 1;

    if (!Number.isFinite(next)) {
      throw new Error('Could not read the current round number.');
    }

    return next;
  }

  roundTitle(roundNumber, roundTitle) {
    return `[Round ${roundNumber}] ${roundTitle}`;
  }

  /** Link post: Reddit's submit page with the image URL and title filled in. */
  async postToReddit(imageUrl, roundTitle, subreddit = 'picturegame') {
    const nextRound = await this.nextRoundNumber();
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const redditBase = isMobile ? 'https://old.reddit.com/r/' : 'https://www.reddit.com/r/';

    const url = new URL(`${redditBase}${encodeURIComponent(subreddit)}/submit`);

    url.searchParams.set('url', imageUrl);
    url.searchParams.set('title', this.roundTitle(nextRound, roundTitle));
    return window.open(url.toString());
  }

  /** Image post: opens the image composer with the title filled in; the picture is pasted in. */
  imagePostUrl(roundNumber, roundTitle, subreddit = 'picturegame') {
    const url = new URL(`https://www.reddit.com/r/${encodeURIComponent(subreddit)}/submit/`);

    url.searchParams.set('type', 'IMAGE');
    url.searchParams.set('title', this.roundTitle(roundNumber, roundTitle));
    return url.toString();
  }
}
