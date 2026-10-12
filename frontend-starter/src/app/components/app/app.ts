import { DOCUMENT } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent {
  readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  readonly darkMode = signal(localStorage.getItem('gpc_theme') === 'dark');

  constructor() {
    effect(() => {
      this.document.body.classList.toggle('dark-mode', this.darkMode());
    });
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }

  toggleTheme(): void {
    const enabled = !this.darkMode();
    this.darkMode.set(enabled);
    localStorage.setItem('gpc_theme', enabled ? 'dark' : 'light');
  }
}
