/**
 * Minimal Web NFC type declarations.
 *
 * The Web NFC spec is supported only on Chrome for Android, so the standard
 * lib.dom.d.ts shipped with TypeScript does not include it. We declare just
 * enough of the surface to let `LinkImplant.tsx` and `TerminalDemo.tsx` use
 * `NDEFReader` without `(window as any)` casts.
 *
 * See: https://developer.mozilla.org/en-US/docs/Web/API/Web_NFC_API
 */

interface NDEFRecord {
  recordType: string;
  mediaType?: string;
  id?: string;
  data?: ArrayBuffer | DataView;
  encoding?: string;
  lang?: string;
}

interface NDEFMessage {
  records: NDEFRecord[];
}

interface NDEFReadingEvent extends Event {
  serialNumber: string;
  message: NDEFMessage;
}

interface NDEFReader extends EventTarget {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  write(message: unknown, options?: { signal?: AbortSignal }): Promise<void>;
  onreading: ((this: NDEFReader, event: NDEFReadingEvent) => void) | null;
  onreadingerror: ((this: NDEFReader, event: Event) => void) | null;
}

interface NDEFReaderConstructor {
  new (): NDEFReader;
  prototype: NDEFReader;
}

interface Window {
  NDEFReader?: NDEFReaderConstructor;
}

declare const NDEFReader: NDEFReaderConstructor;
