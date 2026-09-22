# Yuzu — community modules

Cards for [Yuzu](https://github.com/starman-tech/yuzu), the GNOME
Shell side panel. Everything here can be installed in one click from the
extension: **Preferences → Catalogue → Installer**. No shell restart, and
updates apply live.

| Module | What it does | Network |
|---|---|---|
| [Débit réseau](modules/netspeed/netspeed.js) | Download / upload speed, last-minute graph, totals — read from `/proc/net/dev` | — |
| [Horloge](modules/clock/clock.js) | Big clock, full date, week number | — |
| [Note rapide](modules/quicknote/quicknote.js) | Always-at-hand notepad, saved automatically | — |
| [Pomodoro](modules/pomodoro/pomodoro.js) | 25/5 work cycles, long break every 4, notification — keeps running with the panel closed | — |

## How it works

[`catalog.json`](catalog.json) lists every module with its version and the
SHA-256 of its file. The extension downloads the catalog, then the file, and
**refuses a file whose hash does not match** — what runs on your machine is
exactly what was reviewed here.

`catalog.json` is generated: never edit it by hand, run
`tools/build-catalog.py`. CI fails if it is out of date or if a module is
invalid.

Want your own catalog (a fork, modules for your team)? Host a
`catalog.json` next to a `modules/` folder anywhere over HTTPS and paste its
URL in Preferences → Catalogue → Source.

## Add a module

See [CONTRIBUTING.md](CONTRIBUTING.md). Start from
[`template/my-module`](template/my-module) and read the
[module guide](https://github.com/starman-tech/yuzu/blob/main/docs/MODULES.md).

## Safety

Modules run inside GNOME Shell with the user's permissions. Every pull
request is read before it is merged; `tools/build-catalog.py` flags code that
starts processes, simulates key presses, reads the clipboard, evaluates code
or uses the network, and such modules must explain why in their pull
request. Each module declares the hosts it contacts, and the extension shows
them before installing.

Found a problem in a published module?
[Open an issue](https://github.com/starman-tech/yuzu-modules/issues).

## License

Every module is [GPL-3.0-or-later](LICENSE) unless its `module.json` says
otherwise (and a GPL-compatible license is required).
