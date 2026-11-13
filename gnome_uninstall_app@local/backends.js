// Detection and removal backends.
// Rule: remove ONLY the selected application. Low-level package tools are used
// (pacman -R, dpkg --remove, rpm -e) because they REFUSE to remove a package
// that other packages depend on, and they never remove extra dependencies.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Never offer the button for these, even if the tool would allow it.
const PROTECTED = new Set([
    'gnome-shell', 'gnome-session', 'gnome-session-bin', 'gdm', 'gdm3', 'mutter',
    'pacman', 'apt', 'dpkg', 'rpm', 'dnf', 'dnf5', 'zypper', 'flatpak', 'snapd',
    'polkit', 'polkitd', 'policykit-1', 'systemd', 'linux', 'base', 'glibc', 'libc6',
    'bash', 'coreutils', 'ubuntu-desktop', 'ubuntu-session', 'core', 'bare',
]);

// Must start with a letter/digit (so it can never look like an option).
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9@._+-]*$/;

const cache = new Map(); // desktop-file path -> target | null

export function forgetTarget(path) {
    if (path)
        cache.delete(path);
}

export function clearCache() {
    cache.clear();
}

function has(program) {
    return GLib.find_program_in_path(program) !== null;
}

function run(argv) {
    return new Promise(resolve => {
        let proc;
        try {
            proc = Gio.Subprocess.new(
                argv,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_MERGE);
        } catch (e) {
            resolve({ok: false, out: e.message});
            return;
        }
        proc.communicate_utf8_async(null, null, (p, res) => {
            try {
                const [, stdout] = p.communicate_utf8_finish(res);
                resolve({ok: p.get_successful(), out: (stdout ?? '').trim()});
            } catch (e) {
                resolve({ok: false, out: e.message});
            }
        });
    });
}

function pkgTarget(type, name) {
    if (!name || !NAME_RE.test(name) || PROTECTED.has(name))
        return null;
    return {type, name};
}

async function detectPackage(path, notes) {
    if (has('pacman')) {
        const r = await run(['pacman', '-Qqo', '--', path]);
        if (r.ok) {
            const name = r.out.split('\n')[0].trim();
            const t = pkgTarget('pacman', name);
            if (t)
                return t;
            notes.push(`pacman: owner "${name}" is protected or has an invalid name`);
        } else {
            notes.push(`pacman: ${r.out.split('\n')[0] || 'file not owned'}`);
        }
    }
    if (has('dpkg')) {
        const r = await run(['dpkg', '-S', '--', path]);
        if (r.ok) {
            const line = r.out.split('\n').find(l => !l.startsWith('diversion'));
            const m = line?.match(/^([A-Za-z0-9][A-Za-z0-9@._+-]*)(?::[A-Za-z0-9-]+)?: /);
            const t = m ? pkgTarget('dpkg', m[1]) : null;
            if (t)
                return t;
            notes.push(`dpkg: owner "${m?.[1] ?? line}" is protected or unreadable`);
        } else {
            notes.push(`dpkg: ${r.out.split('\n')[0] || 'file not owned'}`);
        }
    }
    if (has('rpm')) {
        const r = await run(['rpm', '-qf', '--qf', '%{NAME}\\n', '--', path]);
        if (r.ok) {
            const names = [...new Set(r.out.split('\n').map(x => x.trim()).filter(Boolean))];
            const t = names.length === 1 ? pkgTarget('rpm', names[0]) : null;
            if (t)
                return t;
            notes.push(`rpm: owner(s) "${names.join(', ')}" are protected, invalid or ambiguous`);
        } else {
            notes.push(`rpm: ${r.out.split('\n')[0] || 'file not owned'}`);
        }
    }
    return null;
}

function appImageTarget(info, path, notes) {
    const home = GLib.get_home_dir();
    if (!path.startsWith(`${home}/`)) {
        notes.push('AppImage: desktop file is not inside your home folder');
        return null;
    }
    let argv;
    try {
        [, argv] = GLib.shell_parse_argv(info.get_commandline?.() ?? '');
    } catch (e) {
        notes.push('AppImage: could not parse the Exec line');
        return null;
    }
    const bin = argv?.[0];
    if (!bin || !bin.startsWith(`${home}/`) || !/\.appimage$/i.test(bin)) {
        notes.push('AppImage: Exec does not point to a .AppImage file in your home folder');
        return null;
    }
    if (!GLib.file_test(bin, GLib.FileTest.IS_REGULAR)) {
        notes.push(`AppImage: file not found: ${bin}`);
        return null;
    }
    return {type: 'appimage', name: GLib.path_get_basename(bin), files: [bin, path]};
}

async function detectUncached(app, info, path, notes) {
    const id = (app.get_id() ?? '').replace(/\.desktop$/, '');
    const exec = info.get_commandline?.() ?? '';

    // Steam games
    const steam = exec.match(/steam:\/\/rungameid\/(\d+)/);
    if (steam)
        return {type: 'steam', name: steam[1]};
    notes.push('Steam: Exec has no steam://rungameid/<id>');

    // Flatpak
    if (path.includes('/flatpak/exports/share/applications/')) {
        if (!NAME_RE.test(id)) {
            notes.push(`Flatpak: invalid app id "${id}"`);
            return null;
        }
        return {
            type: 'flatpak',
            name: id,
            scope: path.startsWith(`${GLib.get_home_dir()}/`) ? '--user' : '--system',
        };
    }

    // Snap: /var/lib/snapd/desktop/applications/<snap>_<app>.desktop
    if (path.includes('/snapd/desktop/applications/')) {
        const snap = GLib.path_get_basename(path).split('_')[0];
        const t = pkgTarget('snap', snap);
        if (!t)
            notes.push(`Snap: "${snap}" is protected or invalid`);
        return t;
    }

    // AppImage (user-integrated)
    const appImage = appImageTarget(info, path, notes);
    if (appImage)
        return appImage;

    // Distro packages (pacman / dpkg / rpm)
    return detectPackage(path, notes);
}

// Returns {target, path, exec, notes}. target is null when the app cannot be removed.
export async function detectTarget(app) {
    const info = app.get_app_info();
    const path = info?.get_filename?.() ?? null;
    if (!path) {
        return {target: null, path: null, exec: '',
            notes: ['No .desktop file is known for this app']};
    }
    if (cache.has(path))
        return cache.get(path);

    const notes = [];
    let target = null;
    try {
        target = await detectUncached(app, info, path, notes);
    } catch (e) {
        notes.push(`Internal error: ${e}`);
    }
    const entry = {target, path, exec: info.get_commandline?.() ?? '', notes};
    cache.set(path, entry);
    return entry;
}

export function describeTarget(t) {
    switch (t.type) {
    case 'pacman': return `Package: ${t.name} (pacman)`;
    case 'dpkg': return `Package: ${t.name} (dpkg)`;
    case 'rpm': return `Package: ${t.name} (rpm)`;
    case 'flatpak': return `Flatpak: ${t.name}`;
    case 'snap': return `Snap: ${t.name}`;
    case 'steam': return `Steam game ${t.name}`;
    case 'appimage': return `AppImage: ${t.files.join('\n')}`;
    default: return t.name;
    }
}

export function isReversible(t) {
    return t.type === 'appimage'; // moved to Trash
}

export async function uninstallTarget(t) {
    switch (t.type) {
    case 'pacman':
        return run(['pkexec', 'pacman', '-R', '--noconfirm', t.name]);
    case 'dpkg':
        return run(['pkexec', 'env', 'DEBIAN_FRONTEND=noninteractive', 'dpkg', '--remove', t.name]);
    case 'rpm':
        return run(['pkexec', 'rpm', '-e', t.name]);
    case 'snap':
        return run(['pkexec', 'snap', 'remove', t.name]);
    case 'flatpak':
        return run(['flatpak', 'uninstall', t.scope, '-y', '--noninteractive', t.name]);
    case 'steam': {
        // Steam shows its own confirmation window and deletes the game files itself.
        const url = `steam://uninstall/${t.name}`;
        const argv = has('steam') ? ['steam', url] : ['flatpak', 'run', 'com.valvesoftware.Steam', url];
        try {
            Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
            return {ok: true, out: '', message: 'Confirm the uninstall in the Steam window'};
        } catch (e) {
            return {ok: false, out: e.message};
        }
    }
    case 'appimage':
        try {
            for (const f of t.files)
                Gio.File.new_for_path(f).trash(null);
            return {ok: true, out: '', message: 'Moved to Trash'};
        } catch (e) {
            return {ok: false, out: e.message};
        }
    default:
        return {ok: false, out: 'Unsupported source'};
    }
}
