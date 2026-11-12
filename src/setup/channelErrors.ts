import { UserFacingError } from '../core/errors.js';
import { logger } from '../core/logger.js';

/** Turns a failed channel create or edit into a message that tells the admin what to fix. */
export async function withChannelPermissionHint<T>(
  action: () => Promise<T>,
  failure: string,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    logger.warn(failure, error);
    throw new UserFacingError(`${failure} Check that I have Manage Channels and Manage Roles.`);
  }
}
