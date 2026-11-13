# Installation (no terminal needed)

## Requirements
- GNOME Shell 46 or newer (check: Settings → System → About → "GNOME Version")
- A distro with at least one supported source: pacman, dpkg, rpm, Flatpak, Snap, Steam or AppImage
- `polkit` (installed by default on all major GNOME distros) for system packages and Snap

> Linux Mint: the default desktop (Cinnamon) is **not** GNOME Shell, so this extension only works in a GNOME session.

## Steps

1. Download the latest `gnome_uninstall_app@local.zip` from the **Releases** page of this repository
   (or use **Code → Download ZIP** and take the `gnome_uninstall_app@local` folder from inside it).
2. Open **Files**, right-click the zip → **Extract**. You get a folder named `gnome_uninstall_app@local`.
3. In **Files** press `Ctrl+H` to show hidden folders.
4. Go to: **Home → .local → share → gnome-shell → extensions**
   (create the `gnome-shell` and `extensions` folders if they do not exist).
5. Move the `gnome_uninstall_app@local` folder into `extensions`.
   The folder name must stay exactly `gnome_uninstall_app@local`.
6. **Log out and log back in.** (On Wayland GNOME Shell only discovers new extensions at login.)
7. Open the **Extensions** app and switch on **gnome_uninstall_app**.
   If you do not have it: install `gnome-shell-extension-manager` / `gnome-extensions-app` from your Software center.

## Check that it works
Right-click an app icon in the app grid or dash. A red **Uninstall** item appears at the bottom of the menu.
Try it first on a small app you do not need.

## Updating
Replace the files inside `~/.local/share/gnome-shell/extensions/gnome_uninstall_app@local/` with the new ones, then log out and back in.

## Optional: terminal install
```bash
unzip gnome_uninstall_app@local.zip -d ~/.local/share/gnome-shell/extensions/
```
Then log out and in, and enable the extension.
