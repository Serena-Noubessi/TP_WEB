/**
 * Code de l'AudioWorklet qui lit le morceau d'une platine.
 *
 * Un AudioBufferSourceNode ne sait pas lire à l'envers ni changer de vitesse
 * de façon continue : il est donc impossible de scratcher avec. Ce processeur
 * lit lui-même les échantillons à une vitesse variable (positive ou négative)
 * et suit une position cible pendant le scratch, comme un vinyle sous la main.
 *
 * Le code est chargé depuis une URL Blob pour éviter un fichier JavaScript
 * séparé dans la configuration de build Angular.
 */
export const DECK_PROCESSOR_NAME = 'dj-deck-processor';

export const DECK_PROCESSOR_SOURCE = `
class DjDeckProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.left = null;
    this.right = null;
    this.length = 0;
    this.pos = 0;
    this.rate = 0;
    this.speed = 1;
    this.playing = false;
    this.scratching = false;
    this.scratchTarget = 0;
    this.loopStart = -1;
    this.loopEnd = -1;
    this.blocks = 0;
    this.port.onmessage = (event) => this.handle(event.data);
  }

  handle(message) {
    switch (message.type) {
      case 'load':
        this.left = message.channels[0];
        this.right = message.channels[1] || message.channels[0];
        this.length = this.left.length;
        this.pos = 0;
        this.rate = 0;
        this.playing = false;
        this.loopStart = -1;
        this.loopEnd = -1;
        break;
      case 'unload':
        this.left = null;
        this.right = null;
        this.length = 0;
        this.pos = 0;
        this.rate = 0;
        this.playing = false;
        break;
      case 'play':
        this.playing = true;
        break;
      case 'pause':
        this.playing = false;
        break;
      case 'seek':
        this.pos = Math.min(Math.max(0, message.frame), Math.max(0, this.length - 1));
        this.scratchTarget = this.pos;
        break;
      case 'speed':
        this.speed = message.value;
        break;
      case 'scratch-start':
        this.scratching = true;
        this.scratchTarget = this.pos;
        break;
      case 'scratch':
        this.scratchTarget = message.frame;
        break;
      case 'scratch-end':
        this.scratching = false;
        break;
      case 'loop':
        this.loopStart = message.start;
        this.loopEnd = message.end;
        break;
    }
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const outLeft = out[0];
    const outRight = out[1] || out[0];
    const frames = outLeft.length;

    if (!this.left) {
      outLeft.fill(0);
      outRight.fill(0);
      return true;
    }

    const left = this.left;
    const right = this.right;
    const last = this.length - 1;
    const follow = sampleRate * 0.012;
    let ended = false;

    for (let i = 0; i < frames; i++) {
      if (this.scratching) {
        let wanted = (this.scratchTarget - this.pos) / follow;
        if (wanted > 4) wanted = 4;
        else if (wanted < -4) wanted = -4;
        this.rate += (wanted - this.rate) * 0.02;
      } else {
        const wanted = this.playing ? this.speed : 0;
        this.rate += (wanted - this.rate) * 0.0025;
      }

      let sampleLeft = 0;
      let sampleRight = 0;
      const position = this.pos;
      if (position >= 0 && position < last) {
        const index = position | 0;
        const fraction = position - index;
        sampleLeft = left[index] + (left[index + 1] - left[index]) * fraction;
        sampleRight = right[index] + (right[index + 1] - right[index]) * fraction;
      }

      // Un vinyle à l'arrêt ne produit aucun son : le volume suit la vitesse.
      const speedAbs = this.rate < 0 ? -this.rate : this.rate;
      const amplitude = speedAbs >= 0.125 ? 1 : speedAbs * 8;
      outLeft[i] = sampleLeft * amplitude;
      outRight[i] = sampleRight * amplitude;

      const previous = this.pos;
      this.pos += this.rate;

      if (this.loopEnd > 0 && !this.scratching && previous < this.loopEnd && this.pos >= this.loopEnd) {
        this.pos -= this.loopEnd - this.loopStart;
      }
      if (this.pos < 0) {
        this.pos = 0;
        if (!this.scratching) this.rate = 0;
      }
      if (this.pos >= last) {
        this.pos = last;
        if (!this.scratching && this.playing) {
          this.playing = false;
          this.rate = 0;
          ended = true;
        }
      }
    }

    this.blocks++;
    if (this.blocks >= 4 || ended) {
      this.blocks = 0;
      this.port.postMessage({ type: 'position', frame: this.pos, rate: this.rate, ended });
    }
    return true;
  }
}

registerProcessor('dj-deck-processor', DjDeckProcessor);
`;
