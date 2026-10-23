import { Component, computed, input, output } from '@angular/core';

/**
 * Bouton rotatif de console DJ.
 * Glisser verticalement, utiliser les flèches du clavier, double-cliquer pour revenir à la valeur par défaut.
 */
@Component({
  selector: 'app-dj-knob',
  templateUrl: './dj-knob.html',
  styleUrl: './dj-knob.css',
})
export class DjKnobComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly min = input(-1);
  readonly max = input(1);
  readonly defaultValue = input(0);
  readonly color = input('#007fff');
  readonly valueText = input('');
  readonly valueChange = output<number>();

  readonly angle = computed(() => {
    const ratio = (this.value() - this.min()) / (this.max() - this.min());
    return -135 + ratio * 270;
  });

  private dragStartY = 0;
  private dragStartValue = 0;

  startDrag(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    target.focus();
    this.dragStartY = event.clientY;
    this.dragStartValue = this.value();
  }

  drag(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (!target.hasPointerCapture(event.pointerId)) return;
    const span = this.max() - this.min();
    const sensitivity = event.shiftKey ? 600 : 180;
    this.emit(this.dragStartValue + ((this.dragStartY - event.clientY) / sensitivity) * span);
  }

  endDrag(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  }

  reset(): void {
    this.emit(this.defaultValue());
  }

  keydown(event: KeyboardEvent): void {
    const step = (this.max() - this.min()) / (event.shiftKey ? 100 : 20);
    const actions: Record<string, number> = {
      ArrowUp: this.value() + step,
      ArrowRight: this.value() + step,
      ArrowDown: this.value() - step,
      ArrowLeft: this.value() - step,
      Home: this.min(),
      End: this.max(),
    };
    const next = actions[event.key];
    if (next === undefined) return;
    event.preventDefault();
    this.emit(next);
  }

  private emit(value: number): void {
    const clamped = Math.min(this.max(), Math.max(this.min(), value));
    // Aimantation au centre pour retrouver facilement la position neutre.
    const snap = (this.max() - this.min()) * 0.025;
    this.valueChange.emit(Math.abs(clamped - this.defaultValue()) < snap ? this.defaultValue() : clamped);
  }
}
