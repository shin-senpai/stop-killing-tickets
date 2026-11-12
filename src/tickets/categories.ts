import { ChannelType, type CategoryChannel, type Guild } from 'discord.js';
import { CATEGORY_CHANNEL_LIMIT } from '../core/limits.js';
import { KeyedSerialQueue } from '../core/serialQueue.js';
import { overflowCategoryName } from './names.js';
import { addOverflowCategory, getOverflowCategoryIds, removeOverflowCategory } from './repo.js';

const categoryQueue = new KeyedSerialQueue<string>();

/**
 * Creates a channel in the base category, or in an overflow category once the
 * base is full. Serialized per base category so the channel count cannot go
 * stale between the check and the creation.
 */
export function createInCategory<T>(
  guild: Guild,
  baseCategoryId: string,
  create: (parent: CategoryChannel) => Promise<T>,
): Promise<T> {
  return categoryQueue.run(baseCategoryId, async () =>
    create(await categoryWithRoom(guild, baseCategoryId)),
  );
}

async function categoryWithRoom(guild: Guild, baseCategoryId: string): Promise<CategoryChannel> {
  const base = guild.channels.cache.get(baseCategoryId);
  if (base?.type !== ChannelType.GuildCategory) {
    throw new Error(`Ticket category ${baseCategoryId} is missing in ${guild.name} (${guild.id})`);
  }
  if (hasRoom(base)) return base;

  const overflows = existingOverflows(guild, base.id);
  return overflows.find(hasRoom) ?? createOverflowCategory(guild, base, overflows.length + 2);
}

function existingOverflows(guild: Guild, baseCategoryId: string): CategoryChannel[] {
  const categories: CategoryChannel[] = [];
  for (const id of getOverflowCategoryIds(baseCategoryId)) {
    const category = guild.channels.cache.get(id);
    if (category?.type === ChannelType.GuildCategory) categories.push(category);
    else removeOverflowCategory(baseCategoryId, id);
  }
  return categories;
}

async function createOverflowCategory(
  guild: Guild,
  base: CategoryChannel,
  index: number,
): Promise<CategoryChannel> {
  const category = await guild.channels.create({
    name: overflowCategoryName(base.name, index),
    type: ChannelType.GuildCategory,
    permissionOverwrites: base.permissionOverwrites.cache,
    reason: `Category "${base.name}" is full`,
  });
  addOverflowCategory(base.id, category.id);
  return category;
}

function hasRoom(category: CategoryChannel): boolean {
  return category.children.cache.size < CATEGORY_CHANNEL_LIMIT;
}
