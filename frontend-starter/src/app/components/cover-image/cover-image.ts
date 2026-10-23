import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';

/**
 * Pochette d'une piste. Une pochette publique est chargée directement ; une
 * pochette privée ou « Amis choisis » est demandée avec le jeton de connexion
 * (une balise <img> seule ne l'enverrait pas et le serveur la refuserait).
 * Le contenu projeté sert de remplacement s'il n'y a pas de pochette ou si
 * elle n'est pas accessible.
 */
@Component({
  selector: 'app-cover-image',
  template: `
    @if (src(); as source) {
      <img [src]="source" [alt]="alt()" loading="lazy" (error)="src.set(null)" />
    } @else {
      <ng-content />
    }
  `,
  styles: `
    :host { display: contents; }
    img { width: 100%; height: 100%; object-fit: cover; }
  `,
})
export class CoverImageComponent {
  private readonly http = inject(HttpClient);

  readonly url = input<string | null | undefined>(null);
  /** Vrai si la pochette peut être chargée sans jeton (piste publique, image externe). */
  readonly direct = input(false);
  readonly alt = input('');

  readonly src = signal<string | null>(null);
  private objectUrl: string | null = null;
  private request?: Subscription;

  constructor() {
    effect(() => {
      const url = this.url();
      const direct = this.direct();
      this.release();
      if (!url) return;
      if (direct) {
        this.src.set(url);
        return;
      }
      this.request = this.http.get(url, { responseType: 'blob' }).subscribe({
        next: (blob) => {
          this.objectUrl = URL.createObjectURL(blob);
          this.src.set(this.objectUrl);
        },
        error: () => this.src.set(null),
      });
    });
    inject(DestroyRef).onDestroy(() => this.release());
  }

  private release(): void {
    this.request?.unsubscribe();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.src.set(null);
  }
}
