// One inline element guarantees exclusive audio and retains Safari's gesture grant.
export class QuestPlayer {
  constructor(update) {
    this.update = update;
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.setAttribute('webkit-playsinline','');
    this.video.preload = 'none';
    this.positions = new Map();
    this.current = null;
    this.selected = null;
    this.revision = 0;
    this.video.addEventListener('loadedmetadata', () => {
      const position = this.positions.get(this.selected);
      if (position && position < this.video.duration) this.video.currentTime = position;
    });
    this.video.addEventListener('ended', () => {
      this.positions.delete(this.selected);
      if (this.current) this.update('ended');
    });
    this.video.addEventListener('error', () => { if (this.current) this.update('error'); });
  }
  prepare(teacher) {
    if (this.selected) return;
    this.setSource(teacher);
    // Call play on the start tap. Pausing immediately keeps the introduction at zero.
    this.video.play().catch(()=>{});
    this.video.pause();
  }
  setSource(teacher) {
    this.selected = teacher.id;
    this.video.src = teacher.video;
    this.video.load();
  }
  async play(teacher) {
    this.pause();
    this.current = teacher.id;
    const revision = this.revision;
    if (this.selected !== teacher.id || this.video.error) this.setSource(teacher);
    if (this.video.ended) this.video.currentTime = 0;
    try {
      await this.video.play();
      if (revision === this.revision) this.update('playing');
    } catch (error) {
      if (revision === this.revision) this.update(error.name === 'NotAllowedError' ? 'blocked' : 'error');
    }
  }
  pause() {
    ++this.revision;
    this.video.pause();
    if (this.selected && this.video.readyState >= 1 && !this.video.ended) this.positions.set(this.selected,this.video.currentTime);
    this.current = null;
  }
  reset() {
    this.pause();
    this.positions.clear();
    this.selected = null;
    this.video.removeAttribute('src');
    this.video.load();
  }
}
