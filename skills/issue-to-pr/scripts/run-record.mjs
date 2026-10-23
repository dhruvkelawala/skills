// The run record's header: its `key: value` lines before the first blank line, above the stage
// reports. references/run-record.md has the format.

const headerOf = (record) => record.split("\n\n")[0];

export const header = (record, key) => headerOf(record).match(new RegExp(`^${key}: (.+)$`, "m"))?.[1].trim() ?? "";

// Rewrites the key's line in place, or adds it at the end of the header.
export function setHeader(record, key, value) {
  const top = headerOf(record);
  const line = new RegExp(`^${key}: .*$`, "m");
  const updated = line.test(top) ? top.replace(line, () => `${key}: ${value}`) : `${top.replace(/\n$/, "")}\n${key}: ${value}`;
  return updated + record.slice(top.length);
}
