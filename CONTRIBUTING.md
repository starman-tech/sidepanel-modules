# Adding or updating a module

English or French are both fine in issues and pull requests.

## 1. Write it

```bash
git clone https://github.com/<you>/yuzu-modules
cd yuzu-modules
cp -r template/my-module modules/<id>
mv modules/<id>/my-module.js modules/<id>/<id>.js
```

Then edit both files. The folder name, the file name and the `id` in the
file and in `module.json` must be identical: lowercase letters, digits and
`-`, 2 to 40 characters, not one of the built-in ids (`player`, `tracker`,
`market`, `todo`, `sysmon`, `weather`, `calendar`, `launcher`, `assistant`).

The contract and the `ctx` API are described in the
[module guide](https://github.com/starman-tech/yuzu/blob/main/docs/MODULES.md).

### `module.json`

| Field | |
|---|---|
| `id`, `title`, `description` | required; `description` is one or two sentences, shown in the preferences |
| `author` | required; your GitHub username |
| `version` | required; `1.0.0`. Bump it for every change, otherwise users never get the update |
| `license` | required; GPL-compatible (`GPL-3.0-or-later` recommended) |
| `minExtension` | Yuzu `version` needed; `5` for `ctx.api` 1 |
| `shell` | GNOME versions you tested: `["46", "47", "48", "49"]` |
| `network` | every host the module contacts, e.g. `["api.open-meteo.com"]`; `[]` if none |
| `tags` | a few words, used by the search box |
| `homepage` | optional; replaces the link to the source file in the preferences |

## 2. Test it

In a clone of the main repository:

```bash
tools/nested.sh                       # isolated nested shell
cp ../yuzu-modules/modules/<id>/<id>.js .run/sandbox/config/yuzu/modules/
```

then **＋** in the nested panel. Check that:

- the card looks right with both themes (Preferences → Style);
- nothing keeps running with the panel closed, unless that is the point;
- `gnome-extensions disable yuzu-plus@starman-tech.github.io` then `enable` leaves no
  error in `.run/nested.log`;
- the card survives a rebuild: change the panel width in the preferences.

You can also test the real install path: serve your fork with
`python3 -m http.server` and point Preferences → Catalogue → Source at
`http://127.0.0.1:8000/catalog.json`.

## 3. Publish it

```bash
tools/build-catalog.py      # regenerates catalog.json (hashes included)
git add modules/<id> catalog.json
git commit -m "Add <id>"
```

Open a pull request and fill in the template. If `build-catalog.py` printed a
⚠ for your module (network, subprocess, clipboard…), say why the module
needs it: that is what the review looks at first.

## Review rules

A module is merged when it:

- does what its description says and nothing else;
- contacts only the hosts listed in `network`, over HTTPS;
- releases everything in `destroy()`;
- does not read files outside `~/.config/yuzu`, `~/.cache/yuzu` and
  what its purpose obviously requires (`/proc` for a system monitor…);
- contains no minified or obfuscated code, and does not download or evaluate
  code at run time.
