import { Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { formatDuration } from '../../shared/audio/duration';
import { categoryOf, displayTitle } from '../../shared/models/category.model';
import { Track } from '../../shared/models/track.model';
import { AudioPlayerService } from '../../shared/services/audio-player.service';
import { CountersService } from '../../shared/services/counters.service';
import { httpMessage } from '../../shared/services/library.service';
import { ConversationSummary, ConversationThread, SocialService, TrackCard } from '../../shared/services/social.service';
import { CoverImageComponent } from '../cover-image/cover-image';
import { IconComponent } from '../icon/icon';
import { TrackPickerComponent } from '../track-picker/track-picker';

/** Fréquence de mise à jour de la conversation ouverte (onglet visible seulement). */
const THREAD_POLL_MS = 8_000;
const LIST_POLL_MS = 20_000;

/**
 * Section 7 : messagerie privée entre amis. Liste des conversations (avec non
 * lus), fil de messages, envoi de texte et de cartes musicales (« Envoyer une
 * de mes pistes »). Une carte dont l'accès a été retiré affiche « Partage interrompu ».
 */
@Component({
  imports: [RouterLink, IconComponent, CoverImageComponent, TrackPickerComponent],
  templateUrl: './messages-page.html',
  styleUrl: './messages-page.css',
})
export class MessagesPageComponent implements OnInit {
  private readonly social = inject(SocialService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly counters = inject(CountersService);
  readonly player = inject(AudioPlayerService);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  readonly categoryOf = categoryOf;
  readonly displayTitle = displayTitle;
  readonly formatDuration = formatDuration;

  readonly conversations = signal<ConversationSummary[] | null>(null);
  readonly listError = signal('');
  readonly activeId = signal<string | null>(null);
  readonly thread = signal<ConversationThread | null>(null);
  readonly threadError = signal('');
  readonly loadingOlder = signal(false);
  readonly sending = signal(false);
  readonly sendError = signal('');
  readonly pickerOpen = signal(false);
  readonly draft = signal('');

  /** Dernier message envoyé que l'autre personne a déjà lu (affiche « Vu »). */
  readonly lastSeenId = computed(() => {
    const thread = this.thread();
    if (!thread) return null;
    const seenAt = new Date(thread.otherLastReadAt).getTime();
    const mine = thread.messages.filter((message) => message.fromMe && new Date(message.createdAt).getTime() <= seenAt);
    return mine.at(-1)?.id ?? null;
  });

  private threadTimer?: ReturnType<typeof setInterval>;
  private listTimer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.loadConversations();
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => this.open(params.get('id')));
    this.listTimer = setInterval(() => this.visible() && this.loadConversations(), LIST_POLL_MS);
    this.threadTimer = setInterval(() => this.visible() && this.refreshThread(), THREAD_POLL_MS);
    this.destroyRef.onDestroy(() => {
      clearInterval(this.listTimer);
      clearInterval(this.threadTimer);
    });
  }

  private visible(): boolean {
    return this.document.visibilityState === 'visible';
  }

  loadConversations(): void {
    this.social.conversations().subscribe({
      next: ({ conversations }) => {
        this.conversations.set(conversations);
        this.listError.set('');
      },
      error: (error: unknown) => this.listError.set(httpMessage(error, 'Impossible de charger vos conversations.')),
    });
  }

  private open(id: string | null): void {
    this.activeId.set(id);
    this.thread.set(null);
    this.threadError.set('');
    this.sendError.set('');
    this.draft.set('');
    if (!id) return;
    this.social.messages(id).subscribe({
      next: (thread) => {
        this.thread.set(thread);
        this.scrollToBottom();
        this.markRead(id);
      },
      error: (error: unknown) => this.threadError.set(httpMessage(error, 'Cette conversation n’existe pas ou ne vous est pas accessible.')),
    });
  }

  /** Recharge la conversation ouverte (nouveaux messages, état des cartes, « Vu »). */
  private refreshThread(): void {
    const id = this.activeId();
    const current = this.thread();
    if (!id || !current || this.sending()) return;
    this.social.messages(id).subscribe({
      next: (thread) => {
        if (this.activeId() !== id) return;
        const hadNew = thread.messages.at(-1)?.id !== current.messages.at(-1)?.id;
        // Les messages plus anciens déjà chargés sont conservés.
        const olderIds = new Set(thread.messages.map((message) => message.id));
        const older = current.messages.filter((message) => !olderIds.has(message.id) && message.createdAt < (thread.messages[0]?.createdAt ?? ''));
        this.thread.set({ ...thread, messages: [...older, ...thread.messages], hasMore: older.length ? current.hasMore : thread.hasMore });
        if (hadNew) {
          this.scrollToBottom();
          this.markRead(id);
        }
      },
      error: () => undefined,
    });
  }

  loadOlder(): void {
    const thread = this.thread();
    if (!thread?.messages.length) return;
    this.loadingOlder.set(true);
    this.social.messages(thread.id, thread.messages[0].createdAt).subscribe({
      next: (older) => {
        this.loadingOlder.set(false);
        this.thread.update((current) => (current ? { ...current, hasMore: older.hasMore, messages: [...older.messages, ...current.messages] } : current));
      },
      error: (error: unknown) => {
        this.loadingOlder.set(false);
        this.threadError.set(httpMessage(error, 'Impossible de charger les messages précédents.'));
      },
    });
  }

  private markRead(id: string): void {
    this.social.markRead(id).subscribe({
      next: () => {
        this.conversations.update((list) => list?.map((item) => (item.id === id ? { ...item, unread: 0 } : item)) ?? null);
        this.counters.refresh();
      },
      error: () => undefined,
    });
  }

  select(conversation: ConversationSummary): void {
    void this.router.navigate(['/messages', conversation.id]);
  }

  backToList(): void {
    void this.router.navigate(['/messages']);
  }

  onKeydown(event: KeyboardEvent): void {
    // Entrée envoie ; Maj+Entrée va à la ligne.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendText();
    }
  }

  sendText(): void {
    const text = this.draft().trim();
    if (!text) return;
    this.send({ text }, () => this.draft.set(''));
  }

  sendTrack(track: Track): void {
    this.pickerOpen.set(false);
    this.send({ trackId: track.id, text: this.draft().trim() || undefined }, () => this.draft.set(''));
  }

  private send(body: { text?: string; trackId?: string }, done: () => void): void {
    const id = this.activeId();
    if (!id || this.sending()) return;
    this.sending.set(true);
    this.sendError.set('');
    this.social.send(id, body).subscribe({
      next: (message) => {
        this.sending.set(false);
        done();
        this.thread.update((thread) => (thread ? { ...thread, messages: [...thread.messages, message] } : thread));
        this.scrollToBottom();
        this.loadConversations();
      },
      error: (error: unknown) => {
        this.sending.set(false);
        this.sendError.set(httpMessage(error, 'Le message n’a pas pu être envoyé. Réessayez.'));
      },
    });
  }

  playCard(card: TrackCard): void {
    if (card.status !== 'ok') return;
    const track = card as Track;
    if (this.player.current()?.id === track.id) this.player.togglePlay();
    else this.player.playList([track], 0);
  }

  isPlaying(card: TrackCard): boolean {
    return this.player.current()?.id === card.id && this.player.playing();
  }

  asTrack(card: TrackCard): Track & { recipientAccess?: 'active' | 'revoked' } {
    return card as Track & { recipientAccess?: 'active' | 'revoked' };
  }

  cardTitle(card: TrackCard): string {
    return 'title' in card ? card.title : 'Piste supprimée';
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const element = this.scroller()?.nativeElement;
      if (element) element.scrollTop = element.scrollHeight;
    });
  }

  time(value: string): string {
    const date = new Date(value);
    const today = new Date().toDateString() === date.toDateString();
    return today
      ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  preview(conversation: ConversationSummary): string {
    const last = conversation.lastMessage;
    if (!last) return 'Nouvelle conversation';
    const body = last.text || (last.hasTrack ? 'Piste envoyée' : '');
    return (last.fromMe ? 'Vous : ' : '') + body;
  }
}
