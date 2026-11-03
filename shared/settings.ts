import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const SETTINGS_ID = "microphone";

/**
 * The microphone settings, shared by every client of the daemon.
 * Microphones are stored by label, because a device's `deviceId` can change.
 */
export const SettingsSchema = z.object({
  /** The label of the microphone that dictation uses, or null for the system default. */
  preferredLabel: z.string().nullable().default(null),
  /**
   * Label fragments, matched without regard to case.
   * When the microphone that dictation would use contains one of them,
   * dictation uses the first other microphone instead.
   */
  avoidLabels: z.array(z.string()).default([]),
});

export type MicrophoneSettings = z.output<typeof SettingsSchema>;

export const microphoneSettings = defineSettings({
  id: SETTINGS_ID,
  scope: "host",
  version: 1,
  schema: SettingsSchema,
});

export const DEFAULT_SETTINGS: MicrophoneSettings = SettingsSchema.parse({});

/** Parses comma-separated label fragments, dropping empty ones and duplicates. */
export function parseAvoidLabels(text: string): string[] {
  const fragments = text.split(",").map((fragment) => fragment.trim());
  return [...new Set(fragments.filter((fragment) => fragment.length > 0))];
}
