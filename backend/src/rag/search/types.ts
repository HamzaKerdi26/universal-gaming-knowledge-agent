export interface SearchOptions {
  limit?: number;
  gameSlug?: string;
  category?: string;
}

export interface SearchResultItem {
  score: number;
  chunkId: string;
  documentId: string;
  gameSlug: string;
  category?: string;
  title: string;
  content: string;
  chunkIndex: number;
}
