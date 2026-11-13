// App Uninstall Button - GNOME Shell extension (GNOME 45+ / ESM)

import Clutter from 'gi://Clutter';

import {Extension, InjectionManager, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as Dialog from 'resource:///org/gnome/shell/ui/dialog.js';
import {AppMenu} from 'resource:///org/gnome/shell/ui/appMenu.js';

import {
    detectTarget, describeTarget, isReversible, uninstallTarget, forgetTarget, clearCache,
} from './backends.js';

const patchedMenus = new Set();

async function doUninstall(app, target) {
    const appName = app.get_name();
    const path = app.get_app_info()?.get_filename?.();

    if (target.type !== 'steam')
        Main.notify(_('Uninstalling'), appName);

    const r = await uninstallTarget(target);
    if (r.ok) {
        forgetTarget(path);
        Main.notify(r.message ? _(r.message) : _('Uninstalled'), appName);
    } else {
        const tail = r.out.length > 500 ? `…${r.out.slice(-500)}` : r.out;
        Main.notifyError(`${_('Could not uninstall')} ${appName}`, tail || _('Cancelled or failed.'));
    }
}

function confirmAndUninstall(app, target) {
    if (target.type === 'steam') {
        doUninstall(app, target); // Steam asks for confirmation itself
        return;
    }

    const note = isReversible(target)
        ? _('The files are moved to the Trash. You can restore them.')
        : _('Only this application is removed. Nothing else is touched.');

    const dialog = new ModalDialog.ModalDialog({destroyOnClose: true});
    dialog.contentLayout.add_child(new Dialog.MessageDialogContent({
        title: `${_('Uninstall')} ${app.get_name()}?`,
        description: `${describeTarget(target)}\n${note}`,
    }));
    dialog.addButton({
        label: _('Cancel'),
        action: () => dialog.close(),
        key: Clutter.KEY_Escape,
    });
    const confirm = dialog.addButton({
        label: _('Uninstall'),
        action: () => {
            dialog.close();
            doUninstall(app, target);
        },
    });
    confirm?.add_style_class_name('app-uninstall-confirm');
    dialog.open();
}

function showDiagnostics(app, entry) {
    const lines = [
        `File: ${entry.path ?? '-'}`,
        `Exec: ${entry.exec || '-'}`,
        ...entry.notes.map(n => `• ${n}`),
    ];
    const dialog = new ModalDialog.ModalDialog({destroyOnClose: true});
    dialog.contentLayout.add_child(new Dialog.MessageDialogContent({
        title: `${_('Cannot uninstall')} ${app.get_name()}`,
        description: lines.join('\n'),
    }));
    dialog.addButton({
        label: _('Close'),
        action: () => dialog.close(),
        key: Clutter.KEY_Escape,
    });
    dialog.open();
}

function patchMenu(menu, app) {
    if (!menu._uninstallItem) {
        menu._uninstallSeparator = new PopupMenu.PopupSeparatorMenuItem();
        menu._uninstallItem = new PopupMenu.PopupMenuItem(_('Uninstall'));
        menu._uninstallItem.add_style_class_name('app-uninstall-item');
        menu._uninstallItem.connect('activate', () => {
            if (!menu._uninstallApp || !menu._uninstallEntry)
                return;
            if (menu._uninstallTarget)
                confirmAndUninstall(menu._uninstallApp, menu._uninstallTarget);
            else
                showDiagnostics(menu._uninstallApp, menu._uninstallEntry);
        });
        menu.addMenuItem(menu._uninstallSeparator);
        menu.addMenuItem(menu._uninstallItem);
        patchedMenus.add(menu);
        menu.connect('destroy', () => {
            patchedMenus.delete(menu);
            menu._uninstallItem = null;
            menu._uninstallSeparator = null;
        });
    }

    const setVisible = v => {
        if (menu._uninstallItem)
            menu._uninstallItem.visible = v;
        if (menu._uninstallSeparator)
            menu._uninstallSeparator.visible = v;
    };

    menu._uninstallApp = app;
    menu._uninstallTarget = null;
    menu._uninstallEntry = null;
    setVisible(false);
    if (!app)
        return;

    detectTarget(app).then(entry => {
        if (!menu._uninstallItem || menu._uninstallApp !== app)
            return;
        menu._uninstallEntry = entry;
        menu._uninstallTarget = entry.target;
        const ok = entry.target !== null;
        menu._uninstallItem.label.text = ok ? _('Uninstall') : _('Uninstall (unavailable)');
        if (ok)
            menu._uninstallItem.remove_style_class_name('app-uninstall-unavailable');
        else
            menu._uninstallItem.add_style_class_name('app-uninstall-unavailable');
        setVisible(true);
    }).catch(e => console.error(`[gnome_uninstall_app] ${e}`));
}

export default class AppUninstallButton extends Extension {
    enable() {
        this._injection = new InjectionManager();
        this._injection.overrideMethod(AppMenu.prototype, 'setApp', original =>
            function (app) {
                original.call(this, app);
                patchMenu(this, app);
            });
    }

    disable() {
        this._injection?.clear();
        this._injection = null;
        for (const menu of patchedMenus) {
            menu._uninstallItem?.destroy();
            menu._uninstallSeparator?.destroy();
            menu._uninstallItem = null;
            menu._uninstallSeparator = null;
        }
        patchedMenus.clear();
        clearCache();
    }
}
