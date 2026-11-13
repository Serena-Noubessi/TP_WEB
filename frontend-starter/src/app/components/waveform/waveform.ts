import { Component, computed, input, output } from '@angular/core';

/**
 * Petite image du son (forme d'onde) : une barre verticale par tranche du
 * morceau. La partie déjà écoutée est colorée (`progress`). Si `seekable` est
 * vrai, un clic déplace la lecture à cet endroit. Sans données, une ligne
 * discrète est affichée.
 */
@Component({
  selector: 'app-waveform',
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + width() + ' 100'"
      preserveAspectRatio="none"
      [class.seekable]="seekable()"
      (click)="onClick($event)"
      [attr.role]="seekable() ? 'slider' : 'img'"
      [attr.aria-label]="seekable() ? 'Position dans le morceau (forme d’onde)' : 'Forme d’onde du morceau'"
      [attr.aria-valuenow]="seekable() ? percent() : null"
      [attr.aria-valuemin]="seekable() ? 0 : null"
      [attr.aria-valuemax]="seekable() ? 100 : null"
    >
      @if (bars().length) {
        @for (bar of bars(); track $index) {
          <rect [attr.x]="$index * 3" [attr.y]="(100 - bar) / 2" width="2" [attr.height]="bar" rx="1" [class.played]="isPlayed($index)" />
        }
      } @else {
        <rect x="0" y="48" [attr.width]="width()" height="4" rx="2" class="empty" />
      }
    </svg>
  `,
  styles: `
    :host { display: block; height: var(--wave-height, 1.6rem); color: var(--wave-color, var(--mv-primary)); }
    svg { display: block; width: 100%; height: 100%; overflow: visible; }
    svg.seekable { cursor: pointer; }
    rect { fill: currentColor; opacity: 0.35; transition: opacity 120ms linear; }
    rect.played { opacity: 1; }
    rect.empty { opacity: 0.18; }
  `,
})
export class WaveformComponent {
  /** Valeurs de 0 à 100 (une par barre), ou null si la forme d'onde n'est pas encore connue. */
  readonly peaks = input<number[] | null | undefined>(null);
  /** Part déjà écoutée, de 0 à 1 (null : rien n'est coloré en plus). */
  readonly progress = input<number | null>(null);
  readonly seekable = input(false);
  /** Position choisie par un clic, de 0 à 1. */
  readonly seek = output<number>();

  readonly bars = computed(() => this.peaks() ?? []);
  readonly width = computed(() => Math.max(1, (this.bars().length || 64) * 3 - 1));
  readonly percent = computed(() => Math.round((this.progress() ?? 0) * 100));

  isPlayed(index: number): boolean {
    const progress = this.progress();
    // Sans lecture en cours, toutes les barres sont pleines ; sinon seulement la partie écoutée.
    return progress === null || (index + 0.5) / this.bars().length <= progress;
  }

  onClick(event: MouseEvent): void {
    if (!this.seekable()) return;
    const box = (event.currentTarget as SVGElement).getBoundingClientRect();
    if (!box.width) return;
    this.seek.emit(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)));
  }
}
