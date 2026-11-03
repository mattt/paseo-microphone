import { describe, expect, it, vi } from "vite-plus/test";
import type { DeviceInfo, StreamConstraints } from "../client/microphone";
import {
  browserMediaDevices,
  readDevices,
  DEVICES_TIMEOUT_MS,
  wrapGetUserMedia,
  watchDevices,
} from "../client/web";
import { airpodsAsDefault, builtInOnly } from "./fixtures";

/** A stand-in for `MediaDevices`, with `getUserMedia` on its prototype as in a browser. */
class FakeMediaDevices {
  requests: (StreamConstraints | undefined)[] = [];
  devices: DeviceInfo[] = airpodsAsDefault();
  failures: Error[] = [];
  listeners = new Set<() => void>();

  async getUserMedia(constraints?: StreamConstraints): Promise<unknown> {
    this.requests.push(constraints);
    const failure = this.failures.shift();
    if (failure) throw failure;
    return { constraints };
  }

  async enumerateDevices(): Promise<DeviceInfo[]> {
    return this.devices;
  }

  addEventListener(_type: "devicechange", listener: () => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "devicechange", listener: () => void): void {
    this.listeners.delete(listener);
  }
}

const PROTOTYPE_METHOD = FakeMediaDevices.prototype.getUserMedia;

function namedError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

describe("wrapGetUserMedia", () => {
  it("adds the chosen device to an audio request", async () => {
    const media = new FakeMediaDevices();
    wrapGetUserMedia(media, async () => "built-in");
    await media.getUserMedia({ audio: { channelCount: 1 } });
    expect(media.requests).toEqual([
      { audio: { channelCount: 1, deviceId: { exact: "built-in" } } },
    ]);
  });

  it("sends the request unchanged when there is no choice or the choice fails", async () => {
    const media = new FakeMediaDevices();
    const chooser = { result: Promise.resolve<string | null>(null) };
    wrapGetUserMedia(media, () => chooser.result);
    await media.getUserMedia({ audio: true });
    chooser.result = Promise.reject(new Error("no settings"));
    await media.getUserMedia({ audio: true });
    expect(media.requests).toEqual([{ audio: true }, { audio: true }]);
  });

  it("does not ask for a device for video-only requests or requests that name one", async () => {
    const media = new FakeMediaDevices();
    let asked = 0;
    wrapGetUserMedia(media, async () => {
      asked += 1;
      return "built-in";
    });
    await media.getUserMedia({ video: true });
    await media.getUserMedia({ audio: { deviceId: "usb" } });
    expect(asked).toBe(0);
    expect(media.requests).toEqual([{ video: true }, { audio: { deviceId: "usb" } }]);
  });

  it("retries unchanged when the chosen device has gone", async () => {
    const media = new FakeMediaDevices();
    media.failures.push(namedError("OverconstrainedError"));
    wrapGetUserMedia(media, async () => "usb");
    await expect(media.getUserMedia({ audio: true })).resolves.toEqual({
      constraints: { audio: true },
    });
    expect(media.requests).toEqual([{ audio: { deviceId: { exact: "usb" } } }, { audio: true }]);
  });

  it("does not retry other errors", async () => {
    const media = new FakeMediaDevices();
    media.failures.push(namedError("NotAllowedError"));
    wrapGetUserMedia(media, async () => "usb");
    await expect(media.getUserMedia({ audio: true })).rejects.toThrow("NotAllowedError");
    expect(media.requests).toHaveLength(1);
  });

  it("calls the original with the media devices as this", async () => {
    const media = new FakeMediaDevices();
    const receivers: unknown[] = [];
    media.getUserMedia = async function (this: unknown) {
      receivers.push(this);
      return {};
    };
    wrapGetUserMedia(media, async () => null);
    await media.getUserMedia({ audio: true });
    expect(receivers).toEqual([media]);
  });

  it("restores the prototype method by removing its own property", () => {
    const media = new FakeMediaDevices();
    const restore = wrapGetUserMedia(media, async () => null);
    expect(Object.hasOwn(media, "getUserMedia")).toBe(true);
    restore();
    expect(Object.hasOwn(media, "getUserMedia")).toBe(false);
    expect(media.getUserMedia).toBe(PROTOTYPE_METHOD);
    restore();
    expect(media.getUserMedia).toBe(PROTOTYPE_METHOD);
  });

  it("restores an own original function", () => {
    const media = new FakeMediaDevices();
    const original = async () => ({});
    media.getUserMedia = original;
    const restore = wrapGetUserMedia(media, async () => null);
    restore();
    expect(media.getUserMedia).toBe(original);
  });

  it("replaces an earlier wrapper instead of wrapping it", async () => {
    const media = new FakeMediaDevices();
    let first = 0;
    const restoreFirst = wrapGetUserMedia(media, async () => {
      first += 1;
      return "usb";
    });
    const restoreSecond = wrapGetUserMedia(media, async () => "built-in");
    await media.getUserMedia({ audio: true });
    expect(first).toBe(0);
    expect(media.requests).toEqual([{ audio: { deviceId: { exact: "built-in" } } }]);

    // The earlier wrapper's cleanup no longer owns the function.
    restoreFirst();
    expect(Object.hasOwn(media, "getUserMedia")).toBe(true);
    restoreSecond();
    expect(Object.hasOwn(media, "getUserMedia")).toBe(false);
    expect(media.getUserMedia).toBe(PROTOTYPE_METHOD);
  });

  it("leaves a pending request unchanged if unloaded before device selection finishes", async () => {
    const media = new FakeMediaDevices();
    let select: (deviceId: string) => void = () => undefined;
    const selection = new Promise<string>((resolve) => {
      select = resolve;
    });
    const restore = wrapGetUserMedia(media, () => selection);
    const request = media.getUserMedia({ audio: true });
    restore();
    select("usb");
    await request;
    expect(media.requests).toEqual([{ audio: true }]);
  });

  it("passes requests through after cleanup when another wrapper sits on top", async () => {
    const media = new FakeMediaDevices();
    const restore = wrapGetUserMedia(media, async () => "usb");
    const ours = media.getUserMedia.bind(media);
    media.getUserMedia = (constraints) => ours(constraints);
    restore();
    await media.getUserMedia({ audio: true });
    expect(media.requests).toEqual([{ audio: true }]);
  });
});

describe("watchDevices", () => {
  it("reports the devices now and after each change, until stopped", async () => {
    const media = new FakeMediaDevices();
    const seen: DeviceInfo[][] = [];
    const stop = watchDevices(
      media,
      (devices) => seen.push(devices),
      () => undefined,
    );
    await Promise.resolve();
    media.devices = builtInOnly();
    for (const listener of media.listeners) listener();
    await Promise.resolve();
    expect(seen).toEqual([airpodsAsDefault(), builtInOnly()]);

    stop();
    expect(media.listeners.size).toBe(0);
  });

  it("ignores a list that arrives after a newer one", async () => {
    const media = new FakeMediaDevices();
    const pending: ((devices: DeviceInfo[]) => void)[] = [];
    media.enumerateDevices = () => new Promise((resolve) => pending.push(resolve));
    const seen: DeviceInfo[][] = [];
    watchDevices(
      media,
      (devices) => seen.push(devices),
      () => undefined,
    );
    for (const listener of media.listeners) listener();
    pending[1]?.(builtInOnly());
    pending[0]?.(airpodsAsDefault());
    await Promise.resolve();
    expect(seen).toEqual([builtInOnly()]);
  });
});

describe("browserMediaDevices", () => {
  it("finds nothing outside a browser", () => {
    // Node has a navigator but no mediaDevices, like the phone app.
    expect(browserMediaDevices()).toBeUndefined();
  });
});

describe("readDevices", () => {
  it("returns the list and clears the timer on success or failure", async () => {
    vi.useFakeTimers();
    try {
      const media = new FakeMediaDevices();
      await expect(readDevices(media)).resolves.toEqual(airpodsAsDefault());
      expect(vi.getTimerCount()).toBe(0);
      media.enumerateDevices = async () => {
        throw new Error("unavailable");
      };
      await expect(readDevices(media)).resolves.toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends the original request after enumeration times out and ignores a late list", async () => {
    vi.useFakeTimers();
    try {
      const media = new FakeMediaDevices();
      let finish: (devices: DeviceInfo[]) => void = () => undefined;
      media.enumerateDevices = () =>
        new Promise((resolve) => {
          finish = resolve;
        });
      wrapGetUserMedia(media, async () => {
        const devices = await readDevices(media);
        return devices === null ? null : "usb";
      });
      const constraints = { audio: { echoCancellation: true }, video: true };
      const request = media.getUserMedia(constraints);
      await vi.advanceTimersByTimeAsync(DEVICES_TIMEOUT_MS - 1);
      expect(media.requests).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
      await request;
      expect(media.requests).toEqual([constraints]);
      expect(media.requests[0]).toBe(constraints);
      finish(airpodsAsDefault());
      await Promise.resolve();
      expect(media.requests).toHaveLength(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
