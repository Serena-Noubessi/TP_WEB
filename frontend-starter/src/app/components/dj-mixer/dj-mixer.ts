import { afterNextRender, Component, DestroyRef, ElementRef, inject, viewChildren } from '@angular/core';
import { DeckId, EqBand } from '../../shared/models/dj.model';
import { DjEngineService } from '../../shared/services/dj-engine.service';
import { DjKnobComponent } from '../dj-knob/dj-knob';

/** Mixeur central : égaliseurs, filtres, volumes, vumètres, crossfader, master et enregistrement. */
@Component({
  selector: 'app-dj-mixer',
  imports: [DjKnobComponent],
  templateUrl: './dj-mixer.html',
  styleUrl: './dj-mixer.css',
})
export class DjMixerComponent {
  readonly engine = inject(DjEngineService);
  readonly channels: { id: DeckId; color: string }[] = [
    { id: 'A', color: '#007fff' },
    { id: 'B', color: '#a99bef' },
  ];
  readonly bands: { band: EqBand; label: string }[] = [
    { band: 'high', label: 'Aigus' },
    { band: 'mid', label: 'Médiums' },
    { band: 'low', label: 'Basses' },
  ];

  private readonly meters = viewChildren<ElementRef<HTMLElement>>('meter');
  private frame = 0;
  private readonly held: Record<string, number> = {};

  constructor() {
    afterNextRender(() => {
      const update = () => {
        for (const meter of this.meters()) {
          const element = meter.nativeElement;
          const source = element.dataset['source'] ?? '';
          const level =
            source === 'master' ? this.engine.masterLevel() : this.engine.deck(source as DeckId).level();
          // Retombée progressive du vumètre, comme une aiguille.
          const shown = Math.max(level, (this.held[source] ?? 0) * 0.92);
          this.held[source] = shown;
          element.style.setProperty('--level', `${Math.round(shown * 100)}%`);
        }
        this.frame = requestAnimationFrame(update);
      };
      this.frame = requestAnimationFrame(update);
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));
  }

  changeVolume(id: DeckId, event: Event): void {
    this.engine.deck(id).setVolume(Number((event.target as HTMLInputElement).value));
  }

  changeCrossfader(event: Event): void {
    this.engine.setCrossfader(Number((event.target as HTMLInputElement).value));
  }

  eqText(value: number): string {
    const decibels = value < 0 ? value * 26 : value * 6;
    return `${decibels > 0 ? '+' : ''}${decibels.toFixed(1)} dB`;
  }

  filterText(value: number): string {
    if (value === 0) return 'Neutre';
    return `${value < 0 ? 'Passe-bas' : 'Passe-haut'} ${Math.round(Math.abs(value) * 100)} %`;
  }
}
