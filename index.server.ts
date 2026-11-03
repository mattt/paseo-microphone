import type { PluginServerContext } from "@getpaseo/plugin/server";
import { microphoneSettings } from "./shared/settings";

/** Stores the settings on the daemon; each window chooses its microphone itself. */
export default function contribute(server: PluginServerContext) {
  server.registerSettings(microphoneSettings);
  return () => {};
}
