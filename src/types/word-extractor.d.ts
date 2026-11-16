declare module 'word-extractor' {
  export interface ExtractedWordDocument {
    getBody(): string;
    getFootnotes(): string;
    getEndnotes(): string;
    getHeaders(options?: { includeFooters?: boolean }): string;
    getFooters(): string;
  }

  export default class WordExtractor {
    extract(input: string | Buffer): Promise<ExtractedWordDocument>;
  }
}
