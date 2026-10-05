import type { FileId, OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFileData, DataURL, LibraryItems } from '@excalidraw/excalidraw/types';

/** The image types a board keeps (the server takes the same, never SVG). */
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

/** The part of an appState a board shares: background and grid. */
export type SharedAppState = Partial<
  Pick<AppState, 'viewBackgroundColor' | 'gridSize' | 'gridStep' | 'gridModeEnabled'>
>;

/** Elements of a drawing from the server (plain JSON): every one has an id and a version. */
export function isElements(
  values: readonly unknown[],
): values is readonly OrderedExcalidrawElement[] {
  return values.every(
    (value) =>
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      typeof value.id === 'string' &&
      'version' in value &&
      typeof value.version === 'number',
  );
}

/** The elements of a stored drawing; nothing when the JSON is not a drawing. */
export function elementsOf(values: readonly unknown[]): readonly OrderedExcalidrawElement[] {
  return isElements(values) ? values : [];
}

/** Library items from the server (plain JSON): every one has an id and elements; nothing otherwise. */
export function libraryItemsOf(values: readonly unknown[]): LibraryItems {
  return isLibraryItems(values) ? values : [];
}

function isLibraryItems(values: readonly unknown[]): values is LibraryItems {
  return values.every(
    (value) =>
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      typeof value.id === 'string' &&
      'elements' in value &&
      Array.isArray(value.elements),
  );
}

/** The shared part of an appState, from Excalidraw's or from the server's JSON. */
export function sharedAppState(appState: object): SharedAppState {
  const shared: SharedAppState = {};
  if ('viewBackgroundColor' in appState && typeof appState.viewBackgroundColor === 'string') {
    shared.viewBackgroundColor = appState.viewBackgroundColor;
  }
  if ('gridSize' in appState && typeof appState.gridSize === 'number') {
    shared.gridSize = appState.gridSize;
  }
  if ('gridStep' in appState && typeof appState.gridStep === 'number') {
    shared.gridStep = appState.gridStep;
  }
  if ('gridModeEnabled' in appState && typeof appState.gridModeEnabled === 'boolean') {
    shared.gridModeEnabled = appState.gridModeEnabled;
  }
  return shared;
}

function isFileId(id: string): id is FileId {
  return id.length > 0;
}

function isDataUrl(value: string): value is DataURL {
  return value.startsWith('data:');
}

function isImageType(type: string): type is BinaryFileData['mimeType'] {
  return IMAGE_TYPES.some((image) => image === type);
}

/** A file id Excalidraw takes (a non-empty string). */
export function fileId(id: string): FileId {
  if (!isFileId(id)) throw new Error('An empty file id');
  return id;
}

export function readDataUrl(blob: Blob): Promise<DataURL> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string' && isDataUrl(result)) resolve(result);
      else reject(new Error('The image was not read'));
    };
    reader.onerror = () => {
      reject(new Error('The image was not read'));
    };
    reader.readAsDataURL(blob);
  });
}

/** An image for Excalidraw's `addFiles`. */
export async function binaryFile(
  id: string,
  blob: Blob,
  now = Date.now(),
): Promise<BinaryFileData> {
  return {
    id: fileId(id),
    dataURL: await readDataUrl(blob),
    mimeType: isImageType(blob.type) ? blob.type : 'image/png',
    created: now,
  };
}

/** The bytes of a `data:` URL, e.g. an image Excalidraw holds. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header = '', data = ''] = dataUrl.split(',', 2);
  const type = /^data:([^;,]+)/.exec(header)?.[1] ?? 'application/octet-stream';
  const bytes = header.includes(';base64') ? atob(data) : decodeURIComponent(data);
  const buffer = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index++) buffer[index] = bytes.charCodeAt(index);
  return new Blob([buffer], { type });
}
