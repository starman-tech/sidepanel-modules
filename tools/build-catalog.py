#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Génère catalog.json à partir de modules/<id>/module.json + <id>.js.

    tools/build-catalog.py           réécrit catalog.json
    tools/build-catalog.py --check   échoue si catalog.json n'est pas à jour
                                     ou si un module est invalide (CI)

Les règles de validation sont les mêmes que celles de l'extension
(lib/catalog.js, validateEntry) : un module refusé ici le serait aussi
à l'installation.
"""
import hashlib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CATALOG = ROOT / 'catalog.json'
SCHEMA = 1

BUILTIN_IDS = {'player', 'tracker', 'market', 'todo', 'sysmon', 'weather',
               'calendar', 'launcher', 'assistant'}
ID_RE = re.compile(r'^[a-z][a-z0-9-]{1,39}$')
VERSION_RE = re.compile(r'^\d+(\.\d+){0,2}$')
REQUIRED = ('id', 'title', 'description', 'author', 'version', 'license')
KNOWN_SHELLS = {'46', '47', '48', '49'}

# Motifs qui ne bloquent pas mais doivent être justifiés dans la PR : ils
# donnent au module plus que l'affichage d'une carte.
SENSITIVE = {
    r'Gio\.Subprocess|GLib\.spawn|SubprocessLauncher': 'lance des programmes',
    r'create_virtual_device|notify_keyval': 'simule des frappes clavier',
    r'Soup\.|fetchBytes|newSession': 'accède au réseau',
    r'St\.Clipboard': 'lit ou écrit le presse-papiers',
    r'\beval\s*\(|new Function\s*\(': 'évalue du code dynamique',
    r'\bimport\s*\(': 'importe du code dynamiquement',
}


def fail(errors):
    for e in errors:
        print(f'✗ {e}')
    sys.exit(1)


def build():
    errors, warnings, entries = [], [], []
    seen = set()
    for meta_path in sorted(ROOT.glob('modules/*/module.json')):
        folder = meta_path.parent
        where = folder.relative_to(ROOT)
        try:
            meta = json.loads(meta_path.read_text())
        except json.JSONDecodeError as e:
            errors.append(f'{where}/module.json : JSON invalide ({e})')
            continue

        mid = meta.get('id', '')
        missing = [k for k in REQUIRED if not meta.get(k)]
        if missing:
            errors.append(f'{where} : champs manquants {", ".join(missing)}')
        if not ID_RE.fullmatch(mid):
            errors.append(f'{where} : identifiant « {mid} » invalide (a-z, 0-9, -, 2 à 40 caractères)')
        if mid in BUILTIN_IDS:
            errors.append(f'{where} : « {mid} » est réservé à un module intégré')
        if mid != folder.name:
            errors.append(f'{where} : le dossier doit s\'appeler comme l\'id (« {mid} »)')
        if mid in seen:
            errors.append(f'{where} : id « {mid} » en double')
        seen.add(mid)
        if not VERSION_RE.fullmatch(str(meta.get('version', ''))):
            errors.append(f'{where} : version « {meta.get("version")} » invalide (ex. 1.2.0)')
        unknown = set(meta.get('shell', [])) - KNOWN_SHELLS
        if unknown:
            errors.append(f'{where} : versions de GNOME inconnues {sorted(unknown)}')

        script = folder / f'{mid}.js'
        if not script.exists():
            errors.append(f'{where} : fichier {mid}.js absent')
            continue
        source = script.read_text()
        if not source.startswith('// SPDX-License-Identifier:'):
            errors.append(f'{where}/{mid}.js : la première ligne doit être un en-tête SPDX')
        declared = re.search(r"export default\s*\{[\s\S]*?\bid:\s*'([^']+)'", source)
        if not declared or declared.group(1) != mid:
            errors.append(f'{where}/{mid}.js : export default {{ id: \'{mid}\', … }} attendu')
        if 'build(' not in source:
            errors.append(f'{where}/{mid}.js : méthode build(ctx) absente')

        for pattern, what in SENSITIVE.items():
            if re.search(pattern, source):
                warnings.append(f'{where} {what} — à justifier dans la PR')
        if re.search(r'Soup\.|fetchBytes|newSession', source) and not meta.get('network'):
            errors.append(f'{where} : accède au réseau mais « network » est vide dans module.json')

        entry = {k: meta[k] for k in ('id', 'title', 'description', 'author', 'version', 'license')
                 if k in meta}
        for k in ('homepage', 'minExtension', 'shell', 'network', 'tags'):
            if meta.get(k) not in (None, [], ''):
                entry[k] = meta[k]
        entry['file'] = f'modules/{mid}/{mid}.js'
        entry['sha256'] = hashlib.sha256(script.read_bytes()).hexdigest()
        entries.append(entry)

    entries.sort(key=lambda e: e['title'].lower())
    return {'schema': SCHEMA, 'modules': entries}, errors, warnings


def main():
    catalog, errors, warnings = build()
    for w in warnings:
        print(f'⚠ {w}')
    if errors:
        fail(errors)
    text = json.dumps(catalog, indent=2, ensure_ascii=False) + '\n'
    if '--check' in sys.argv:
        current = CATALOG.read_text() if CATALOG.exists() else ''
        if current != text:
            fail(['catalog.json n\'est pas à jour : lance tools/build-catalog.py et committe le résultat'])
        print(f'✓ catalog.json à jour — {len(catalog["modules"])} module(s)')
    else:
        CATALOG.write_text(text)
        print(f'✓ catalog.json écrit — {len(catalog["modules"])} module(s)')


if __name__ == '__main__':
    main()
