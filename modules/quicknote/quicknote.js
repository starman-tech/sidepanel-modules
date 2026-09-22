// SPDX-License-Identifier: GPL-3.0-or-later
/* Note rapide — un bloc-notes persistant, sauvegardé automatiquement dans
 * ~/.config/yuzu/quicknote.json. */

import Pango from 'gi://Pango';

/* St mesure les libellés SANS letter-spacing : ceux qui en ont (labelStyle)
 * se retrouvent tronqués par « … » alors que la place existe. */
const noEllipsis = label => {
    label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
    return label;
};

export default {
    id: 'quicknote',
    title: 'Note rapide',
    icon: 'accessories-text-editor-symbolic',

    build(ctx) {
        const {St, Clutter, GLib, panel, style, utils} = ctx;
        const file = utils.configFile('quicknote.json');

        const actor = new St.BoxLayout({vertical: true, x_expand: true});
        const head = new St.BoxLayout({x_expand: true});
        const label = new St.Label({text: 'NOTE RAPIDE', x_expand: true});
        const status = new St.Label({text: ''});
        head.add_child(noEllipsis(label));
        head.add_child(noEllipsis(status));

        const entry = new St.Entry({
            x_expand: true,
            can_focus: true,
            hint_text: 'Écris ici…',
        });
        entry.clutter_text.set_single_line_mode(false);
        entry.clutter_text.set_activatable(false);
        entry.clutter_text.set_line_wrap(true);

        actor.add_child(head);
        actor.add_child(entry);

        let saveTimer = 0;
        let statusTimer = 0;

        const paint = t => {
            actor.set_style('padding: 14px 16px; spacing: 8px;');
            label.set_style(style.labelStyle(t, {size: 10}));
            status.set_style(style.labelStyle(t, {size: 9, color: t.accent}));
            const pal = ctx.palette ?? {};
            entry.set_style(`
                background-color: ${pal.inset ?? 'rgba(0, 0, 0, 0.25)'};
                border: 1px solid ${pal.strokeSoft ?? t.innerStroke};
                border-radius: ${t.cardRadius}px;
                caret-color: ${t.accent};
                color: ${t.text};
                font-family: ${t.fontMono};
                font-size: 12px;
                min-height: 90px;
                padding: 10px;`);
        };

        const save = () => {
            saveTimer = 0;
            try {
                utils.writeJson(file, {text: entry.get_text()});
                status.text = 'ENREGISTRÉ';
                utils.sourceRemove(statusTimer);
                statusTimer = utils.timeoutAdd(1500, () => {
                    statusTimer = 0;
                    status.text = '';
                    return GLib.SOURCE_REMOVE;
                });
            } catch (e) {
                status.text = 'ERREUR';
                console.warn(`[yuzu:quicknote] ${e}`);
            }
            return GLib.SOURCE_REMOVE;
        };

        entry.set_text(utils.readJson(file, {})?.text ?? '');

        entry.clutter_text.connect('text-changed', () => {
            utils.sourceRemove(saveTimer);
            saveTimer = utils.timeoutAdd(800, save);
        });

        /* sans grab modal, GNOME envoie les touches à la fenêtre active */
        entry.connect('button-press-event', () => {
            panel.enterEditMode?.(entry.clutter_text);
            return Clutter.EVENT_PROPAGATE;
        });

        paint(ctx.theme);

        return {
            actor,
            setTheme: paint,
            destroy() {
                statusTimer = utils.sourceRemove(statusTimer);
                if (saveTimer) {
                    utils.sourceRemove(saveTimer);
                    save();
                    statusTimer = utils.sourceRemove(statusTimer);
                }
            },
        };
    },
};
