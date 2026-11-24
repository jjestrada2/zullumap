type Slots = Record<string, { type: 'number' | 'string'; required: boolean }>;

/**
 * Which column feeds each slot in a remix (design: "Remix inputs the remixer must give"): --map wins; otherwise
 * a stored column is reused when the new data has a column with that exact name; required slots must end up mapped.
 */
export function resolveMapping(a: { slots: Slots; stored: Record<string, string> | undefined; overrides: Record<string, string>; columns: string[] }) {
  const mapping: Record<string, string> = {};
  const notes: string[] = [];
  for (const [slot, def] of Object.entries(a.slots)) {
    const override = a.overrides[slot];
    const stored = a.stored?.[slot];
    if (override) mapping[slot] = override;
    else if (stored && a.columns.includes(stored)) {
      mapping[slot] = stored;
      notes.push(`Using column "${stored}" for ${slot}, as the original map did`);
    } else if (def.required) {
      const was = stored ? `the original map used "${stored}"; ` : '';
      throw new Error(`Map the ${slot} slot to a column: --map ${slot}=<column> (${was}your data has: ${a.columns.join(', ')})`);
    }
  }
  for (const slot of Object.keys(a.overrides)) if (!a.slots[slot]) mapping[slot] = a.overrides[slot]!; // render names the unknown slot
  return { mapping, notes };
}
