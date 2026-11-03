import type { PluginClientContext } from "@getpaseo/plugin/client";
import { Platform } from "react-native";
import { chooseInput, requestedDeviceId } from "./client/microphone";
import { readSettings } from "./client/read-settings";
import { MicrophoneSettingsScreen } from "./client/settings-screen";
import { browserMediaDevices, readDevices, wrapGetUserMedia } from "./client/web";

export default function contribute(client: PluginClientContext) {
  // Only a browser window, such as the desktop app's, opens the microphone with getUserMedia.
  const media = Platform.OS === "web" ? browserMediaDevices() : undefined;
  if (!media) return () => {};

  const restore = wrapGetUserMedia(media, async () => {
    const settings = await readSettings(client.rpc);
    if (!settings) return null;
    const devices = await readDevices(media);
    return devices === null ? null : requestedDeviceId(chooseInput(devices, settings));
  });
  const removeScreen = client.addSettingsScreen({
    id: "microphone",
    title: "Microphone",
    icon: "Mic",
    Component: MicrophoneSettingsScreen,
  });

  return () => {
    restore();
    void removeScreen();
  };
}
