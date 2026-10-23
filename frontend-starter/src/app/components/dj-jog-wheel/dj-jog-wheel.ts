import { afterNextRender, Component, DestroyRef, ElementRef, inject, input, viewChild } from '@angular/core';
import { DeckEngine, SECONDS_PER_TURN } from '../../shared/audio/deck-engine';

/**
 * Platine vinyle virtuelle : elle tourne avec la lecture et permet de scratcher
 * en la faisant tourner à la souris, au doigt ou avec les flèches du clavier.
 */
@Component({
  selector: 'app-dj-jog-wheel',
  templateUrl: './dj-jog-wheel.html',
  styleUrl: './dj-jog-wheel.css',
})
export class DjJogWheelComponent {
  readonly deck = input.required<DeckEngine>();
  readonly color = input('#007fff');

  private readonly platter = viewChild.required<ElementRef<HTMLElement>>('platter');
  private frame = 0;
  private lastAngle = 0;
  private scratchStart = 0;
  private turned = 0;

  constructor() {
    afterNextRender(() => {
      const spin = () => {
        const rotation = (this.deck().position / SECONDS_PER_TURN) * 360;
        this.platter().nativeElement.style.transform = `rotate(${rotation}deg)`;
        this.frame = requestAnimationFrame(spin);
      };
      this.frame = requestAnimationFrame(spin);
    });
    inject(DestroyRef).onDestroy(() => {
      cancelAnimationFrame(this.frame);
      this.deck().scratchEnd();
    });
  }

  grab(event: PointerEvent): void {
    const deck = this.deck();
    if (!deck.loaded()) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.lastAngle = this.pointerAngle(event);
    this.scratchStart = deck.position;
    this.turned = 0;
    deck.scratchStart();
  }

  move(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (!target.hasPointerCapture(event.pointerId)) return;
    const angle = this.pointerAngle(event);
    let delta = angle - this.lastAngle;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    this.lastAngle = angle;
    this.turned += delta;
    this.deck().scratchTo(this.scratchStart + (this.turned / (2 * Math.PI)) * SECONDS_PER_TURN);
  }

  release(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
    this.deck().scratchEnd();
  }

  /** Les flèches déplacent la lecture d'un temps (ou de 0,25 s sans tempo connu). */
  keydown(event: KeyboardEvent): void {
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    const deck = this.deck();
    deck.seek(deck.position + direction * (deck.beatLength ?? 0.25));
  }

  private pointerAngle(event: PointerEvent): number {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2));
  }
}
