/** Response returned by mongoose-aggregate-paginate-v2 for a paginated query. */
export interface AggregatePage<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  page: number;
  totalPages: number;
  nextPage: number | null;
  prevPage: number | null;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  pagingCounter: number;
}

/** Previous response shape, accepted while an already-running API is restarted. */
export interface LegacyPage<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export type TrackPageResponse<T> = AggregatePage<T> | LegacyPage<T>;
