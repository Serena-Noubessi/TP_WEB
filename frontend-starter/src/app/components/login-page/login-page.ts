import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, authErrorMessage } from '../../shared/services/auth.service';
import { PendingActionService, safeReturnUrl } from '../../shared/services/pending-action.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly pending = inject(PendingActionService);

  /** Action demandée avant la connexion (« aimer “X” »), affichée en bandeau. */
  readonly pendingLabel = signal(this.pending.labelFor(this.route.snapshot.queryParamMap.get('reason')));
  /** Page d'origine (protégée ou action sociale), conservée entre connexion et inscription. */
  readonly returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
  /** Paramètres transmis au lien « Créer un compte » / « Déjà inscrit ? » pour ne pas perdre l'action. */
  /** Pourquoi on arrive ici après une déconnexion forcée (session expirée, compte suspendu). */
  readonly endedReason = this.route.snapshot.queryParamMap.get('reason');
  readonly linkParams = computed(() => ({ ...(this.returnUrl && { returnUrl: this.returnUrl }), ...(this.pendingLabel() && { reason: 'action' }) }));

  readonly error = signal('');
  readonly submitted = signal(false);
  readonly form = new FormGroup({
    email: new FormControl('demo@example.com', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('Demo1234!', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  submit(): void {
    this.submitted.set(true);
    this.error.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();
    this.auth.login(values.email, values.password).subscribe({
      next: () => {
        console.debug('[LoginPage] Connexion réussie');
        void this.pending.runAfterLogin(this.returnUrl ?? '/tracks').then(({ url }) => this.router.navigateByUrl(url));
      },
      error: (error: unknown) => {
        const message = authErrorMessage(error, 'login');
        console.error('[LoginPage] Échec de connexion:', message);
        this.error.set(message);
      },
    });
  }
}
