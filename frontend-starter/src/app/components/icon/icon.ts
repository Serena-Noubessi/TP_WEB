import { Component, computed, input } from '@angular/core';
import { ICONS, IconName } from '../../shared/icons/icons';

/**
 * Icône vectorielle (SVG) au trait fin, de la bibliothèque Lucide.
 * Elle prend la couleur du texte qui l'entoure (currentColor) et sa taille en em,
 * pour s'aligner naturellement sur le texte. Décorative par défaut (aria-hidden) :
 * le sens doit être donné par le texte voisin ou par un aria-label sur le bouton.
 */
@Component({
  selector: 'app-icon',
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      [attr.stroke-width]="strokeWidth()"
      [attr.width]="size()"
      [attr.height]="size()"
      aria-hidden="true"
      focusable="false"
    >
      @for (node of nodes(); track $index) {
        @switch (node[0]) {
          @case ('path') { <svg:path [attr.d]="node[1]['d']" /> }
          @case ('circle') { <svg:circle [attr.cx]="node[1]['cx']" [attr.cy]="node[1]['cy']" [attr.r]="node[1]['r']" /> }
          @case ('rect') {
            <svg:rect [attr.x]="node[1]['x']" [attr.y]="node[1]['y']" [attr.width]="node[1]['width']" [attr.height]="node[1]['height']" [attr.rx]="node[1]['rx']" [attr.ry]="node[1]['ry']" />
          }
          @case ('line') { <svg:line [attr.x1]="node[1]['x1']" [attr.y1]="node[1]['y1']" [attr.x2]="node[1]['x2']" [attr.y2]="node[1]['y2']" /> }
          @case ('polyline') { <svg:polyline [attr.points]="node[1]['points']" /> }
          @case ('polygon') { <svg:polygon [attr.points]="node[1]['points']" /> }
          @case ('ellipse') { <svg:ellipse [attr.cx]="node[1]['cx']" [attr.cy]="node[1]['cy']" [attr.rx]="node[1]['rx']" [attr.ry]="node[1]['ry']" /> }
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      line-height: 0;
      vertical-align: -0.15em;
    }
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  /** Taille CSS (par défaut 1em : la taille du texte). */
  readonly size = input('1em');
  readonly strokeWidth = input(2);

  readonly nodes = computed(() => ICONS[this.name()] as unknown as [string, Record<string, string | number | undefined>][]);
}
