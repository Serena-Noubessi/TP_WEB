/** Déclarations minimales des paquets Butterchurn, publiés sans types TypeScript. */
declare module 'butterchurn' {
  export interface ButterchurnVisualizer {
    connectAudio(node: AudioNode): void;
    disconnectAudio(node: AudioNode): void;
    loadPreset(preset: object, blendTime: number): void;
    setRendererSize(width: number, height: number, options?: { pixelRatio?: number; textureRatio?: number }): void;
    render(): void;
  }

  export interface ButterchurnStatic {
    createVisualizer(
      context: AudioContext,
      canvas: HTMLCanvasElement,
      options: { width: number; height: number; pixelRatio?: number; textureRatio?: number },
    ): ButterchurnVisualizer;
  }

  const butterchurn: ButterchurnStatic | { default: ButterchurnStatic };
  export default butterchurn;
}

declare module 'butterchurn-presets' {
  export function getPresets(): Record<string, object>;
}
