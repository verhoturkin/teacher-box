import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import {
  BoardClipboard,
  PICTURE_SCALE,
  materialHtml,
  materialText,
} from '../to-board/board-clipboard';
import { BoardMaterial, MarkdownMaterial, PagesMaterial } from '../to-board/board-insert';
import type { ExcalidrawModules } from './excalidraw-loader';
import type { SceneAccess } from './board-sync';
import { binaryFile } from './excalidraw-data';

/** Width of an inserted text, scene pixels. */
export const TEXT_WIDTH = 480;
/** Page pictures come at 150 dpi: half of it makes an A4 page about 620 scene pixels wide. */
export const PAGE_SCALE = 2;
/** Between the pages in the row and between the pages and the frame, scene pixels. */
export const PAGE_GAP = 24;
export const FRAME_PADDING = 40;
/** Between the drawing and the frame of new pages, scene pixels. */
export const BESIDE_GAP = 80;

/** The scene, and scrolling to new pages when the editor can. */
export type InsertAccess = SceneAccess & Partial<Pick<ExcalidrawImperativeAPI, 'scrollToContent'>>;

/** Fetches a page picture by its API address (with the user's token). */
export type PictureSource = (url: string) => Promise<Blob>;

/** The scene point at the centre of what the user sees. */
export function viewportCentre(appState: {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly zoom: { readonly value: number };
  readonly width: number;
  readonly height: number;
}): {
  readonly x: number;
  readonly y: number;
} {
  const zoom = appState.zoom.value;
  return {
    x: appState.width / 2 / zoom - appState.scrollX,
    y: appState.height / 2 / zoom - appState.scrollY,
  };
}

/**
 * Puts a material at the centre of the view: a task or a draft as a text element or as a picture of the
 * formatted text; pages of a textbook as pictures in a row inside a frame (ADR-0033). It is saved like any
 * change.
 */
export async function insertMaterial(
  access: InsertAccess,
  modules: Pick<ExcalidrawModules, 'convertToExcalidrawElements'>,
  material: BoardMaterial,
  clipboard: Pick<BoardClipboard, 'picture'>,
  pictures: PictureSource,
): Promise<void> {
  const centre = viewportCentre(access.getAppState());
  const skeletons =
    material.mode === 'pages'
      ? await pagesInFrame(access, material, centre, pictures)
      : [await markdownSkeleton(access, material, centre, clipboard)];
  const added = modules.convertToExcalidrawElements(skeletons);
  access.updateScene({
    elements: [...access.getSceneElementsIncludingDeleted(), ...added],
    captureUpdate: 'IMMEDIATELY',
  });
  if (material.mode === 'pages') {
    // the pages may lie outside the view: show them
    access.scrollToContent?.(added, { fitToContent: true, animate: true });
  }
}

async function markdownSkeleton(
  access: SceneAccess,
  material: MarkdownMaterial,
  centre: { x: number; y: number },
  clipboard: Pick<BoardClipboard, 'picture'>,
): Promise<ExcalidrawElementSkeleton> {
  if (material.mode === 'text') {
    return {
      type: 'text',
      x: centre.x - TEXT_WIDTH / 2,
      y: centre.y,
      text: materialText(material.title, material.markdown),
    };
  }
  const picture = await clipboard.picture(materialHtml(material.title, material.markdown));
  const file = await binaryFile(crypto.randomUUID(), picture);
  const size = await imageSize(file.dataURL);
  access.addFiles([file]);
  const width = size.width / PICTURE_SCALE;
  const height = size.height / PICTURE_SCALE;
  return {
    type: 'image',
    x: centre.x - width / 2,
    y: centre.y - height / 2,
    width,
    height,
    fileId: file.id,
  };
}

/** The pages left to right, tops aligned, centred on the view, inside a frame named after them. */
async function pagesInFrame(
  access: SceneAccess,
  material: PagesMaterial,
  centre: { x: number; y: number },
  pictures: PictureSource,
): Promise<ExcalidrawElementSkeleton[]> {
  const files = await Promise.all(
    material.pictures.map(async (url) => binaryFile(crypto.randomUUID(), await pictures(url))),
  );
  const sizes = await Promise.all(files.map((file) => imageSize(file.dataURL)));
  access.addFiles(files);
  const widths = sizes.map((size) => size.width / PAGE_SCALE);
  const heights = sizes.map((size) => size.height / PAGE_SCALE);
  const rowWidth = widths.reduce((sum, width) => sum + width, 0) + PAGE_GAP * (files.length - 1);
  const rowHeight = Math.max(...heights);
  const drawing = drawingBounds(access);
  // to the right of everything, tops at the drawing's top; an empty board — at the centre of the view
  const left =
    drawing === null ? centre.x - rowWidth / 2 : drawing.right + BESIDE_GAP + FRAME_PADDING;
  const top = drawing === null ? centre.y - rowHeight / 2 : drawing.top + FRAME_PADDING;
  let x = left;
  const pages: ExcalidrawElementSkeleton[] = files.map((file, index) => {
    const width = widths[index] ?? 0;
    const page: ExcalidrawElementSkeleton = {
      type: 'image',
      id: `page-${String(index)}`,
      x,
      y: top,
      width,
      height: heights[index] ?? 0,
      fileId: file.id,
    };
    x += width + PAGE_GAP;
    return page;
  });
  return [
    ...pages,
    {
      type: 'frame',
      children: pages.map((_page, index) => `page-${String(index)}`),
      name: material.title,
      x: left - FRAME_PADDING,
      y: top - FRAME_PADDING,
      width: rowWidth + 2 * FRAME_PADDING,
      height: rowHeight + 2 * FRAME_PADDING,
    },
  ];
}

/** The right and top edges of what is on the board; `null` when it is empty. */
function drawingBounds(access: SceneAccess): { right: number; top: number } | null {
  let right = -Infinity;
  let top = Infinity;
  for (const element of access.getSceneElementsIncludingDeleted()) {
    if (element.isDeleted || !Number.isFinite(element.x) || !Number.isFinite(element.y)) continue;
    const width = Number.isFinite(element.width) ? element.width : 0;
    const height = Number.isFinite(element.height) ? element.height : 0;
    right = Math.max(right, element.x, element.x + width);
    top = Math.min(top, element.y, element.y + height);
  }
  return right === -Infinity ? null : { right, top };
}

async function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  return { width: image.naturalWidth, height: image.naturalHeight };
}
