import {
  binaryFile,
  dataUrlToBlob,
  elementsOf,
  fileId,
  readDataUrl,
  sharedAppState,
} from './excalidraw-data';

describe('Excalidraw data', () => {
  it('takes only elements with an id and a version', () => {
    const elements = [{ id: 'a', version: 1 }];

    expect(elementsOf(elements)).toBe(elements);
    expect(elementsOf([{ id: 'a' }])).toEqual([]);
    expect(elementsOf([null])).toEqual([]);
    expect(elementsOf(['a'])).toEqual([]);
  });

  it('keeps the shared appState only, with its types', () => {
    expect(
      sharedAppState({
        viewBackgroundColor: '#fff',
        gridSize: 20,
        gridStep: 5,
        gridModeEnabled: true,
        zoom: { value: 2 },
      }),
    ).toEqual({ viewBackgroundColor: '#fff', gridSize: 20, gridStep: 5, gridModeEnabled: true });
    expect(
      sharedAppState({ viewBackgroundColor: 1, gridSize: '20', gridModeEnabled: 'yes' }),
    ).toEqual({});
  });

  it('turns data URLs into files and back', async () => {
    const blob = dataUrlToBlob('data:image/png;base64,iVBORw==');
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(4);
    expect(dataUrlToBlob('data:,a%20b').type).toBe('application/octet-stream');
    expect(await dataUrlToBlob('data:text/plain,a%20b').text()).toBe('a b');
    expect(dataUrlToBlob('broken').size).toBe(0);

    const file = await binaryFile('f1', blob, 7);
    expect(file).toEqual({
      id: 'f1',
      dataURL: 'data:image/png;base64,iVBORw==',
      mimeType: 'image/png',
      created: 7,
    });
    expect((await binaryFile('f2', new Blob(['x'], { type: 'image/svg+xml' }))).mimeType).toBe(
      'image/png',
    );
    expect(() => fileId('')).toThrow();
  });

  it('fails to read what the browser cannot read', async () => {
    const original = FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL = function (this: FileReader) {
      this.dispatchEvent(new ProgressEvent('error'));
    };
    try {
      await expect(readDataUrl(new Blob(['x']))).rejects.toThrow('The image was not read');
    } finally {
      FileReader.prototype.readAsDataURL = original;
    }
  });
});
