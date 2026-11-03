import type { MicrophoneSettings } from "../shared/settings";

/** The fields of a `MediaDeviceInfo` that the plugin reads. */
export interface DeviceInfo {
  deviceId: string;
  groupId: string;
  kind: string;
  label: string;
}

/** The fields of `MediaStreamConstraints` that the plugin reads. */
export interface StreamConstraints {
  audio?: boolean | Record<string, unknown>;
  video?: unknown;
  [key: string]: unknown;
}

/**
 * Chromium lists these entries next to the real inputs;
 * each repeats the device that the system uses for that role.
 */
const ROLE_DEVICE_IDS = new Set(["default", "communications"]);
const DEFAULT_LABEL_PREFIX = "Default - ";

/** The real audio inputs, in the browser's order, without Chromium's role entries. */
export function audioInputs(devices: readonly DeviceInfo[]): DeviceInfo[] {
  return devices.filter(
    (device) => device.kind === "audioinput" && !ROLE_DEVICE_IDS.has(device.deviceId),
  );
}

/**
 * The input that the system uses by default: the one that Chromium's "default" entry repeats,
 * or the first input in browsers that list the default first and have no such entry.
 */
export function systemDefault(devices: readonly DeviceInfo[]): DeviceInfo | null {
  const inputs = audioInputs(devices);
  const entry = devices.find(
    (device) => device.kind === "audioinput" && device.deviceId === "default",
  );
  if (entry) {
    const label = entry.label.startsWith(DEFAULT_LABEL_PREFIX)
      ? entry.label.slice(DEFAULT_LABEL_PREFIX.length)
      : entry.label;
    const match =
      inputs.find((input) => input.label === label) ??
      inputs.find((input) => entry.groupId !== "" && input.groupId === entry.groupId);
    if (match) return match;
  }
  return inputs[0] ?? null;
}

/** Whether an input's label contains one of the fragments, ignoring case. */
export function isAvoided(input: DeviceInfo, fragments: readonly string[]): boolean {
  const label = input.label.toLowerCase();
  return fragments.some((fragment) => fragment !== "" && label.includes(fragment.toLowerCase()));
}

/** The expected microphone selection, and why; recording can still fall back. */
export type Choice =
  | { kind: "preferred"; input: DeviceInfo }
  | { kind: "replacement"; input: DeviceInfo; avoided: DeviceInfo }
  | { kind: "default"; input: DeviceInfo | null; missingLabel: string | null };

/**
 * Chooses the microphone for dictation:
 * the preferred one when it is connected; the first other input when the system default
 * is on the avoid list; otherwise the system default, with the request left unchanged.
 * The preferred microphone wins even when it is on the avoid list.
 */
export function chooseInput(devices: readonly DeviceInfo[], settings: MicrophoneSettings): Choice {
  const inputs = audioInputs(devices);
  const { preferredLabel, avoidLabels } = settings;
  const preferred =
    preferredLabel === null ? undefined : inputs.find((input) => input.label === preferredLabel);
  if (preferred) return { kind: "preferred", input: preferred };

  const fallback = systemDefault(devices);
  if (fallback && isAvoided(fallback, avoidLabels)) {
    const replacement = inputs.find((input) => !isAvoided(input, avoidLabels));
    if (replacement) return { kind: "replacement", input: replacement, avoided: fallback };
  }
  return { kind: "default", input: fallback, missingLabel: preferredLabel };
}

/** The device ID to request for a choice, or null to leave the request unchanged. */
export function requestedDeviceId(choice: Choice): string | null {
  return choice.kind === "default" ? null : choice.input.deviceId;
}

/** Explains a choice in one sentence. */
export function describeChoice(choice: Choice): string {
  switch (choice.kind) {
    case "preferred":
      return "Your preferred microphone.";
    case "replacement":
      return `The system default, ${choice.avoided.label}, is on the never-use list.`;
    case "default":
      if (!choice.input) return "No microphone is connected.";
      if (choice.missingLabel !== null) {
        return `${choice.missingLabel} is not connected, so the expected input is the system default.`;
      }
      return "The system default. It can change when a headset connects.";
  }
}

/** Whether a request asks for audio without naming a device. */
export function needsDevice(constraints: StreamConstraints | undefined): boolean {
  const audio = constraints?.audio;
  if (audio === true) return true;
  return typeof audio === "object" && audio !== null && audio.deviceId === undefined;
}

/**
 * The request with its audio limited to one device, keeping every other constraint.
 * Requests without audio, and requests that already name a device, come back unchanged.
 */
export function withAudioDevice(
  constraints: StreamConstraints | undefined,
  deviceId: string,
): StreamConstraints | undefined {
  if (!constraints || !needsDevice(constraints)) return constraints;
  const audio = constraints.audio === true ? {} : constraints.audio;
  return { ...constraints, audio: { ...audio, deviceId: { exact: deviceId } } };
}
