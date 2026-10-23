import { Component, ElementRef, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { displayTitle } from '../../shared/models/category.model';
import { Track } from '../../shared/models/track.model';
import { httpMessage } from '../../shared/services/library.service';
import { MixService, SourceStatus } from '../../shared/services/mix.service';
import { IconComponent } from '../icon/icon';

/**
 * « Remixer » une piste d'un autre membre (section 8) : état de mon
 * autorisation, demande à l'auteur, et ouverture dans le studio. On peut
 * s'entraîner avec la piste tout de suite ; la publication exige l'accord.
 */
@Component({
  selector: 'app-remix-dialog',
  imports: [IconComponent],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    <section #panel class="dialog" role="dialog" aria-modal="true" aria-labelledby="remix-title" tabindex="-1">
      <header>
        <h2 id="remix-title"><app-icon name="shuffle" /> Remixer « {{ title() }} »</h2>
        <button type="button" class="icon-btn" (click)="closed.emit()" aria-label="Fermer"><app-icon name="close" /></button>
      </header>
      <p class="intro">
        Vous pouvez charger cette piste dans le studio et vous entraîner tout de suite.
        Pour <strong>publier</strong> un mixage qui l’utilise, il faut l’accord de {{ track().author?.name ?? 'son auteur' }}.
      </p>

      @if (status() === null) {
        <p class="state" role="status">{{ error() || 'Vérification de votre autorisation…' }}</p>
      } @else {
        <p class="status" [class]="'status s-' + status()">
          @switch (status()) {
            @case ('accepted') { <app-icon name="check" /> Autorisation accordée : vous pouvez publier votre remix. }
            @case ('pending') { <app-icon name="bell" /> Demande envoyée : en attente de la réponse de l’auteur. }
            @case ('refused') { <app-icon name="lock" /> L’auteur a refusé. Vous pouvez refaire une demande. }
            @case ('own') { C’est votre piste. }
            @default { Vous n’avez pas encore demandé l’autorisation. }
          }
        </p>
        @if (status() === 'none' || status() === 'refused') {
          <label class="message">Message pour l’auteur (facultatif)
            <textarea rows="2" maxlength="300" [value]="message()" (input)="message.set($any($event.target).value)" placeholder="Pourquoi souhaitez-vous remixer cette piste ?"></textarea>
          </label>
          <button type="button" class="btn primary" (click)="ask()" [disabled]="busy()">Demander l’autorisation</button>
        }
      }
      @if (info()) { <p class="info" role="status">{{ info() }}</p> }
      <button type="button" class="btn ghost" (click)="openStudio()"><app-icon name="sliders" /> Ouvrir dans le studio de mixage</button>
    </section>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 1rem; }
    .backdrop { position: absolute; inset: 0; background: rgb(24 50 79 / 45%); }
    .dialog { position: relative; display: grid; gap: 0.8rem; width: min(30rem, 100%); padding: 1.2rem; border-radius: 18px; background: var(--mv-card); box-shadow: var(--mv-shadow); }
    header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    h2 { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 1.1rem; }
    .icon-btn { display: grid; flex: 0 0 auto; width: 2.2rem; height: 2.2rem; padding: 0; place-items: center; border-radius: 50%; color: var(--mv-text); background: var(--mv-control); }
    .intro, .state, .info { margin: 0; color: var(--mv-muted); }
    .status { display: flex; gap: 0.4rem; margin: 0; padding: 0.6rem 0.75rem; border-radius: 10px; background: var(--mv-control); font-weight: 600; }
    .s-accepted { color: var(--mv-success); background: color-mix(in srgb, var(--mv-success) 12%, var(--mv-card)); }
    .s-pending { color: var(--mv-warning); background: color-mix(in srgb, var(--mv-warning) 12%, var(--mv-card)); }
    .s-refused { color: var(--mv-danger-strong); background: var(--mv-danger-soft); }
    .message { display: grid; gap: 0.3rem; margin: 0; font-weight: 600; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.55rem 1rem; border: 1px solid transparent; border-radius: 999px; font-weight: 700; }
    .btn.primary { color: var(--mv-on-accent); background: var(--mv-primary); }
    .btn.ghost { color: var(--mv-text); border-color: var(--mv-border); background: var(--mv-card); }
  `,
})
export class RemixDialogComponent implements OnInit {
  private readonly mixes = inject(MixService);
  private readonly router = inject(Router);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  readonly track = input.required<Track>();
  readonly closed = output<void>();

  readonly status = signal<SourceStatus | null>(null);
  readonly message = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly info = signal('');

  title(): string {
    return displayTitle(this.track());
  }

  ngOnInit(): void {
    queueMicrotask(() => this.panel().nativeElement.focus());
    this.mixes.permission(this.track().id).subscribe({
      next: (permission) => this.status.set(permission.status),
      error: (error: unknown) => this.error.set(httpMessage(error, 'Impossible de vérifier votre autorisation.')),
    });
  }

  ask(): void {
    this.busy.set(true);
    this.info.set('');
    this.mixes.requestRemix(this.track().id, this.message().trim()).subscribe({
      next: (request) => {
        this.busy.set(false);
        this.status.set(request.status);
        this.info.set(`Demande envoyée à ${request.owner.name}. Vous recevrez une notification avec sa réponse.`);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.info.set(httpMessage(error, 'La demande n’a pas pu être envoyée.'));
      },
    });
  }

  openStudio(): void {
    this.closed.emit();
    void this.router.navigate(['/mix'], { queryParams: { load: this.track().id, deck: 'A' } });
  }
}
