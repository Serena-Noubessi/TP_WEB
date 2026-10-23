import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, authErrorMessage } from '../../shared/services/auth.service';
import { PendingActionService, safeReturnUrl } from '../../shared/services/pending-action.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register-page.html',
  styleUrl: './register-page.css',
})
export class RegisterPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly pending = inject(PendingActionService);

  /** Action demandée avant la connexion (« aimer “X” »), affichée en bandeau. */
  readonly pendingLabel = signal(this.pending.labelFor(this.route.snapshot.queryParamMap.get('reason')));
  /** Page d'origine (protégée ou action sociale), conservée entre connexion et inscription. */
  readonly returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
  /** Paramètres transmis au lien « Créer un compte » / « Déjà inscrit ? » pour ne pas perdre l'action. */
  readonly linkParams = computed(() => ({ ...(this.returnUrl && { returnUrl: this.returnUrl }), ...(this.pendingLabel() && { reason: 'action' }) }));

  readonly error = signal('');
  readonly submitted = signal(false);
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  submit(): void {
    this.submitted.set(true);
    this.error.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();
    this.auth.register(values.name, values.email, values.password).subscribe({
      next: () => {
        console.debug('[RegisterPage] Inscription réussie');
        void this.pending.runAfterLogin(this.returnUrl ?? '/profile').then(({ url }) => this.router.navigateByUrl(url));
      },
      error: (error: unknown) => {
        const message = authErrorMessage(error, 'register');
        console.error('[RegisterPage] Échec de l’inscription:', message);
        this.error.set(message);
      },
    });
  }
}
