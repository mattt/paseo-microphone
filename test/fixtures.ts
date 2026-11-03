import type { DeviceInfo } from "../client/microphone";
import { DEFAULT_SETTINGS, type MicrophoneSettings } from "../shared/settings";

export const BUILT_IN = "MacBook Pro Microphone (Built-in)";
export const AIRPODS = "AirPods Max (Bluetooth)";
export const USB = "Shure MV7 (14ed:1012)";

function input(deviceId: string, label: string, groupId = `group-${deviceId}`): DeviceInfo {
  return { deviceId, groupId, kind: "audioinput", label };
}

/** Devices as Chromium lists them on a Mac after AirPods became the default input. */
export function airpodsAsDefault(): DeviceInfo[] {
  return [
    input("default", `Default - ${AIRPODS}`, "group-airpods"),
    input("built-in", BUILT_IN),
    input("airpods", AIRPODS),
    input("usb", USB),
    { deviceId: "speakers", groupId: "group-built-in", kind: "audiooutput", label: "Speakers" },
    { deviceId: "camera", groupId: "group-camera", kind: "videoinput", label: "FaceTime HD" },
  ];
}

/** Devices with only the built-in microphone, which is the default. */
export function builtInOnly(): DeviceInfo[] {
  return [input("default", `Default - ${BUILT_IN}`, "group-built-in"), input("built-in", BUILT_IN)];
}

export function settings(values: Partial<MicrophoneSettings> = {}): MicrophoneSettings {
  return { ...DEFAULT_SETTINGS, ...values };
}
