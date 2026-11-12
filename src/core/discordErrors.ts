import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';

function hasErrorCode(error: unknown, codes: readonly RESTJSONErrorCodes[]): boolean {
  return error instanceof DiscordAPIError && codes.includes(error.code as RESTJSONErrorCodes);
}

export function isMissingWebhookError(error: unknown): boolean {
  return hasErrorCode(error, [
    RESTJSONErrorCodes.UnknownWebhook,
    RESTJSONErrorCodes.InvalidWebhookToken,
  ]);
}

export function isUnknownMessageError(error: unknown): boolean {
  return hasErrorCode(error, [RESTJSONErrorCodes.UnknownMessage]);
}

/** True when the channel or message no longer exists. */
export function isUnknownResourceError(error: unknown): boolean {
  return hasErrorCode(error, [
    RESTJSONErrorCodes.UnknownChannel,
    RESTJSONErrorCodes.UnknownMessage,
  ]);
}
