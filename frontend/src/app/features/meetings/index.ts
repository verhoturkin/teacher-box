import { Routes } from '@angular/router';
import { openCallGuard } from './call/open-call.guard';

/**
 * Public API of the meetings feature, loaded lazily by the application (ADR-0030): the call above the
 * routes (`@defer` in the root component) and the route of a built-in room's link.
 */
export { CallHost } from './call/call-host';

/** `/call/:ownerId`: opens the call over the user's pages. */
export const CALL_ROUTES: Routes = [{ path: '', canActivate: [openCallGuard], children: [] }];
