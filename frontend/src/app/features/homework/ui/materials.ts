import { T } from '../i18n/texts';

/** A kind of material an assignment has, with how many (the board has no count). */
export interface Material {
  readonly icon: string;
  readonly label: string;
  readonly count: number | null;
}

/** The materials an assignment has, as icons with counts: the same on the teacher's and the student's lists. */
export function materialsOf(
  assignment: {
    readonly textbooks: number;
    readonly files: number;
    readonly questions: number;
    readonly videos: number;
  },
  board: boolean,
): Material[] {
  const labels = T.list.materials;
  const all: Material[] = [
    { icon: 'tb-i tb-i-menu_book', label: labels.textbooks, count: assignment.textbooks },
    { icon: 'tb-i tb-i-attach_file', label: labels.files, count: assignment.files },
    { icon: 'tb-i tb-i-quiz', label: labels.questions, count: assignment.questions },
    { icon: 'tb-i tb-i-videocam', label: labels.videos, count: assignment.videos },
  ];
  return [
    ...all.filter((material) => material.count !== 0),
    ...(board ? [{ icon: 'tb-i tb-i-co_present', label: labels.board, count: null }] : []),
  ];
}

export function materialLabel(material: Material): string {
  return material.count === null
    ? material.label
    : T.list.materials.count(material.label, material.count);
}
