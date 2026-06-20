import { DataService } from './psx';

// The backend uses a single shared DataService instance (one in-memory store
// for the whole process). The class itself lives in @psx/integrations so the
// web fallback can reuse it.
export const dataService = new DataService();
export { DataService };
export type { OrderEstimate, ScreenFilters } from './psx';
