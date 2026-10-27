import { SHARED_T } from '@shared/i18n/texts';
import { formatFileSize } from './file-size';

/** What a form accepts: extensions (lower case, no dot) and an optional size limit in bytes. */
export interface FilePolicy {
  readonly extensions: readonly string[];
  readonly maxSize?: number;
}

/** The keys are the codes of the backend errors, so the texts match the ones the server would give. */
export type FileProblemCode = 'file.too-large' | 'file.type-unsupported';

export interface FileProblem {
  readonly file: File;
  readonly code: FileProblemCode;
  readonly message: string;
}

export interface FileCheck {
  readonly accepted: File[];
  readonly rejected: FileProblem[];
}

/** First bytes of the types the backend recognizes by content; other extensions are checked by name only. */
const SIGNATURES: Readonly<Record<string, (head: Uint8Array) => boolean>> = {
  jpg: (head) => startsWith(head, 0, [0xff, 0xd8, 0xff]),
  jpeg: (head) => startsWith(head, 0, [0xff, 0xd8, 0xff]),
  png: (head) => startsWith(head, 0, [0x89, 0x50, 0x4e, 0x47]),
  gif: (head) => startsWith(head, 0, [0x47, 0x49, 0x46, 0x38]),
  webp: (head) =>
    startsWith(head, 0, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, 8, [0x57, 0x45, 0x42, 0x50]),
  heic: (head) => startsWith(head, 4, [0x66, 0x74, 0x79, 0x70]),
  pdf: (head) => startsWith(head, 0, [0x25, 0x50, 0x44, 0x46]),
};

const HEAD_LENGTH = 12;

function startsWith(head: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return expected.every((byte, index) => head[offset + index] === byte);
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

async function headOf(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, HEAD_LENGTH).arrayBuffer());
}

async function problemOf(file: File, policy: FilePolicy): Promise<FileProblem | null> {
  if (policy.maxSize !== undefined && file.size > policy.maxSize) {
    return {
      file,
      code: 'file.too-large',
      message: SHARED_T.fileCheck.tooLarge(file.name, formatFileSize(policy.maxSize)),
    };
  }
  const extension = extensionOf(file.name);
  const signature = SIGNATURES[extension];
  if (
    !policy.extensions.includes(extension) ||
    (signature !== undefined && !signature(await headOf(file)))
  ) {
    return {
      file,
      code: 'file.type-unsupported',
      message: SHARED_T.fileCheck.unsupported(file.name),
    };
  }
  return null;
}

/**
 * Checks files before an upload, as the backend would: the size, the type by extension and, for pictures
 * and PDF, by the first bytes. The backend checks stay — this only saves the round trip.
 */
export async function checkFiles(files: readonly File[], policy: FilePolicy): Promise<FileCheck> {
  const accepted: File[] = [];
  const rejected: FileProblem[] = [];
  for (const file of files) {
    const problem = await problemOf(file, policy);
    if (problem === null) {
      accepted.push(file);
    } else {
      rejected.push(problem);
    }
  }
  return { accepted, rejected };
}
