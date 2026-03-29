export class RedditPoster {
  async postToReddit(imageUrl, roundTitle, subreddit = 'picturegame') {
    const response = await fetch('https://api.picturega.me/current');
    const data = await response.json();
    const nextRound = Number.parseInt(data.round.roundNumber, 10) + 1;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    const redditBase = isMobile ? 'http://old.reddit.com/r/' : 'http://www.reddit.com/r/';
    const redditUrl =
      `${redditBase}${subreddit}/submit?url=${imageUrl}&title=` +
      `[Round ${nextRound}] ${encodeURIComponent(roundTitle)}`;

    window.open(redditUrl);
  }
}
