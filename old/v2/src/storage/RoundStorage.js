export class RoundStorage {
  getRounds() {
    return JSON.parse(localStorage.getItem('rounds') || '[]');
  }

  addRound(imageUrl, title, answer) {
    const rounds = this.getRounds();
    rounds.push([imageUrl, title, answer]);
    localStorage.setItem('rounds', JSON.stringify(rounds));
    return rounds;
  }

  updateRound(index, title, answer) {
    const rounds = this.getRounds();

    if (!rounds[index]) {
      return rounds;
    }

    rounds[index][1] = title;
    rounds[index][2] = answer;
    localStorage.setItem('rounds', JSON.stringify(rounds));
    return rounds;
  }

  deleteRound(index) {
    const rounds = this.getRounds();
    const nextRounds = rounds.slice(0, index).concat(rounds.slice(index + 1));
    localStorage.setItem('rounds', JSON.stringify(nextRounds));
    return nextRounds;
  }

  getRound(index) {
    return this.getRounds()[index] ?? null;
  }

  getCount() {
    return this.getRounds().length;
  }
}
