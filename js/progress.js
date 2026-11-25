export class Progress {
  constructor(config, demo) {
    this.config = config;
    this.key = 'ar-quest:' + (demo ? 'demo:' : '') + config.questId;
    this.ids = new Set();
    this.available = true;
    try {
      const saved = JSON.parse(localStorage.getItem(this.key));
      if (saved?.questId === config.questId && saved.configVersion === config.configVersion && Array.isArray(saved.found)) {
        const allowed = new Set(config.teachers.map(t => t.id));
        this.ids = new Set(saved.found.filter(id => allowed.has(id)));
      }
    } catch (error) { if (!(error instanceof SyntaxError)) this.available = false; }
  }
  add(id) {
    if (!this.config.teachers.some(t => t.id === id) || this.ids.has(id)) return;
    this.ids.add(id);
    try {
      localStorage.setItem(this.key, JSON.stringify({questId:this.config.questId, configVersion:this.config.configVersion, found:[...this.ids]}));
    } catch { this.available = false; }
  }
  reset() {
    this.ids.clear();
    try {localStorage.removeItem(this.key);} catch {this.available = false;}
  }
}
