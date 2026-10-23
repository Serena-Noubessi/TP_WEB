import { Component, ElementRef, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { AdminService, REPORT_REASONS, ReportReason } from '../../shared/services/admin.service';
import { httpMessage } from '../../shared/services/library.service';
import { IconComponent } from '../icon/icon';

/**
 * Signaler une piste ou un profil (sections 10 et 11). Le signalement est
 * examiné par l'administration, qui n'agit que sur les contenus publics.
 */
@Component({
  selector: 'app-report-dialog',
  imports: [IconComponent],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    <section #panel class="dialog" role="dialog" aria-modal="true" aria-labelledby="report-title" tabindex="-1">
      <header>
        <h2 id="report-title"><app-icon name="flag" /> Signaler {{ targetType() === 'track' ? 'la piste' : 'le profil' }} « {{ label() }} »</h2>
        <button type="button" class="icon-btn" (click)="closed.emit()" aria-label="Fermer"><app-icon name="close" /></button>
      </header>
      @if (sent()) {
        <p class="done" role="status"><app-icon name="check" /> Merci. Votre signalement sera examiné par l’administration. La personne signalée ne sait pas qui l’a signalée.</p>
        <button type="button" class="btn primary" (click)="closed.emit()">Fermer</button>
      } @else {
        <form (submit)="$event.preventDefault(); send()">
          <fieldset>
            <legend>Motif</legend>
            @for (reason of reasons; track reason.id) {
              <label class="option"><input type="radio" name="report-reason" [value]="reason.id" [checked]="reason.id === selected()" (change)="selected.set(reason.id)" /> {{ reason.label }}</label>
            }
          </fieldset>
          <label class="details">Précisions (facultatives)
            <textarea rows="3" maxlength="500" [value]="details()" (input)="details.set($any($event.target).value)"></textarea>
          </label>
          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
          <button type="submit" class="btn primary" [disabled]="busy()">{{ busy() ? 'Envoi…' : 'Envoyer le signalement' }}</button>
        </form>
      }
    </section>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 1rem; }
    .backdrop { position: absolute; inset: 0; background: rgb(24 50 79 / 45%); }
    .dialog { position: relative; display: grid; gap: 0.8rem; width: min(30rem, 100%); max-height: calc(100dvh - 2rem); overflow-y: auto; padding: 1.2rem; border-radius: 18px; background: var(--mv-card); box-shadow: var(--mv-shadow); }
    header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    h2 { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 1.05rem; }
    .icon-btn { display: grid; flex: 0 0 auto; width: 2.2rem; height: 2.2rem; padding: 0; place-items: center; border-radius: 50%; color: var(--mv-text); background: var(--mv-control); }
    form { display: grid; gap: 0.7rem; }
    fieldset { display: grid; gap: 0.3rem; margin: 0; padding: 0; border: 0; }
    legend { margin-bottom: 0.3rem; font-weight: 700; }
    .option { display: flex; align-items: center; gap: 0.5rem; margin: 0; padding: 0.4rem 0.5rem; border-radius: 8px; }
    .option:hover { background: var(--mv-control); }
    .option input { width: auto; margin: 0; accent-color: var(--mv-primary); }
    .details { display: grid; gap: 0.3rem; margin: 0; font-weight: 600; }
    .done { display: flex; gap: 0.5rem; margin: 0; color: var(--mv-text); }
    .error { margin: 0; color: var(--mv-danger-strong); font-weight: 600; }
    .btn { padding: 0.55rem 1rem; border-radius: 999px; font-weight: 700; }
    .btn.primary { color: var(--mv-on-accent); background: var(--mv-primary); }
  `,
})
export class ReportDialogComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  readonly targetType = input.required<'track' | 'user'>();
  readonly targetId = input.required<string>();
  readonly label = input('');
  readonly closed = output<void>();

  readonly reasons = REPORT_REASONS;
  readonly selected = signal<ReportReason>('inappropriate');
  readonly details = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly sent = signal(false);

  ngOnInit(): void {
    queueMicrotask(() => this.panel().nativeElement.focus());
  }

  send(): void {
    this.busy.set(true);
    this.error.set('');
    this.admin.report(this.targetType(), this.targetId(), this.selected(), this.details().trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.sent.set(true);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(httpMessage(error, 'Le signalement n’a pas pu être envoyé.'));
      },
    });
  }
}
