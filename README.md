# paseo-microphone

A [Paseo](https://paseo.sh) plugin that keeps dictation on the microphone you choose.

Paseo records from your Mac's default input,
and macOS makes AirPods the default input whenever they connect.
So if you dictate with AirPods on,
Paseo records through their microphone —
and your playback sounds worse while it does.
This plugin points Paseo at the microphone you actually want.

## Install

You'll need Paseo 0.14.0 or later with the desktop app.
Turn on **Settings > Plugins > Enable plugins**, then run:

```sh
paseo plugin add git:mattt/paseo-microphone
```

Then open the plugin's **Microphone** screen from **Settings > Plugins**.
If microphone names are hidden,
start dictation once to grant Paseo microphone permission,
then come back.

## Settings

- **Preferred microphone:** The microphone to use whenever it's connected.
  "Automatic (system default)" uses the default, minus the never-use list.
  The plugin remembers the device by name, because browser device IDs can change.
- **Never use:** Comma-separated name fragments, such as `AirPods`.
  Matching ignores case.
  When your preferred microphone isn't connected
  and the default is on this list,
  the plugin uses the first connected microphone that isn't.
  A connected preferred microphone always wins, even if it's on the list.

If nothing else is connected, dictation falls back to the system default,
so the never-use list can't promise that a microphone stays unused.

The screen lists connected microphones and marks the one the plugin expects to use.
That's the expected choice, not the active device; a fallback can change what records.
Settings apply to every window connected to the same Paseo daemon.

## How it works

Paseo doesn't have an input-device setting (yet),
so the plugin wraps `navigator.mediaDevices.getUserMedia` in the desktop window.
For an audio request that doesn't name a device,
it picks a microphone from your settings
and adds `deviceId: { exact: <id> }`, keeping the other constraints.
Requests that already name a device, or ask only for video, pass through untouched.

If reading settings or listing devices fails or takes more than a second,
the request goes through unchanged.
If the chosen device is missing or can't meet the constraints,
the plugin retries the original request.
Unloading the plugin restores the original function.

A Paseo update could bypass this, and the plugin does nothing in the phone app.

## Development

Use [mise](https://mise.jdx.dev/) for Node.js and tasks:

```sh
mise run install
mise run check
paseo plugin install "$PWD"
paseo plugin reload preferred-microphone
```

Reload after you change the source.
To uninstall, run `paseo plugin remove preferred-microphone`.

## License

MIT. See [LICENSE.md](LICENSE.md).
