import { describe, expect, it } from "vite-plus/test";
import {
  audioInputs,
  chooseInput,
  describeChoice,
  needsDevice,
  requestedDeviceId,
  systemDefault,
  withAudioDevice,
  type DeviceInfo,
} from "../client/microphone";
import { AIRPODS, airpodsAsDefault, BUILT_IN, builtInOnly, settings, USB } from "./fixtures";

const PASEO_AUDIO = {
  channelCount: 1,
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
};

describe("withAudioDevice", () => {
  it("adds the device to Paseo's dictation request and keeps its other constraints", () => {
    const request = { audio: PASEO_AUDIO };
    expect(withAudioDevice(request, "usb")).toEqual({
      audio: { ...PASEO_AUDIO, deviceId: { exact: "usb" } },
    });
    expect(request).toEqual({ audio: PASEO_AUDIO });
  });

  it("turns audio: true into an object", () => {
    expect(withAudioDevice({ audio: true }, "usb")).toEqual({
      audio: { deviceId: { exact: "usb" } },
    });
  });

  it("keeps video constraints in a request for audio and video", () => {
    const video = { width: 1280 };
    expect(withAudioDevice({ audio: true, video }, "usb")).toEqual({
      audio: { deviceId: { exact: "usb" } },
      video,
    });
  });

  it("leaves requests without audio unchanged", () => {
    for (const request of [{ video: true }, { audio: false, video: true }, {}, undefined]) {
      expect(withAudioDevice(request, "usb")).toBe(request);
      expect(needsDevice(request)).toBe(false);
    }
  });

  it("leaves a request that already names a device unchanged", () => {
    const request = { audio: { deviceId: "built-in" } };
    expect(withAudioDevice(request, "usb")).toBe(request);
    expect(needsDevice({ audio: { deviceId: { exact: "built-in" } } })).toBe(false);
  });
});

describe("audioInputs and systemDefault", () => {
  it("lists the real inputs without Chromium's role entries or other kinds", () => {
    const devices = [
      ...airpodsAsDefault(),
      { deviceId: "communications", groupId: "", kind: "audioinput", label: "Communications" },
    ];
    expect(audioInputs(devices).map((input) => input.deviceId)).toEqual([
      "built-in",
      "airpods",
      "usb",
    ]);
  });

  it("finds the default by the label of Chromium's default entry", () => {
    expect(systemDefault(airpodsAsDefault())?.deviceId).toBe("airpods");
  });

  it("finds the default by group when the label does not match", () => {
    const devices = airpodsAsDefault().map((device) =>
      device.deviceId === "default" ? { ...device, label: "Default" } : device,
    );
    expect(systemDefault(devices)?.deviceId).toBe("airpods");
  });

  it("uses the first input in browsers without a default entry", () => {
    const devices = airpodsAsDefault().filter((device) => device.deviceId !== "default");
    expect(systemDefault(devices)?.deviceId).toBe("built-in");
  });

  it("finds no default without inputs", () => {
    expect(systemDefault([])).toBeNull();
  });
});

describe("chooseInput", () => {
  it("uses the system default when no microphone is preferred", () => {
    const choice = chooseInput(airpodsAsDefault(), settings());
    expect(choice).toMatchObject({
      kind: "default",
      input: { label: AIRPODS },
      missingLabel: null,
    });
    expect(requestedDeviceId(choice)).toBeNull();
    expect(describeChoice(choice)).toBe(
      "The system default. It can change when a headset connects.",
    );
  });

  it("matches the preferred microphone by its label", () => {
    const choice = chooseInput(airpodsAsDefault(), settings({ preferredLabel: BUILT_IN }));
    expect(choice).toMatchObject({ kind: "preferred", input: { deviceId: "built-in" } });
    expect(requestedDeviceId(choice)).toBe("built-in");
    expect(describeChoice(choice)).toBe("Your preferred microphone.");
  });

  it("matches labels exactly, so a new deviceId for the same label still matches", () => {
    const devices = airpodsAsDefault().map((device) =>
      device.label === USB ? { ...device, deviceId: "usb-after-restart" } : device,
    );
    expect(requestedDeviceId(chooseInput(devices, settings({ preferredLabel: USB })))).toBe(
      "usb-after-restart",
    );
    expect(
      requestedDeviceId(
        chooseInput(devices, settings({ preferredLabel: "shure mv7 (14ed:1012)" })),
      ),
    ).toBeNull();
  });

  it("does not match the default entry's label", () => {
    const choice = chooseInput(
      airpodsAsDefault(),
      settings({ preferredLabel: `Default - ${AIRPODS}` }),
    );
    expect(choice.kind).toBe("default");
  });

  it("falls back to the system default when the preferred microphone is missing", () => {
    const choice = chooseInput(builtInOnly(), settings({ preferredLabel: USB }));
    expect(choice).toMatchObject({
      kind: "default",
      input: { label: BUILT_IN },
      missingLabel: USB,
    });
    expect(requestedDeviceId(choice)).toBeNull();
    expect(describeChoice(choice)).toBe(
      `${USB} is not connected, so the expected input is the system default.`,
    );
  });

  it("replaces an avoided default with the first other input, ignoring case", () => {
    const choice = chooseInput(airpodsAsDefault(), settings({ avoidLabels: ["airpods"] }));
    expect(choice).toMatchObject({
      kind: "replacement",
      input: { label: BUILT_IN },
      avoided: { label: AIRPODS },
    });
    expect(requestedDeviceId(choice)).toBe("built-in");
    expect(describeChoice(choice)).toBe(
      `The system default, ${AIRPODS}, is on the never-use list.`,
    );
  });

  it("replaces an avoided default when the preferred microphone is missing", () => {
    const devices = airpodsAsDefault().filter((device) => device.label !== USB);
    const choice = chooseInput(
      devices,
      settings({ preferredLabel: USB, avoidLabels: ["AirPods"] }),
    );
    expect(choice).toMatchObject({ kind: "replacement", input: { label: BUILT_IN } });
  });

  it("skips other avoided inputs when it chooses a replacement", () => {
    const choice = chooseInput(
      airpodsAsDefault(),
      settings({ avoidLabels: ["AirPods", "Built-in"] }),
    );
    expect(choice).toMatchObject({ kind: "replacement", input: { label: USB } });
  });

  it("keeps the default when every input is avoided", () => {
    const choice = chooseInput(airpodsAsDefault(), settings({ avoidLabels: ["(", "airpods"] }));
    expect(choice).toMatchObject({ kind: "default", input: { label: AIRPODS } });
  });

  it("keeps a default that is not avoided", () => {
    const choice = chooseInput(builtInOnly(), settings({ avoidLabels: ["AirPods"] }));
    expect(choice).toMatchObject({ kind: "default", input: { label: BUILT_IN } });
  });

  it("uses the preferred microphone even when it is on the avoid list", () => {
    const choice = chooseInput(
      airpodsAsDefault(),
      settings({ preferredLabel: AIRPODS, avoidLabels: ["AirPods"] }),
    );
    expect(choice).toMatchObject({ kind: "preferred", input: { label: AIRPODS } });
  });

  it("ignores empty fragments", () => {
    const choice = chooseInput(builtInOnly(), settings({ avoidLabels: [""] }));
    expect(choice.kind).toBe("default");
  });

  it("chooses nothing without inputs", () => {
    const choice = chooseInput([] as DeviceInfo[], settings({ preferredLabel: USB }));
    expect(choice).toEqual({ kind: "default", input: null, missingLabel: USB });
    expect(describeChoice(choice)).toBe("No microphone is connected.");
  });
});
