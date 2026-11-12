const SEPARATOR = ':';
const CUSTOM_ID_LIMIT = 100;

/** Builds a component custom ID: `<handlerId>:<arg>:<arg>`. Arguments must not contain ':'. */
export function customId(handlerId: string, ...args: (string | number)[]): string {
  const id = [handlerId, ...args.map(String)].join(SEPARATOR);
  if (id.length > CUSTOM_ID_LIMIT) throw new Error(`Custom ID is too long: ${id}`);
  return id;
}

export function parseCustomId(id: string): { handlerId: string; args: string[] } {
  const [handlerId = '', ...args] = id.split(SEPARATOR);
  return { handlerId, args };
}
