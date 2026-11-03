# Bring your settings

Run **TodoForge: Import Settings (Todo Tree, Rider, Visual Studio)** and pick a source:

- **Todo Tree** – copies the tags, tag groups, include/exclude globs, custom regex and colors you changed. Todo Tree defaults are not copied.
- **JetBrains Rider / ReSharper** – choose a `.DotSettings` file (for example `YourSolution.sln.DotSettings`). TodoForge reads the TODO patterns.
- **Visual Studio** – choose a `.vssettings` export (Tools › Import and Export Settings). TodoForge reads the Task List tokens.
- **Visual Studio / Rider defaults** – adds `HACK`, `UNDONE` or `BUG` to your tags.

You see every value before anything is written. Settings go to your user settings, never into the repository.
