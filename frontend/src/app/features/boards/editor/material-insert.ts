import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { BinaryFileData, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import {
  BoardClipboard,
  PICTURE_SCALE,
  materialHtml,
  materialText,
} from '../to-board/board-clipboard';
import { AssignmentMaterial, BoardMaterial, MarkdownMaterial } from '../to-board/board-insert';
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

/** The scene, and scrolling to new pages and waiting for the initial data when the editor can. */
export type InsertAccess = SceneAccess &
  Partial<Pick<ExcalidrawImperativeAPI, 'scrollToContent' | 'onChange'>>;

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
 * Resolves once the editor has loaded its initial data. Excalidraw hands out its API before that, and the
 * loaded drawing replaces whatever was put on the scene meanwhile (a text came at once and was lost).
 */
export function sceneLoaded(access: InsertAccess): Promise<void> {
  const subscribe = access.onChange;
  if (!access.getAppState().isLoading || subscribe === undefined) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const stop = subscribe((_elements, appState) => {
      if (!appState.isLoading) {
        stop();
        resolve();
      }
    });
  });
}

/**
 * Puts a material at the centre of the view: a task or a draft as a text element or as a picture of the
 * formatted text; pages of a textbook as pictures in a row inside a frame (ADR-0033); a written assignment as its
 * text and then its pictures in a row inside a frame. It is saved like any change.
 */
export async function insertMaterial(
  access: InsertAccess,
  modules: Pick<ExcalidrawModules, 'convertToExcalidrawElements'>,
  material: BoardMaterial,
  clipboard: Pick<BoardClipboard, 'picture'>,
  pictures: PictureSource,
): Promise<void> {
  await sceneLoaded(access);
  const centre = viewportCentre(access.getAppState());
  const skeletons =
    material.mode === 'pages'
      ? rowInFrame(access, material.title, await pictureBlocks(access, material, pictures), centre)
      : material.mode === 'assignment'
        ? rowInFrame(
            access,
            material.frame,
            [
              await taskBlock(access, modules, material, clipboard),
              ...(await pictureBlocks(access, material, pictures)),
            ],
            centre,
          )
        : [await markdownSkeleton(access, material, centre, clipboard)];
  const added = modules.convertToExcalidrawElements(skeletons);
  access.updateScene({
    elements: [...access.getSceneElementsIncludingDeleted(), ...added],
    captureUpdate: 'IMMEDIATELY',
  });
  if (material.mode !== 'text' && material.mode !== 'image') {
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
  const block = await textPicture(access, material, clipboard);
  return block.place(centre.x - block.width / 2, centre.y - block.height / 2, 'material');
}

/** What goes in a row inside a frame: its size and the element it becomes at a place. */
interface Block {
  readonly width: number;
  readonly height: number;
  place(x: number, y: number, id: string): ExcalidrawElementSkeleton;
}

/** The picture of the formatted text of a material. */
async function textPicture(
  access: SceneAccess,
  material: { readonly title: string; readonly markdown: string },
  clipboard: Pick<BoardClipboard, 'picture'>,
): Promise<Block> {
  const picture = await clipboard.picture(materialHtml(material.title, material.markdown));
  const file = await binaryFile(crypto.randomUUID(), picture);
  const size = await imageSize(file.dataURL);
  access.addFiles([file]);
  return imageBlock(file.id, size.width / PICTURE_SCALE, size.height / PICTURE_SCALE);
}

/**
 * The task of an assignment: a picture of its formatted text, or a text element — measured by converting it
 * once, so the frame holds it whole.
 */
async function taskBlock(
  access: SceneAccess,
  modules: Pick<ExcalidrawModules, 'convertToExcalidrawElements'>,
  material: AssignmentMaterial,
  clipboard: Pick<BoardClipboard, 'picture'>,
): Promise<Block> {
  if (material.text === 'image') {
    return textPicture(access, material, clipboard);
  }
  const text = materialText(material.title, material.markdown);
  const [measured] = modules.convertToExcalidrawElements([{ type: 'text', x: 0, y: 0, text }]);
  return {
    width: measured?.width ?? TEXT_WIDTH,
    height: measured?.height ?? 0,
    place: (x, y, id) => ({ type: 'text', id, x, y, text }),
  };
}

/** Pictures fetched by their API addresses, at half their size (150 dpi pages). */
async function pictureBlocks(
  access: SceneAccess,
  material: { readonly pictures: readonly string[] },
  pictures: PictureSource,
): Promise<Block[]> {
  const files = await Promise.all(
    material.pictures.map(async (url) => binaryFile(crypto.randomUUID(), await pictures(url))),
  );
  const sizes = await Promise.all(files.map((file) => imageSize(file.dataURL)));
  access.addFiles(files);
  return files.map((file, index) =>
    imageBlock(
      file.id,
      (sizes[index]?.width ?? 0) / PAGE_SCALE,
      (sizes[index]?.height ?? 0) / PAGE_SCALE,
    ),
  );
}

function imageBlock(fileId: BinaryFileData['id'], width: number, height: number): Block {
  return {
    width,
    height,
    place: (x, y, id) => ({ type: 'image', id, x, y, width, height, fileId }),
  };
}

/**
 * The blocks left to right, tops aligned, inside a frame named `name`: to the right of the drawing, or centred on
 * the view of an empty board.
 */
function rowInFrame(
  access: SceneAccess,
  name: string,
  blocks: readonly Block[],
  centre: { x: number; y: number },
): ExcalidrawElementSkeleton[] {
  const rowWidth =
    blocks.reduce((sum, block) => sum + block.width, 0) + PAGE_GAP * Math.max(0, blocks.length - 1);
  const rowHeight = Math.max(0, ...blocks.map((block) => block.height));
  const drawing = drawingBounds(access);
  // to the right of everything, tops at the drawing's top; an empty board — at the centre of the view
  const left =
    drawing === null ? centre.x - rowWidth / 2 : drawing.right + BESIDE_GAP + FRAME_PADDING;
  const top = drawing === null ? centre.y - rowHeight / 2 : drawing.top + FRAME_PADDING;
  let x = left;
  const placed = blocks.map((block, index) => {
    const element = block.place(x, top, `page-${String(index)}`);
    x += block.width + PAGE_GAP;
    return element;
  });
  return [
    ...placed,
    {
      type: 'frame',
      children: placed.map((_element, index) => `page-${String(index)}`),
      name,
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
