import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import {
  BoardClipboard,
  PICTURE_SCALE,
  materialHtml,
  materialText,
} from '../to-board/board-clipboard';
import { BoardMaterial } from '../to-board/board-insert';
import type { ExcalidrawModules } from './excalidraw-loader';
import type { SceneAccess } from './board-sync';
import { binaryFile } from './excalidraw-data';

/** Width of an inserted text, scene pixels. */
export const TEXT_WIDTH = 480;

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
 * Puts a material (a task, a draft of the AI) at the centre of the view: as a text element, or as a
 * picture of the formatted text (an image element with its file). It is saved like any change.
 */
export async function insertMaterial(
  access: SceneAccess,
  modules: Pick<ExcalidrawModules, 'convertToExcalidrawElements'>,
  material: BoardMaterial,
  clipboard: Pick<BoardClipboard, 'picture'>,
): Promise<void> {
  const centre = viewportCentre(access.getAppState());
  let skeleton: ExcalidrawElementSkeleton;
  if (material.mode === 'text') {
    skeleton = {
      type: 'text',
      x: centre.x - TEXT_WIDTH / 2,
      y: centre.y,
      text: materialText(material.title, material.markdown),
    };
  } else {
    const picture = await clipboard.picture(materialHtml(material.title, material.markdown));
    const file = await binaryFile(crypto.randomUUID(), picture);
    const size = await imageSize(file.dataURL);
    access.addFiles([file]);
    const width = size.width / PICTURE_SCALE;
    const height = size.height / PICTURE_SCALE;
    skeleton = {
      type: 'image',
      x: centre.x - width / 2,
      y: centre.y - height / 2,
      width,
      height,
      fileId: file.id,
    };
  }
  const added = modules.convertToExcalidrawElements([skeleton]);
  access.updateScene({
    elements: [...access.getSceneElementsIncludingDeleted(), ...added],
    captureUpdate: 'IMMEDIATELY',
  });
}

async function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  return { width: image.naturalWidth, height: image.naturalHeight };
}
