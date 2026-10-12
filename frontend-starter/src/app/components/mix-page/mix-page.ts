import { Component, inject, signal } from '@angular/core';
import { DeckId, TRACK_DRAG_TYPE } from '../../shared/models/dj.model';
import { Track } from '../../shared/models/track.model';
import { DjEngineService } from '../../shared/services/dj-engine.service';
import { DjDeckComponent } from '../dj-deck/dj-deck';
import { DjLibraryComponent } from '../dj-library/dj-library';
import { DjMixerComponent } from '../dj-mixer/dj-mixer';
import { DjVisualizerComponent } from '../dj-visualizer/dj-visualizer';

/** Onglet « Mixage » : deux platines, le mixeur et la bibliothèque de l'utilisateur. */
@Component({
  imports: [DjDeckComponent, DjMixerComponent, DjLibraryComponent, DjVisualizerComponent],
  templateUrl: './mix-page.html',
  styleUrl: './mix-page.css',
  host: { '(document:keydown)': 'shortcut($event)' },
})
export class MixPageComponent {
  readonly engine = inject(DjEngineService);
  readonly dropTarget = signal<DeckId | null>(null);

  dragOver(id: DeckId, event: DragEvent): void {
    if (!event.dataTransfer?.types.includes(TRACK_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    this.dropTarget.set(id);
  }

  dragLeave(id: DeckId): void {
    if (this.dropTarget() === id) this.dropTarget.set(null);
  }

  drop(id: DeckId, event: DragEvent): void {
    this.dropTarget.set(null);
    const raw = event.dataTransfer?.getData(TRACK_DRAG_TYPE);
    if (!raw) return;
    event.preventDefault();
    try {
      this.engine.loadTrack(id, JSON.parse(raw) as Track);
    } catch (error) {
      console.error('[MixPage] Piste déposée illisible', error);
    }
  }

  /** Raccourcis clavier des platines, ignorés pendant une saisie ou sur un bouton rotatif. */
  shortcut(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, select, textarea, [role="slider"]') || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const actions: Record<string, () => void> = {
      q: () => this.engine.togglePlay('A'),
      p: () => this.engine.togglePlay('B'),
      w: () => this.engine.deck('A').cue(),
      o: () => this.engine.deck('B').cue(),
      s: () => this.engine.toggleSync('A'),
      l: () => this.engine.toggleSync('B'),
    };
    const action = actions[event.key.toLowerCase()];
    if (!action) return;
    event.preventDefault();
    action();
  }
}
