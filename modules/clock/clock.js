// SPDX-License-Identifier: GPL-3.0-or-later
/* Horloge — heure, date et numéro de semaine. Aucune donnée réseau. */

import Pango from 'gi://Pango';

/* St mesure les libellés SANS letter-spacing : ceux qui en ont (labelStyle)
 * se retrouvent tronqués par « … » alors que la place existe. */
const noEllipsis = label => {
    label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
    return label;
};

export default {
    id: 'clock',
    title: 'Horloge',
    icon: 'preferences-system-time-symbolic',

    build(ctx) {
        const {St, Clutter, GLib, style, utils} = ctx;
        let theme = ctx.theme;

        const actor = new St.BoxLayout({vertical: true, x_expand: true});
        const header = new St.Label({text: 'HORLOGE'});
        const time = new St.Label({x_align: Clutter.ActorAlign.START});
        const date = new St.Label({x_align: Clutter.ActorAlign.START});
        const week = new St.Label({x_align: Clutter.ActorAlign.START});
        for (const child of [header, time, date, week])
            actor.add_child(noEllipsis(child));

        let timer = 0;

        const paint = t => {
            theme = t;
            actor.set_style('padding: 14px 16px; spacing: 2px;');
            header.set_style(`${style.labelStyle(t, {size: 10})} padding-bottom: 6px;`);
            time.set_style(`font-family: ${t.fontDisplay}; font-size: 42px; font-weight: bold; color: ${t.text};`);
            date.set_style(`font-size: 13px; color: ${t.text};`);
            week.set_style(`${style.labelStyle(t, {size: 9, color: t.accent})} padding-top: 4px;`);
        };

        const refresh = () => {
            const now = GLib.DateTime.new_now_local();
            time.text = now.format('%H:%M');
            const d = now.format('%A %e %B %Y').replace(/\s+/g, ' ');
            date.text = d.charAt(0).toUpperCase() + d.slice(1);
            week.text = `SEMAINE ${now.get_week_of_year()} · JOUR ${now.get_day_of_year()}`;
            return GLib.SOURCE_CONTINUE;
        };

        /* se cale sur la minute pile, puis toutes les 60 s */
        const start = () => {
            stop();
            refresh();
            const wait = 60 - GLib.DateTime.new_now_local().get_second();
            timer = utils.timeoutAdd(wait * 1000, () => {
                refresh();
                timer = utils.timeoutAdd(60000, refresh);
                return GLib.SOURCE_REMOVE;
            });
        };
        const stop = () => {
            timer = utils.sourceRemove(timer);
        };

        paint(theme);
        refresh();

        return {
            actor,
            setTheme: paint,
            onOpen: start,
            onClose: stop,
            destroy: stop,
        };
    },
};
