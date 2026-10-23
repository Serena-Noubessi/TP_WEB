import { Component, computed, inject, input } from '@angular/core';
import { DeckId, FxType } from '../../shared/models/dj.model';
import { DjEngineService } from '../../shared/services/dj-engine.service';
import { categoryOf, displayTitle } from '../../shared/models/category.model';
import { DjJogWheelComponent } from '../dj-jog-wheel/dj-jog-wheel';
import { DjKnobComponent } from '../dj-knob/dj-knob';
import { DjWaveformComponent } from '../dj-waveform/dj-waveform';
import { IconComponent } from '../icon/icon';

/** Une platine : forme d'onde, vinyle, transport, pitch, repères, boucles et effets. */
@Component({
  selector: 'app-dj-deck',
  imports: [DjJogWheelComponent, DjKnobComponent, DjWaveformComponent, IconComponent],
  templateUrl: './dj-deck.html',
  styleUrl: './dj-deck.css',
})
export class DjDeckComponent {
  readonly engine = inject(DjEngineService);
  readonly deckId = input.required<DeckId>();
  readonly color = input('#007fff');

  readonly deck = computed(() => this.engine.deck(this.deckId()));
  readonly displayTitle = displayTitle;
  readonly categoryOf = categoryOf;
  readonly remaining = computed(() => Math.max(0, this.deck().duration() - this.deck().time()));
  readonly pitchRanges = [8, 16, 50];
  readonly loopSizes = [1, 2, 4, 8, 16];
  readonly hotCueIndexes = [0, 1, 2, 3];
  readonly effects: { type: FxType; label: string }[] = [
    { type: 'echo', label: 'Écho' },
    { type: 'reverb', label: 'Réverb' },
    { type: 'flanger', label: 'Flanger' },
  ];

  togglePlay(): void {
    this.engine.togglePlay(this.deckId());
  }

  toggleSync(): void {
    this.engine.toggleSync(this.deckId());
  }

  changePitch(event: Event): void {
    this.engine.setPitch(this.deckId(), Number((event.target as HTMLInputElement).value));
  }

  resetPitch(): void {
    this.engine.setPitch(this.deckId(), 0);
  }

  changePitchRange(event: Event): void {
    this.deck().setPitchRange(Number((event.target as HTMLSelectElement).value));
  }

  scaleBpm(factor: 0.5 | 2): void {
    this.engine.scaleBpm(this.deckId(), factor);
  }

  /** Clic : pose ou rappelle le repère ; Maj + clic ou clic droit : l'efface. */
  hotCue(index: number, event: MouseEvent): void {
    if (event.shiftKey) this.deck().clearHotCue(index);
    else this.deck().hotCue(index);
  }

  clearHotCue(index: number, event: MouseEvent): void {
    event.preventDefault();
    this.deck().clearHotCue(index);
  }

  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60);
    const tenths = Math.floor((seconds * 10) % 10);
    return `${minutes}:${rest.toString().padStart(2, '0')}.${tenths}`;
  }

  formatPercent(value: number): string {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)} %`;
  }
}
