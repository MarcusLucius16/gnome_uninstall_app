# Contributing

Bug reports, distro test results and pull requests are welcome.

## Reporting a bug
Please include:
- Distro and GNOME Shell version (Settings → System → About)
- The app you tried to remove and where it came from (package manager, Flatpak, Steam, ...)
- The text shown when you click the grey "Uninstall (unavailable)" item, if it appears
- Any error notification text

## Adding support for a new source
All detection and removal logic lives in `gnome_uninstall_app@local/backends.js`:
1. Add a detection step in `detectUncached()` (return a target object such as `{type, name}`).
2. Add a label in `describeTarget()` and a removal command in `uninstallTarget()`.

Rules every backend must follow:
- Remove **only** the selected application. Never remove extra dependencies, never delete user data.
- Prefer tools that refuse to break dependencies (`pacman -R`, `dpkg --remove`, `rpm -e`).
- Validate names with `NAME_RE` before passing them to a command.

## Testing
Copy the extension folder to `~/.local/share/gnome-shell/extensions/`, log out and in, and try it on a harmless app first.
