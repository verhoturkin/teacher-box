/** The text of a help article. */
export interface HelpArticleText {
  readonly title: string;
  /** One line for the contents and the search. */
  readonly summary: string;
  /** Markdown; links to other articles are paths like `/teacher/help/groups`. */
  readonly body: string;
}

/** A help article with its topic. */
export interface HelpArticle extends HelpArticleText {
  readonly id: string;
}
