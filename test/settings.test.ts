import { settingsRpc } from "@getpaseo/plugin";
import type { PluginCommandCapabilities } from "@getpaseo/plugin/client";
import { describe, expect, it } from "vite-plus/test";
import { readSettings } from "../client/read-settings";
import {
  DEFAULT_SETTINGS,
  microphoneSettings,
  parseAvoidLabels,
  SETTINGS_ID,
} from "../shared/settings";

type Rpc = PluginCommandCapabilities["rpc"];

function fakeRpc(result: () => Promise<unknown>): Rpc {
  return ((contract: { name: string }) => {
    expect(contract.name).toBe(settingsRpc(SETTINGS_ID).read.name);
    return result();
  }) as unknown as Rpc;
}

describe("settings", () => {
  it("defaults to the system default with nothing avoided", () => {
    expect(DEFAULT_SETTINGS).toEqual({ preferredLabel: null, avoidLabels: [] });
    expect(microphoneSettings).toMatchObject({ id: SETTINGS_ID, scope: "host", version: 1 });
  });

  it("parses comma-separated fragments", () => {
    expect(parseAvoidLabels(" AirPods, , Bluetooth ,AirPods")).toEqual(["AirPods", "Bluetooth"]);
    expect(parseAvoidLabels("")).toEqual([]);
  });
});

describe("readSettings", () => {
  it("returns the stored values with defaults filled in", async () => {
    const rpc = fakeRpc(async () => ({
      status: "ready",
      revision: "1",
      values: { preferredLabel: "USB" },
    }));
    await expect(readSettings(rpc)).resolves.toEqual({ preferredLabel: "USB", avoidLabels: [] });
  });

  it("returns null for invalid settings, failed reads, and slow reads", async () => {
    const invalid = fakeRpc(async () => ({ status: "invalid", revision: "1", error: "bad" }));
    const malformed = fakeRpc(async () => ({
      status: "ready",
      revision: "1",
      values: { avoidLabels: "AirPods" },
    }));
    const failed = fakeRpc(() => Promise.reject(new Error("disconnected")));
    const slow = fakeRpc(() => new Promise(() => undefined));
    await expect(readSettings(invalid)).resolves.toBeNull();
    await expect(readSettings(malformed)).resolves.toBeNull();
    await expect(readSettings(failed)).resolves.toBeNull();
    await expect(readSettings(slow, 5)).resolves.toBeNull();
  });
});
