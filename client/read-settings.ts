import { settingsRpc } from "@getpaseo/plugin";
import type { PluginCommandCapabilities } from "@getpaseo/plugin/client";
import { SETTINGS_ID, SettingsSchema, type MicrophoneSettings } from "../shared/settings";

/** How long dictation waits for the settings before it uses the system default. */
export const SETTINGS_TIMEOUT_MS = 1_000;

const readRpc = settingsRpc(SETTINGS_ID).read;

/**
 * Reads the stored settings from the daemon.
 * Resolves to null when the read fails, takes too long, or finds invalid settings.
 */
export async function readSettings(
  rpc: PluginCommandCapabilities["rpc"],
  timeoutMs = SETTINGS_TIMEOUT_MS,
): Promise<MicrophoneSettings | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const result = await Promise.race([rpc(readRpc, {}), timeout]);
    if (result?.status !== "ready") return null;
    const parsed = SettingsSchema.safeParse(result.values);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
