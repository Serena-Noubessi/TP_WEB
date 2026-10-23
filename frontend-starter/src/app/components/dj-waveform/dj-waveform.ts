import { afterNextRender, Component, DestroyRef, ElementRef, inject, input, viewChild } from '@angular/core';
import { DeckEngine } from '../../shared/audio/deck-engine';

const ZOOM_SECONDS = 8;

/**
 * Formes d'onde d'une platine : vue zoomée défilante avec la grille des temps,
 * et vue d'ensemble du morceau sur laquelle un clic déplace la lecture.
 */
@Component({
  selector: 'app-dj-waveform',
  templateUrl: './dj-waveform.html',
  styleUrl: './dj-waveform.css',
})
export class DjWaveformComponent {
  readonly deck = input.required<DeckEngine>();
  readonly color = input('#007fff');
  readonly lowColor = input('#18324f');

  private readonly zoomCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('zoom');
  private readonly overviewCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('overview');
  private frame = 0;

  constructor() {
    afterNextRender(() => {
      const draw = () => {
        this.drawZoom();
        this.drawOverview();
        this.frame = requestAnimationFrame(draw);
      };
      this.frame = requestAnimationFrame(draw);
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));
  }

  seekFromOverview(event: MouseEvent): void {
    const deck = this.deck();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    deck.seek(((event.clientX - rect.left) / rect.width) * deck.duration());
  }

  private prepare(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext('2d');
    context?.clearRect(0, 0, width, height);
    return context;
  }

  private drawZoom(): void {
    const canvas = this.zoomCanvas().nativeElement;
    const context = this.prepare(canvas);
    if (!context) return;
    const { width, height } = canvas;
    const deck = this.deck();
    const waveform = deck.waveform();
    const position = deck.position;
    const start = position - ZOOM_SECONDS / 2;
    const middle = height / 2;
    const secondsPerPixel = ZOOM_SECONDS / width;

    const loop = deck.loop();
    if (loop) {
      context.fillStyle = 'rgb(255 214 10 / 18%)';
      context.fillRect((loop.start - start) / secondsPerPixel, 0, (loop.end - loop.start) / secondsPerPixel, height);
    }

    if (waveform) {
      const { peaks, lows, binsPerSecond } = waveform;
      context.fillStyle = this.color();
      context.globalAlpha = 0.55;
      for (let x = 0; x < width; x++) {
        const bin = Math.floor((start + x * secondsPerPixel) * binsPerSecond);
        if (bin < 0 || bin >= peaks.length) continue;
        const size = peaks[bin] * middle * 0.95;
        context.fillRect(x, middle - size, 1, size * 2);
      }
      context.fillStyle = this.lowColor();
      context.globalAlpha = 0.85;
      for (let x = 0; x < width; x++) {
        const bin = Math.floor((start + x * secondsPerPixel) * binsPerSecond);
        if (bin < 0 || bin >= lows.length) continue;
        const size = lows[bin] * middle * 0.95;
        context.fillRect(x, middle - size, 1, size * 2);
      }
      context.globalAlpha = 1;
    }

    const analysis = deck.analysis();
    const beat = deck.beatLength;
    if (analysis && beat) {
      const firstIndex = Math.ceil((start - analysis.firstBeat) / beat);
      for (let index = firstIndex; ; index++) {
        const time = analysis.firstBeat + index * beat;
        const x = (time - start) / secondsPerPixel;
        if (x > width) break;
        if (time < 0) continue;
        const isBar = index % 4 === 0;
        context.fillStyle = isBar ? 'rgb(24 50 79 / 45%)' : 'rgb(24 50 79 / 15%)';
        context.fillRect(Math.round(x), 0, isBar ? 2 : 1, isBar ? height : height * 0.18);
      }
    }

    context.fillStyle = '#ff9f1c';
    deck.hotCues().forEach((cue) => {
      if (cue === null) return;
      const x = (cue - start) / secondsPerPixel;
      if (x >= 0 && x <= width) context.fillRect(x - 1, 0, 3, height);
    });

    context.fillStyle = '#ff3b5c';
    context.fillRect(width / 2 - 1, 0, 2, height);
  }

  private drawOverview(): void {
    const canvas = this.overviewCanvas().nativeElement;
    const context = this.prepare(canvas);
    if (!context) return;
    const { width, height } = canvas;
    const deck = this.deck();
    const waveform = deck.waveform();
    const duration = deck.duration();
    if (!waveform || !duration) return;

    const { peaks } = waveform;
    const binsPerPixel = peaks.length / width;
    const played = (deck.position / duration) * width;
    for (let x = 0; x < width; x++) {
      const from = Math.floor(x * binsPerPixel);
      const to = Math.max(from + 1, Math.floor((x + 1) * binsPerPixel));
      let peak = 0;
      for (let bin = from; bin < to && bin < peaks.length; bin++) peak = Math.max(peak, peaks[bin]);
      const size = peak * height * 0.48;
      context.fillStyle = x < played ? '#b5cbe6' : this.color();
      context.fillRect(x, height / 2 - size, 1, size * 2);
    }
    context.fillStyle = '#18324f';
    context.fillRect(played - 1, 0, 2, height);
  }
}
