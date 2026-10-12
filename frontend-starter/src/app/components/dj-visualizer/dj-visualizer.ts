import { Component, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import type { ButterchurnVisualizer } from 'butterchurn';
import { DjEngineService } from '../../shared/services/dj-engine.service';

const BLEND_SECONDS = 2.5;
const AUTO_CHANGE_MS = 30000;
/** Au-delà, le rendu plein écran d'un écran 4K devient trop coûteux pour le GPU. */
const MAX_PIXEL_RATIO = 2;

/**
 * Visualiseur Butterchurn (MilkDrop en WebGL 2) affiché en fond d'écran animé,
 * derrière la console, et alimenté par la sortie master (après crossfader).
 * Les bibliothèques ne sont téléchargées qu'à la première activation.
 */
@Component({
  selector: 'app-dj-visualizer',
  templateUrl: './dj-visualizer.html',
  styleUrl: './dj-visualizer.css',
  host: {
    '(window:resize)': 'resize()',
    '(document:fullscreenchange)': 'onFullscreenChange()',
  },
})
export class DjVisualizerComponent {
  private readonly engine = inject(DjEngineService);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  /** Conteneur mis en plein écran : la console entière, pour garder les platines par-dessus le fond. */
  readonly fullscreenTarget = input.required<HTMLElement>();

  readonly enabled = signal(false);
  readonly starting = signal(false);
  readonly fullscreen = signal(false);
  readonly error = signal('');
  readonly presetNames = signal<string[]>([]);
  readonly currentPreset = signal('');
  readonly autoChange = signal(true);

  private visualizer?: ButterchurnVisualizer;
  private source?: AudioNode;
  private presets: Record<string, object> = {};
  private frame = 0;
  private autoTimer?: ReturnType<typeof setInterval>;
  private shell?: HTMLElement;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.document.fullscreenElement === this.fullscreenTarget()) void this.document.exitFullscreen();
      this.stop();
    });
  }

  async toggle(): Promise<void> {
    if (this.enabled()) this.stop();
    else await this.start();
  }

  /**
   * L'API Fullscreen exige un geste de l'utilisateur encore « frais » :
   * la demande part avant le chargement (asynchrone) des bibliothèques.
   */
  toggleFullscreen(): void {
    if (this.document.fullscreenElement) {
      void this.document.exitFullscreen();
      return;
    }
    const target = this.fullscreenTarget();
    if (!target.requestFullscreen) {
      this.error.set('Le plein écran n’est pas pris en charge par ce navigateur.');
      return;
    }
    target.requestFullscreen().catch((error: unknown) => {
      console.warn('[DjVisualizer] Plein écran refusé', error);
      this.error.set('Le navigateur a refusé le plein écran.');
    });
    if (!this.enabled() && !this.starting()) void this.start();
  }

  onFullscreenChange(): void {
    this.fullscreen.set(this.document.fullscreenElement === this.fullscreenTarget());
    // La taille de la fenêtre change à l'entrée/sortie : on attend la nouvelle mise en page.
    requestAnimationFrame(() => this.resize());
  }

  choosePreset(event: Event): void {
    this.loadPreset((event.target as HTMLSelectElement).value, BLEND_SECONDS);
    this.restartAutoChange();
  }

  randomPreset(blend = BLEND_SECONDS): void {
    const names = this.presetNames();
    if (!names.length) return;
    let name = names[Math.floor(Math.random() * names.length)];
    if (name === this.currentPreset() && names.length > 1) name = names[(names.indexOf(name) + 1) % names.length];
    this.loadPreset(name, blend);
  }

  toggleAutoChange(): void {
    this.autoChange.update((value) => !value);
    this.restartAutoChange();
  }

  /**
   * Le canvas couvre toute la fenêtre (position fixe). Son tampon est dimensionné
   * en pixels physiques, et Butterchurn reçoit exactement cette taille : il dessine
   * l'image finale en `width × height` sans appliquer lui-même le devicePixelRatio.
   */
  resize(): void {
    const canvas = this.canvas().nativeElement;
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    this.visualizer?.setRendererSize(width, height, { pixelRatio: 1, textureRatio: 1 });
  }

  private async start(): Promise<void> {
    this.error.set('');
    if (!this.document.createElement('canvas').getContext('webgl2')) {
      this.error.set('Le visualiseur nécessite WebGL 2, non disponible dans ce navigateur.');
      return;
    }

    this.starting.set(true);
    try {
      const [{ context, output }, butterchurnModule, presetsModule] = await Promise.all([
        this.engine.masterSource(),
        import('butterchurn'),
        import('butterchurn-presets'),
      ]);
      // Paquets CommonJS : selon l'interopérabilité, l'API est sur `default` ou `default.default`.
      const imported = butterchurnModule.default;
      const butterchurn = 'default' in imported ? imported.default : imported;
      const presetsApi = presetsModule as unknown as {
        getPresets?: () => Record<string, object>;
        default?: { getPresets: () => Record<string, object> };
      };
      this.presets = (presetsApi.getPresets ?? presetsApi.default?.getPresets)?.() ?? {};
      this.presetNames.set(Object.keys(this.presets).sort((a, b) => a.localeCompare(b)));

      this.enabled.set(true);
      this.setShellTransparent(true);
      const canvas = this.canvas().nativeElement;
      this.resize();
      this.visualizer = butterchurn.createVisualizer(context, canvas, {
        width: canvas.width,
        height: canvas.height,
        pixelRatio: 1,
        textureRatio: 1,
      });
      // Sortie finale du moteur : après crossfader, volume master et limiteur.
      this.visualizer.connectAudio(output);
      this.source = output;
      this.randomPreset(0);
      this.restartAutoChange();

      const render = () => {
        this.visualizer?.render();
        this.frame = requestAnimationFrame(render);
      };
      this.frame = requestAnimationFrame(render);
      console.debug('[DjVisualizer] Butterchurn démarré', this.presetNames().length, 'presets');
    } catch (error) {
      console.error('[DjVisualizer] Démarrage impossible', error);
      this.error.set('Impossible de démarrer le visualiseur Butterchurn.');
      this.stop();
    } finally {
      this.starting.set(false);
    }
  }

  private loadPreset(name: string, blend: number): void {
    const preset = this.presets[name];
    if (!preset || !this.visualizer) return;
    this.visualizer.loadPreset(preset, blend);
    this.currentPreset.set(name);
  }

  private restartAutoChange(): void {
    if (this.autoTimer) clearInterval(this.autoTimer);
    this.autoTimer = undefined;
    if (this.enabled() && this.autoChange()) {
      this.autoTimer = setInterval(() => this.randomPreset(), AUTO_CHANGE_MS);
    }
  }

  /**
   * Le canvas est en z-index négatif : les fonds opaques de `body` et de
   * `.app-shell` (définis par le squelette) seraient peints par-dessus. On les
   * rend transparents tant que les visuels tournent, sans modifier les feuilles
   * de style existantes ; le fond de `html` reste peint sous le canvas.
   */
  private setShellTransparent(transparent: boolean): void {
    this.shell ??= this.host.nativeElement.closest<HTMLElement>('.app-shell') ?? undefined;
    for (const element of [this.document.body, this.shell]) {
      if (!element) continue;
      if (transparent) element.style.setProperty('background', 'transparent');
      else element.style.removeProperty('background');
    }
  }

  private stop(): void {
    cancelAnimationFrame(this.frame);
    if (this.autoTimer) clearInterval(this.autoTimer);
    this.autoTimer = undefined;
    if (this.visualizer && this.source) this.visualizer.disconnectAudio(this.source);
    this.visualizer = undefined;
    this.source = undefined;
    this.enabled.set(false);
    this.setShellTransparent(false);
  }
}
