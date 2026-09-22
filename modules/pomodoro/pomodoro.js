// SPDX-License-Identifier: GPL-3.0-or-later
/* Pomodoro — cycles travail / pause avec notification de fin.
 *
 * Le minuteur continue panneau fermé : la fin de séance est planifiée par
 * un seul timeout, l'affichage seconde par seconde ne tourne que panneau
 * ouvert. L'état (phase, heure de fin réelle) est enregistré dans
 * ~/.config/yuzu/pomodoro.json : le panneau reconstruit ses cartes
 * quand on ajoute un module, et une séance ne doit pas repartir de zéro. */

import Pango from 'gi://Pango';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/* St mesure les libellés SANS letter-spacing : ceux qui en ont (labelStyle)
 * se retrouvent tronqués par « … » alors que la place existe. */
const noEllipsis = label => {
    label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
    return label;
};

const PHASES = {
    work: {label: 'TRAVAIL', minutes: 25, next: 'break'},
    break: {label: 'PAUSE', minutes: 5, next: 'work'},
    long: {label: 'LONGUE PAUSE', minutes: 15, next: 'work'},
};
const ROUNDS_BEFORE_LONG = 4;

export default {
    id: 'pomodoro',
    title: 'Pomodoro',
    icon: 'alarm-symbolic',

    build(ctx) {
        const {St, Clutter, GLib, style, utils} = ctx;
        const file = utils.configFile('pomodoro.json');
        const now = () => Math.floor(GLib.get_real_time() / 1000);

        let theme = ctx.theme;
        let state = {phase: 'work', running: false, endsAt: 0, remaining: PHASES.work.minutes * 60000, rounds: 0,
            ...utils.readJson(file, {})};
        if (!PHASES[state.phase])
            state.phase = 'work';

        /* ---------- vue ---------- */
        const actor = new St.BoxLayout({vertical: true, x_expand: true});
        const head = new St.BoxLayout({x_expand: true});
        const phaseLabel = new St.Label({x_expand: true});
        const roundsLabel = new St.Label();
        head.add_child(noEllipsis(phaseLabel));
        head.add_child(noEllipsis(roundsLabel));

        const time = new St.Label({x_align: Clutter.ActorAlign.CENTER});
        const track = new St.Widget({x_expand: true, layout_manager: new Clutter.BinLayout()});
        const fill = new St.Widget({x_align: Clutter.ActorAlign.START, y_expand: true});
        track.add_child(fill);

        const buttons = new St.BoxLayout({x_expand: true, x_align: Clutter.ActorAlign.CENTER});
        const makeButton = (text, onClick) => {
            const caption = noEllipsis(new St.Label({text}));
            const button = new St.Button({child: caption, can_focus: true, reactive: true});
            button.caption = caption;
            button.connect('clicked', () => onClick());
            buttons.add_child(button);
            return button;
        };
        const toggleBtn = makeButton('DÉMARRER', () => (state.running ? pause() : resume()));
        const resetBtn = makeButton('ZÉRO', () => reset());
        const skipBtn = makeButton('PASSER', () => finish(false));

        for (const child of [head, time, track, buttons])
            actor.add_child(child);

        const paint = t => {
            theme = t;
            actor.set_style('padding: 14px 16px; spacing: 10px;');
            phaseLabel.set_style(style.labelStyle(t, {size: 10, color: t.accent}));
            roundsLabel.set_style(style.labelStyle(t, {size: 9}));
            time.set_style(`font-family: ${t.fontDisplay}; font-size: 44px; font-weight: bold; color: ${t.text};`);
            track.set_style(`height: 6px; border-radius: 3px; background-color: ${t.innerStroke};`);
            fill.set_style(`border-radius: 3px; background-color: ${t.accent};`);
            buttons.set_style('spacing: 6px;');
            for (const b of [toggleBtn, resetBtn, skipBtn]) {
                const primary = b === toggleBtn;
                b.caption.set_style(style.labelStyle(t, {size: 9, color: primary ? t.accentInk : t.text}));
                b.set_style(`padding: 6px 10px; border-radius: ${t.cardRadius}px;
                    background-color: ${primary ? t.accent : 'transparent'};
                    border: 1px solid ${primary ? t.accent : t.innerStroke};`);
            }
            render();
        };

        /* ---------- logique ---------- */
        let endTimer = 0;
        let tickTimer = 0;
        let open = false;

        const total = () => PHASES[state.phase].minutes * 60000;
        const left = () => Math.max(0, state.running ? state.endsAt - now() : state.remaining);

        const persist = () => {
            try {
                utils.writeJson(file, state);
            } catch (_e) {}
        };

        const render = () => {
            const ms = left();
            const s = Math.ceil(ms / 1000);
            time.text = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
            phaseLabel.text = PHASES[state.phase].label + (!state.running && ms < total() ? ' · EN PAUSE' : '');
            roundsLabel.text = `${state.rounds % ROUNDS_BEFORE_LONG} / ${ROUNDS_BEFORE_LONG}`;
            toggleBtn.caption.text = state.running ? 'PAUSE' : (ms < total() ? 'REPRENDRE' : 'DÉMARRER');
            /* hors scène, lire la largeur fait calculer à St une taille sans
             * thème (St-CRITICAL) ; notify::width rappellera render() */
            const width = track.get_stage() ? track.get_width() : 0;
            if (width > 0)
                fill.set_width(Math.round(width * (1 - ms / total())));
        };

        const schedule = () => {
            endTimer = utils.sourceRemove(endTimer);
            if (state.running) {
                endTimer = utils.timeoutAdd(Math.max(0, state.endsAt - now()) + 50, () => {
                    endTimer = 0;
                    finish(true);
                    return GLib.SOURCE_REMOVE;
                });
            }
        };

        const startTicking = () => {
            tickTimer = utils.sourceRemove(tickTimer);
            if (open && state.running) {
                tickTimer = utils.timeoutAdd(1000, () => {
                    render();
                    return GLib.SOURCE_CONTINUE;
                });
            }
        };

        const resume = () => {
            state.running = true;
            state.endsAt = now() + state.remaining;
            persist();
            schedule();
            startTicking();
            render();
        };

        const pause = () => {
            state.remaining = left();
            state.running = false;
            persist();
            schedule();
            startTicking();
            render();
        };

        const reset = () => {
            state = {phase: 'work', running: false, endsAt: 0, remaining: PHASES.work.minutes * 60000, rounds: 0};
            persist();
            schedule();
            startTicking();
            render();
        };

        const finish = notify => {
            const done = state.phase;
            if (done === 'work')
                state.rounds += 1;
            state.phase = done === 'work'
                ? (state.rounds % ROUNDS_BEFORE_LONG === 0 ? 'long' : 'break')
                : 'work';
            state.remaining = total();
            state.running = false;
            persist();
            schedule();
            startTicking();
            render();
            if (notify) {
                Main.notify('Pomodoro',
                    done === 'work'
                        ? `Séance terminée. ${PHASES[state.phase].label.toLowerCase()} de ${PHASES[state.phase].minutes} min.`
                        : 'Pause terminée. On s\'y remet ?');
            }
        };

        /* une séance a pu se terminer pendant que la carte n'existait pas */
        if (state.running && state.endsAt <= now())
            finish(true);

        track.connect('notify::width', () => render());
        paint(theme);
        schedule();

        return {
            actor,
            setTheme: paint,
            onOpen() {
                open = true;
                render();
                startTicking();
            },
            onClose() {
                open = false;
                tickTimer = utils.sourceRemove(tickTimer);
            },
            destroy() {
                tickTimer = utils.sourceRemove(tickTimer);
                endTimer = utils.sourceRemove(endTimer);
                persist();
            },
        };
    },
};
