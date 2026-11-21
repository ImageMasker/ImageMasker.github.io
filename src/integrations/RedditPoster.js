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
    const redditBase = isMobile ? 'http://old.reddit.com/r/' : 'http://www.reddit.com/r/';

    return window.open(
      `${redditBase}${subreddit}/submit?url=${imageUrl}&title=${encodeURIComponent(this.roundTitle(nextRound, roundTitle))}`
    );
  }

  /** Image post: opens the image composer with the title filled in; the picture is pasted in. */
  imagePostUrl(roundNumber, roundTitle, subreddit = 'picturegame') {
    return `https://www.reddit.com/r/${subreddit}/submit/?type=IMAGE&title=${encodeURIComponent(this.roundTitle(roundNumber, roundTitle))}`;
  }
}
