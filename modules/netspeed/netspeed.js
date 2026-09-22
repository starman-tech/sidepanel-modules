// SPDX-License-Identifier: GPL-3.0-or-later
/* Débit réseau — vitesses de réception et d'envoi, courbe des 60 dernières
 * secondes et volume échangé depuis le démarrage.
 *
 * 100 % local : lit /proc/net/dev toutes les 2 s, panneau ouvert
 * seulement. Les interfaces virtuelles (lo, docker, veth, bridges…) sont
 * ignorées pour ne compter que le trafic réel. */

import Pango from 'gi://Pango';

/* St mesure les libellés SANS letter-spacing : ceux qui en ont (labelStyle)
 * se retrouvent tronqués par « … » alors que la place existe. */
const noEllipsis = label => {
    label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
    return label;
};

const SAMPLES = 30;          // 30 × 2 s = 1 minute
const INTERVAL = 2000;
const VIRTUAL = /^(lo|docker|veth|br-|virbr|vnet|tun|tap|zt|tailscale)/;

function readCounters(GLib) {
    const [ok, bytes] = GLib.file_get_contents('/proc/net/dev');
    if (!ok)
        return null;
    let rx = 0, tx = 0;
    for (const line of new TextDecoder().decode(bytes).split('\n').slice(2)) {
        const [name, rest] = line.split(':');
        if (!rest || VIRTUAL.test(name.trim()))
            continue;
        const f = rest.trim().split(/\s+/).map(Number);
        rx += f[0];
        tx += f[8];
    }
    return {rx, tx, t: GLib.get_monotonic_time()};
}

function human(bytes, perSecond = false) {
    const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
    let v = bytes, i = 0;
    while (v >= 1000 && i < units.length - 1) {
        v /= 1000;
        i++;
    }
    const n = v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1);
    return `${n} ${units[i]}${perSecond ? '/s' : ''}`;
}

export default {
    id: 'netspeed',
    title: 'Débit réseau',
    icon: 'network-transmit-receive-symbolic',

    build(ctx) {
        const {St, Clutter, GLib, style, utils} = ctx;
        let theme = ctx.theme;

        const actor = new St.BoxLayout({vertical: true, x_expand: true});
        const header = noEllipsis(new St.Label({text: 'RÉSEAU'}));

        const row = new St.BoxLayout({x_expand: true});
        const makeStat = caption => {
            const box = new St.BoxLayout({vertical: true, x_expand: true});
            const cap = noEllipsis(new St.Label({text: caption}));
            const value = new St.Label({text: '—'});
            box.add_child(cap);
            box.add_child(value);
            row.add_child(box);
            return {cap, value};
        };
        const down = makeStat('↓ RÉCEPTION');
        const up = makeStat('↑ ENVOI');

        const graph = new St.BoxLayout({x_expand: true, y_align: Clutter.ActorAlign.END});
        const bars = [];
        for (let i = 0; i < SAMPLES; i++) {
            const bar = new St.Widget({x_expand: true, y_align: Clutter.ActorAlign.END});
            graph.add_child(bar);
            bars.push(bar);
        }
        const totals = noEllipsis(new St.Label());

        for (const child of [header, row, graph, totals])
            actor.add_child(child);

        const GRAPH_HEIGHT = 36;
        const history = [];
        const base = readCounters(GLib);
        let last = base;
        let timer = 0;

        const paint = t => {
            theme = t;
            actor.set_style('padding: 14px 16px; spacing: 8px;');
            header.set_style(style.labelStyle(t, {size: 10}));
            for (const s of [down, up]) {
                s.cap.set_style(style.labelStyle(t, {size: 9, color: s === down ? t.accent : t.textDim}));
                s.value.set_style(`font-family: ${t.fontDisplay}; font-size: 20px; font-weight: bold; color: ${t.text};`);
            }
            graph.set_style(`spacing: 2px; height: ${GRAPH_HEIGHT * utils.scaleFactor()}px;`);
            totals.set_style(style.labelStyle(t, {size: 9}));
            drawGraph();
        };

        const drawGraph = () => {
            const peak = Math.max(1, ...history.map(h => h.rx + h.tx));
            const s = utils.scaleFactor();
            bars.forEach((bar, i) => {
                const sample = history[i - (SAMPLES - history.length)];
                const ratio = sample ? (sample.rx + sample.tx) / peak : 0;
                bar.set_height(Math.max(1, Math.round(ratio * GRAPH_HEIGHT * s)));
                bar.set_style(`border-radius: 1px; background-color: ${sample ? theme.accent : theme.innerStroke};`);
            });
        };

        const sample = () => {
            let current;
            try {
                current = readCounters(GLib);
            } catch (_e) {
                return GLib.SOURCE_CONTINUE;
            }
            if (current && last) {
                const dt = Math.max(1, current.t - last.t) / 1e6;
                const rx = Math.max(0, current.rx - last.rx) / dt;
                const tx = Math.max(0, current.tx - last.tx) / dt;
                history.push({rx, tx});
                if (history.length > SAMPLES)
                    history.shift();
                down.value.text = human(rx, true);
                up.value.text = human(tx, true);
                totals.text = `TOTAL · ↓ ${human(current.rx)} · ↑ ${human(current.tx)}`;
                drawGraph();
            }
            last = current;
            return GLib.SOURCE_CONTINUE;
        };

        const stop = () => {
            timer = utils.sourceRemove(timer);
        };

        paint(theme);
        if (base)
            totals.text = `TOTAL · ↓ ${human(base.rx)} · ↑ ${human(base.tx)}`;

        return {
            actor,
            setTheme: paint,
            onOpen() {
                stop();
                last = readCounters(GLib);
                timer = utils.timeoutAdd(INTERVAL, sample);
            },
            onClose: stop,
            destroy: stop,
        };
    },
};
