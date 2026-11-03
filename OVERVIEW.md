Preferred Microphone makes Paseo desktop dictation use your chosen microphone.
Connecting AirPods on macOS changes the system default input used by dictation.
The plugin wraps the browser's microphone function; Paseo updates can bypass it.

Requires Paseo 0.14.0 or later and microphone permission.
In the plugin's Microphone settings, choose a preferred microphone
and save comma-separated name fragments under Never use, such as AirPods.
Matching ignores case.
The preferred microphone takes priority;
otherwise, an avoided default is replaced by the first unlisted input.
Without a replacement, dictation uses the default.

The screen shows connected microphones and the expected input,
which can differ from the recording device after a fallback.
Device lists stay in the window; settings store names on the daemon
and are shared across its windows.
The phone app is unaffected.
