import { checkFiles, FilePolicy } from './check-files';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0];

function file(name: string, bytes: number[], size = bytes.length): File {
  const content = new Uint8Array(size);
  content.set(bytes);
  return new File([content], name);
}

const policy: FilePolicy = { maxSize: 1000, extensions: ['png', 'jpg', 'pdf', 'txt'] };

describe('checkFiles', () => {
  it('accepts files of an allowed type whose first bytes match', async () => {
    const files = [
      file('a.png', PNG),
      file('b.JPG', JPEG),
      file('c.pdf', PDF),
      file('d.txt', [65]),
    ];

    const result = await checkFiles(files, policy);

    expect(result.accepted).toEqual(files);
    expect(result.rejected).toEqual([]);
  });

  it('rejects a file over the size limit', async () => {
    const big = file('big.png', PNG, 1001);

    const result = await checkFiles([big], policy);

    expect(result.accepted).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]).toMatchObject({ file: big, code: 'file.too-large' });
    expect(result.rejected[0]?.message).toContain('big.png');
  });

  it('rejects an extension that is not allowed or missing', async () => {
    const result = await checkFiles([file('a.exe', [1]), file('noext', [1])], policy);

    expect(result.rejected.map((problem) => problem.code)).toEqual([
      'file.type-unsupported',
      'file.type-unsupported',
    ]);
  });

  it('rejects a picture or a PDF whose first bytes do not match the extension', async () => {
    const result = await checkFiles(
      [file('fake.png', PDF), file('fake.pdf', PNG), file('fake.jpg', [1, 2, 3])],
      policy,
    );

    expect(result.accepted).toEqual([]);
    expect(result.rejected.map((problem) => problem.code)).toEqual([
      'file.type-unsupported',
      'file.type-unsupported',
      'file.type-unsupported',
    ]);
  });

  it('recognizes gif, webp and heic by their first bytes', async () => {
    const all: FilePolicy = { maxSize: 1000, extensions: ['gif', 'webp', 'heic'] };
    const gif = file('a.gif', [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    const webp = file('a.webp', [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    const heic = file('a.heic', [0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);

    const result = await checkFiles([gif, webp, heic], all);

    expect(result.accepted).toEqual([gif, webp, heic]);
  });

  it('keeps the good files when others fail and reports the size problem first', async () => {
    const good = file('ok.pdf', PDF);
    const bad = file('big.exe', [1], 5000);

    const result = await checkFiles([good, bad], policy);

    expect(result.accepted).toEqual([good]);
    expect(result.rejected[0]?.code).toBe('file.too-large');
  });

  it('does not limit the size when no limit is given', async () => {
    const result = await checkFiles([file('a.png', PNG, 50_000)], {
      extensions: ['png'],
    });

    expect(result.accepted).toHaveLength(1);
  });
});
