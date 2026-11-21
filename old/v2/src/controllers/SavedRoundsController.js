export class SavedRoundsController {
  constructor(app) {
    this.app = app;
  }

  bindEvents() {
    const refs = this.app.savedRoundsPanel.refs;

    refs.savedRoundsButton.addEventListener('click', () => {
      this.toggleSavedRounds();
    });

    refs.saveFromUrlButton.addEventListener('click', () => {
      this.toggleSaveFromUrl();
    });

    refs.saveExternal.addEventListener('click', () => {
      this.saveRoundFromUrl();
    });

    refs.left.addEventListener('click', () => {
      this.displaySavedRounds(1);
    });

    refs.right.addEventListener('click', () => {
      this.displaySavedRounds(2);
    });

    refs.UpdateInfo.addEventListener('click', () => {
      this.app.roundStorage.updateRound(
        this.app.savedRoundIndex,
        refs.displayedTitle.value,
        refs.displayedAnswer.value
      );
      this.app.flashButtonSuccess(refs.UpdateInfo, 'Updated!');
      this.app.notify('Saved round info updated.', 'success');
    });

    refs.delete.addEventListener('click', () => {
      refs.confirmDelete.classList.remove('hidden');
      refs.confirmDeleteButton.focus();
    });

    refs.confirmDeleteButton.addEventListener('click', () => {
      this.deleteSavedRound();
    });

    refs.cancelDeleteButton.addEventListener('click', () => {
      refs.confirmDelete.classList.add('hidden');
    });

    refs.export.addEventListener('click', async () => {
      await this.app.copyYml({
        roundTitle: refs.displayedTitle.value,
        roundAnswer: refs.displayedAnswer.value,
        imageUrl: refs.displayedImagelink.href,
      });
    });

    refs.PostReddit2.addEventListener('click', async () => {
      try {
        await this.app.redditPoster.postToReddit(
          refs.displayedImage.src,
          refs.displayedTitle.value,
          'picturegame'
        );
        this.app.notify('Opened Reddit submission page.', 'success');
      } catch {
        this.app.notify('Could not open Reddit submission flow.', 'error');
      }
    });

    refs.saveFromURLURL.addEventListener('input', () => {
      this.app.savedRoundsPanel.setMessage('');
    });

    refs.saveFromURLTitle.addEventListener('input', () => {
      this.app.savedRoundsPanel.setMessage('');
    });

    refs.saveFromURLAnswer.addEventListener('input', () => {
      this.app.savedRoundsPanel.setMessage('');
    });
  }

  saveRoundFromEditor() {
    const refs = this.app.canvasArea.refs;

    this.app.roundStorage.addRound(
      refs.uploadedUrl.value,
      refs.roundTitle.value,
      refs.roundAnswer.value
    );
    this.app.flashButtonSuccess(refs.saveButton);
    this.app.notify('Round saved.', 'success');
  }

  saveRoundFromUrl() {
    const refs = this.app.savedRoundsPanel.refs;
    const imageUrl = refs.saveFromURLURL.value.trim();

    if (!imageUrl) {
      this.app.savedRoundsPanel.setMessage('Enter an image URL before saving the round.', 'warning');
      refs.saveFromURLURL.focus();
      return;
    }

    this.app.roundStorage.addRound(
      imageUrl,
      refs.saveFromURLTitle.value,
      refs.saveFromURLAnswer.value
    );
    this.app.flashButtonSuccess(refs.saveExternal);
    this.app.savedRoundsPanel.setMessage('Round saved from URL.', 'success');
    this.app.notify('Round saved from URL.', 'success');
  }

  toggleSavedRounds() {
    const refs = this.app.savedRoundsPanel.refs;

    if (this.app.roundStorage.getCount() === 0) {
      refs.emptyState.classList.remove('hidden');
      refs.savedRounds.classList.add('hidden');
      refs.saveExternalUrl.classList.add('hidden');
      refs.confirmDelete.classList.add('hidden');
      refs.saveFromUrlButton.classList.remove('hidden');
      this.app.savedRoundsPanel.setSavedRoundsExpanded(false);
      this.app.savedRoundsPanel.setSaveFromUrlExpanded(false);
      return;
    }

    if (!refs.savedRounds.classList.contains('hidden')) {
      refs.savedRounds.classList.add('hidden');
      refs.saveFromUrlButton.classList.remove('hidden');
      refs.confirmDelete.classList.add('hidden');
      refs.emptyState.classList.add('hidden');
      this.app.savedRoundsPanel.setSavedRoundsExpanded(false);
      return;
    }

    this.app.savedRoundIndex = 0;
    refs.emptyState.classList.add('hidden');
    refs.saveFromUrlButton.classList.add('hidden');
    refs.savedRounds.classList.remove('hidden');
    refs.confirmDelete.classList.add('hidden');
    this.app.savedRoundsPanel.setSavedRoundsExpanded(true);
    this.app.savedRoundsPanel.setSaveFromUrlExpanded(false);
    this.renderSavedRound();
    setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 100);
  }

  toggleSaveFromUrl() {
    const refs = this.app.savedRoundsPanel.refs;
    const shouldShow = refs.saveExternalUrl.classList.contains('hidden');

    refs.saveExternalUrl.classList.toggle('hidden', !shouldShow);
    refs.savedRoundsButton.classList.toggle('hidden', shouldShow);
    this.app.savedRoundsPanel.setMessage('');
    refs.emptyState.classList.add('hidden');
    refs.confirmDelete.classList.add('hidden');
    this.app.savedRoundsPanel.setSaveFromUrlExpanded(shouldShow);
  }

  displaySavedRounds(direction) {
    if (direction === 1) {
      this.app.savedRoundIndex -= 1;
    } else if (direction === 2) {
      this.app.savedRoundIndex += 1;
    }

    this.renderSavedRound();
  }

  renderSavedRound() {
    const refs = this.app.savedRoundsPanel.refs;
    const rounds = this.app.roundStorage.getRounds();
    refs.confirmDelete.classList.add('hidden');

    if (rounds.length === 0) {
      refs.savedRounds.classList.add('hidden');
      refs.saveFromUrlButton.classList.remove('hidden');
      refs.emptyState.classList.remove('hidden');
      refs.confirmDelete.classList.add('hidden');
      this.app.savedRoundsPanel.setSavedRoundsExpanded(false);
      return;
    }

    this.app.savedRoundIndex = Math.max(0, Math.min(this.app.savedRoundIndex, rounds.length - 1));
    const [url, title, answer] = rounds[this.app.savedRoundIndex];

    refs.emptyState.classList.add('hidden');
    refs.savedRounds.classList.remove('hidden');
    refs.displayedImagelink.href = url;
    refs.displayedImage.src = url;
    refs.displayedTitle.value = title;
    refs.displayedAnswer.value = answer;

    refs.left.style.visibility = this.app.savedRoundIndex <= 0 ? 'hidden' : 'visible';
    refs.right.style.visibility = this.app.savedRoundIndex >= rounds.length - 1 ? 'hidden' : 'visible';

    if (rounds.length === 1) {
      refs.left.style.visibility = 'hidden';
      refs.right.style.visibility = 'hidden';
    }
  }

  deleteSavedRound() {
    const refs = this.app.savedRoundsPanel.refs;
    const nextRounds = this.app.roundStorage.deleteRound(this.app.savedRoundIndex);
    refs.confirmDelete.classList.add('hidden');

    if (nextRounds.length === 0) {
      refs.savedRounds.classList.add('hidden');
      refs.saveFromUrlButton.classList.remove('hidden');
      refs.emptyState.classList.remove('hidden');
      this.app.savedRoundsPanel.setSavedRoundsExpanded(false);
      return;
    }

    this.app.savedRoundIndex = 0;
    this.renderSavedRound();
  }
}
