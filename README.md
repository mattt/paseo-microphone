# paseo-microphone

Preferred Microphone makes Paseo's dictation use a microphone you choose.
Paseo records from the system default input;
on a Mac, connecting AirPods makes them the default.
This plugin keeps dictation on your preferred microphone.

## Install

Use Paseo 0.14.0 or later with the desktop app.
Turn on **Settings > Plugins > Enable plugins** on the target daemon,
then run:

```sh
paseo plugin add git:mattt/paseo-microphone
```

Paseo compiles the TypeScript; no build step is needed.
Open the plugin's **Microphone** screen from **Settings > Plugins**.
If microphone names are hidden, grant Paseo microphone permission
by starting dictation once, then return to settings.

## Settings

- **Preferred microphone:** Choose the microphone to use when connected.
  "Automatic (system default)" uses the default, subject to the never-use list.
  The plugin stores the name because browser device IDs can change.
- **Never use:** Enter comma-separated name fragments, such as `AirPods`,
  then select **Save**.
  Matching ignores case and includes devices connected later.
  With no preferred microphone connected, an avoided default is replaced
  by the first connected microphone whose name is not on the list.
  A connected preferred microphone takes priority, even if listed here.

If no replacement is available, dictation uses the system default.
The never-use list therefore does not guarantee that a microphone stays unused.
The screen lists connected microphones, marks the default and expected input,
and updates when devices connect or disconnect.
This is the expected selection, not the active recording device;
a fallback can change the input used.
Settings are shared by all windows connected to the same Paseo daemon.
Device lists stay in the app window; saved settings go to the daemon.

## How it works and limits

Paseo has no input-device setting.
The plugin wraps `navigator.mediaDevices.getUserMedia` in the desktop window.
For audio requests without a device, it reads settings, lists microphones,
and adds `deviceId: { exact: <id> }` while keeping other constraints.
It converts `audio: true` to an object.
Video-only requests and requests that specify a device pass through unchanged.

Requests also pass through unchanged if settings fail or take over one second,
or if listing devices fails or takes over one additional second.
If the chosen device is missing, unreadable, or cannot meet the constraints,
the plugin retries the original request, which can use the default.
Unloading restores the original function;
reloading replaces the wrapper without stacking copies.

A Paseo update can bypass this wrapper by changing how it opens microphones.
The plugin does nothing in the phone app.

## Development

Use [mise](https://mise.jdx.dev/) for Node.js and tasks.
Vite+ checks formatting and lint and runs tests.

```sh
mise run install
mise run check
paseo plugin install "$PWD"
paseo plugin reload preferred-microphone
```

Run the local install from the repository root; reload after source changes.
`client/web.ts` handles browser globals;
`client/microphone.ts` selects inputs and rewrites constraints.
Tests use a stand-in for `MediaDevices`.
To remove either installation, run `paseo plugin remove preferred-microphone`;
the local source directory is kept.

## License

MIT. See [LICENSE.md](LICENSE.md).
