# Troubleshooting

## The extension does not appear in the Extensions app
- You must log out and back in after copying it.
- The folder name must be exactly `gnome_uninstall_app@local`, directly inside `~/.local/share/gnome-shell/extensions/`
  (not a folder inside a folder).

## "Unsupported" / version error
Open `metadata.json` in the extension folder and add your GNOME Shell version to `"shell-version"`
(e.g. `"52"`). Log out and in.

## No Uninstall item at all
- Check the extension is switched on in **Extensions**.
- Press `Alt+F2`, type `lg`, Enter → **Extensions** tab shows load errors.
- Open an issue with your GNOME Shell version and the error text.

## Grey "Uninstall (unavailable)"
The app comes from a source the extension cannot remove safely. Click it: the dialog shows the desktop file,
its `Exec` line and why detection failed. Common reasons:

| Message | Meaning |
|---|---|
| owner is protected | System-critical package (shell, display manager, package manager...) |
| file not owned | Desktop file is not from a package (manual install, custom shortcut) |
| Exec has no steam://rungameid | Not a standard Steam shortcut |
| AppImage: file not found / not in home | AppImage was moved or is outside your home folder |

## Removal fails with an error
- **Dependency error**: other packages need this one. The tools used (`pacman -R`, `dpkg --remove`, `rpm -e`) refuse to break them. Nothing was changed.
- **Authentication cancelled**: you closed the password prompt.
- **Database locked**: another package manager (Software, updater, terminal) is running. Close it and retry.

## Steam game does nothing
Steam shows its own uninstall window. If Steam was closed it must start first; wait for it, or open Steam and try again.

## Flatpak user data
Flatpak removal keeps the app's data in `~/.var/app/`. Delete that folder manually if you want it gone.
