import type { PluginTheme } from "@getpaseo/plugin";
import { useSettings, type PluginSurfaceProps, type SettingsState } from "@getpaseo/plugin/client";
import {
  SettingsAction,
  SettingsCard,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
} from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useState } from "react";
import { Text } from "react-native";
import { microphoneSettings, parseAvoidLabels, type MicrophoneSettings } from "../shared/settings";
import {
  audioInputs,
  chooseInput,
  describeChoice,
  isAvoided,
  systemDefault,
  type Choice,
  type DeviceInfo,
} from "./microphone";
import { browserMediaDevices, watchDevices } from "./web";

type ReadySettings = Extract<SettingsState<typeof microphoneSettings.schema>, { status: "ready" }>;

/** The select value for "Automatic"; a microphone without a label cannot be chosen. */
const AUTOMATIC = "";

interface DeviceState {
  devices: DeviceInfo[];
  error: string | null;
}

/** The window's devices, updated when one connects or disconnects. */
function useDevices(): DeviceState {
  const [state, setState] = useState<DeviceState>({ devices: [], error: null });
  useEffect(() => {
    const media = browserMediaDevices();
    if (!media) {
      setState({ devices: [], error: "This Paseo app cannot list microphones." });
      return undefined;
    }
    return watchDevices(
      media,
      (devices) => setState({ devices, error: null }),
      (error) => setState((previous) => ({ ...previous, error: String(error) })),
    );
  }, []);
  return state;
}

export function MicrophoneSettingsScreen({ theme }: PluginSurfaceProps) {
  const settings = useSettings(microphoneSettings);
  const textStyle = useMemo(() => ({ color: theme.colors.foreground }), [theme]);
  if (settings.status === "loading") return <Text style={textStyle}>Loading settings…</Text>;
  if (settings.status !== "ready") {
    return (
      <SettingsSection title="Microphone">
        <Text style={textStyle}>{settings.error}</Text>
        <SettingsAction label="Try again" actionLabel="Reload" onPress={settings.reload} />
        {settings.status === "invalid" ? (
          <SettingsAction
            label="Restore the default settings"
            actionLabel="Reset"
            onPress={settings.reset}
          />
        ) : null}
      </SettingsSection>
    );
  }
  return <ReadyScreen settings={settings} theme={theme} />;
}

function ReadyScreen({ settings, theme }: { settings: ReadySettings; theme: PluginTheme }) {
  const { devices, error } = useDevices();
  const values = settings.values;
  // Unsaved never-use text; a newer revision, saved here or elsewhere, replaces it.
  const [draft, setDraft] = useState<{ revision: string; text: string } | null>(null);
  const avoidText =
    draft?.revision === settings.revision ? draft.text : values.avoidLabels.join(", ");
  const errorStyle = useMemo(() => ({ color: theme.colors.statusDanger }), [theme]);

  const inputs = audioInputs(devices);
  const named = inputs.filter((input) => input.label !== "");
  const fallback = systemDefault(devices);
  const choice = chooseInput(devices, values);

  const save = (next: MicrophoneSettings) => void settings.save(next, settings.revision);
  const avoidLabels = parseAvoidLabels(avoidText);
  const avoidChanged = avoidLabels.join("\n") !== values.avoidLabels.join("\n");

  const labels = [...new Set(named.map((input) => input.label))];
  const options = [
    { value: AUTOMATIC, label: "Automatic (system default)" },
    ...labels.map((label) => ({ value: label, label })),
  ];
  if (values.preferredLabel !== null && !labels.includes(values.preferredLabel)) {
    options.push({
      value: values.preferredLabel,
      label: `${values.preferredLabel} (not connected)`,
    });
  }

  return (
    <>
      <SettingsSection title="Dictation">
        <SettingsCard>
          <SettingsRow
            label={`Expected input: ${choice.input?.label || "the system default"}`}
            hint={error ?? describeChoice(choice)}
          />
          <SettingsRow
            label="Actual recording input may differ"
            hint="This screen shows the expected selection, not the active recording device. If selection fails or the chosen input cannot record, dictation can fall back to the system default."
          />
          <SettingsSelect
            label="Preferred microphone"
            hint="Choose the microphone to use when connected. Otherwise, the never-use list can select another input; if no replacement is available, dictation uses the system default."
            value={values.preferredLabel ?? AUTOMATIC}
            options={options}
            disabled={settings.saving}
            onValueChange={(value) =>
              save({ ...values, preferredLabel: value === AUTOMATIC ? null : value })
            }
          />
        </SettingsCard>
        <SettingsCard>
          <SettingsInput
            key={settings.revision}
            label="Never use"
            hint="Name fragments to avoid, separated by commas, ignoring case. A connected preferred microphone takes priority. Otherwise, an avoided default is replaced by the first unlisted input. If every input is avoided or the default matches no fragment, dictation uses the system default."
            initialValue={values.avoidLabels.join(", ")}
            placeholder="AirPods"
            disabled={settings.saving}
            onChangeText={(text) => setDraft({ revision: settings.revision, text })}
          />
          <SettingsAction
            label="Never-use list"
            actionLabel="Save"
            disabled={settings.saving || !avoidChanged}
            onPress={() => save({ ...values, avoidLabels })}
          />
        </SettingsCard>
        {settings.saveError ? (
          <Text accessibilityRole="alert" style={errorStyle}>
            {settings.saveError}
          </Text>
        ) : null}
      </SettingsSection>
      <SettingsSection title="Connected microphones">
        <SettingsCard>
          {inputs.length === 0 ? <SettingsRow label="No microphones found" /> : null}
          {inputs.map((input) => (
            <SettingsRow
              key={input.deviceId}
              label={input.label || "Unnamed microphone"}
              hint={deviceHint(input, fallback, choice, values) || undefined}
            />
          ))}
          {inputs.length > named.length ? (
            <SettingsRow
              label="Some names are hidden"
              hint="Names appear after Paseo has permission to use the microphone. Start dictation once, then come back."
            />
          ) : null}
        </SettingsCard>
      </SettingsSection>
    </>
  );
}

function deviceHint(
  input: DeviceInfo,
  fallback: DeviceInfo | null,
  choice: Choice,
  values: MicrophoneSettings,
): string {
  const notes = [
    input === choice.input && "Expected dictation input",
    input === fallback && "System default",
    isAvoided(input, values.avoidLabels) && "On the never-use list",
  ];
  return notes.filter(Boolean).join(" · ");
}
