import {
  needsDevice,
  withAudioDevice,
  type DeviceInfo,
  type StreamConstraints,
} from "./microphone";

/** The parts of `MediaDevices` that the plugin uses. */
export interface MediaDevicesLike {
  getUserMedia(constraints?: StreamConstraints): Promise<unknown>;
  enumerateDevices(): Promise<DeviceInfo[]>;
  addEventListener(type: "devicechange", listener: () => void): void;
  removeEventListener(type: "devicechange", listener: () => void): void;
}

// This plugin typechecks without the DOM library. Declare only what this module uses.
declare const navigator: { mediaDevices?: Partial<MediaDevicesLike> } | undefined;

/** The window's `navigator.mediaDevices`, or undefined where there is none, as in the phone app. */
export function browserMediaDevices(): MediaDevicesLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  const media = navigator.mediaDevices;
  if (typeof media?.getUserMedia !== "function") return undefined;
  if (typeof media.enumerateDevices !== "function") return undefined;
  return media as MediaDevicesLike;
}

/** Maximum wait for the device list before dictation uses the original request. */
export const DEVICES_TIMEOUT_MS = 1_000;

/** Returns null if device enumeration fails or does not finish within the limit. */
export async function readDevices(
  media: MediaDevicesLike,
  timeoutMs = DEVICES_TIMEOUT_MS,
): Promise<DeviceInfo[] | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return await Promise.race([media.enumerateDevices(), timeout]);
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

type GetUserMedia = MediaDevicesLike["getUserMedia"];

/** Marks this plugin's wrapper and keeps the function that it replaced. */
const WRAPPED = Symbol.for("paseo-preferred-microphone.getUserMedia");

interface Wrapper extends GetUserMedia {
  [WRAPPED]?: { original: GetUserMedia; own: boolean };
}

/** Errors after which a request for the chosen device is sent again as the caller made it. */
const RETRY_ERRORS: ReadonlySet<unknown> = new Set([
  "NotFoundError",
  "NotReadableError",
  "OverconstrainedError",
]);

function errorName(error: unknown): unknown {
  return typeof error === "object" && error !== null && "name" in error ? error.name : undefined;
}

/**
 * Replaces `media.getUserMedia` with a function that asks `chooseDeviceId` for a device
 * and adds it to requests for audio that name no device.
 * When it returns null or fails, the request goes through unchanged.
 * Installing again replaces an earlier wrapper instead of wrapping it.
 * The returned function restores the original.
 */
export function wrapGetUserMedia(
  media: MediaDevicesLike,
  chooseDeviceId: () => Promise<string | null>,
): () => void {
  const current = media.getUserMedia as Wrapper;
  const { original, own } = current[WRAPPED] ?? {
    original: current,
    own: Object.hasOwn(media, "getUserMedia"),
  };
  let active = true;

  const wrapper: Wrapper = async (constraints) => {
    if (!active || !needsDevice(constraints)) return original.call(media, constraints);
    const deviceId = await chooseDeviceId().catch(() => null);
    if (!active || deviceId === null) return original.call(media, constraints);
    try {
      return await original.call(media, withAudioDevice(constraints, deviceId));
    } catch (error) {
      if (!RETRY_ERRORS.has(errorName(error))) throw error;
      return original.call(media, constraints);
    }
  };
  wrapper[WRAPPED] = { original, own };
  media.getUserMedia = wrapper;

  return () => {
    active = false;
    if (media.getUserMedia !== wrapper) return;
    if (own) media.getUserMedia = original;
    else Reflect.deleteProperty(media, "getUserMedia");
  };
}

/**
 * Calls `onChange` with the device list now and after each `devicechange` event,
 * ignoring lists that arrive after a newer one.
 * The returned function stops watching.
 */
export function watchDevices(
  media: MediaDevicesLike,
  onChange: (devices: DeviceInfo[]) => void,
  onError: (error: unknown) => void,
): () => void {
  let latest = 0;
  let stopped = false;
  const refresh = () => {
    const request = ++latest;
    media.enumerateDevices().then(
      (devices) => {
        if (!stopped && request === latest) onChange(devices);
      },
      (error: unknown) => {
        if (!stopped && request === latest) onError(error);
      },
    );
  };
  media.addEventListener("devicechange", refresh);
  refresh();
  return () => {
    stopped = true;
    media.removeEventListener("devicechange", refresh);
  };
}
