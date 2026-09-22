// SPDX-License-Identifier: GPL-3.0-or-later
/* Mon module — point de départ. Renomme le dossier, ce fichier et l'id
 * (les trois doivent être identiques), puis remplace le contenu. */

import Pango from 'gi://Pango';

export default {
    id: 'my-module',
    title: 'Mon module',
    icon: 'starred-symbolic',

    build(ctx) {
        const {St, GLib, style, utils} = ctx;

        const actor = new St.BoxLayout({vertical: true, x_expand: true});
        const header = new St.Label({text: 'MON MODULE'});
        const value = new St.Label({text: '—'});
        /* un libellé espacé (labelStyle) serait tronqué sans ça */
        header.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        actor.add_child(header);
        actor.add_child(value);

        const paint = t => {
            actor.set_style('padding: 14px 16px; spacing: 6px;');
            header.set_style(style.labelStyle(t, {size: 10}));
            value.set_style(`font-family: ${t.fontDisplay}; font-size: 28px; font-weight: bold; color: ${t.text};`);
        };

        let timer = 0;
        const refresh = () => {
            value.text = GLib.DateTime.new_now_local().format('%H:%M:%S');
            return GLib.SOURCE_CONTINUE;
        };
        const stop = () => {
            timer = utils.sourceRemove(timer);
        };

        paint(ctx.theme);
        refresh();

        return {
            actor,
            setTheme: paint,
            onOpen() {          // panneau ouvert : démarrer
                stop();
                refresh();
                timer = utils.timeoutAdd(1000, refresh);
            },
            onClose: stop,      // panneau fermé : tout arrêter
            destroy: stop,      // libérer TOUT ce qui a été créé
        };
    },
};
