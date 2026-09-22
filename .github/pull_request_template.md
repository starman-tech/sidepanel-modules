<!-- Merci ! Coche ce qui s'applique. / Thanks! Tick what applies. -->

**Module** : `modules/<id>/`

- [ ] Testé dans `tools/nested.sh` du dépôt principal (ouverture, fermeture, changement de thème, désactivation de l'extension) sans erreur dans le journal
- [ ] `tools/build-catalog.py` lancé et `catalog.json` committé
- [ ] Tous les timers, signaux et sessions réseau sont libérés dans `destroy()`
- [ ] `network` liste chaque serveur contacté (vide si aucun)
- [ ] Pour une mise à jour : `version` augmentée

**Ce que fait le module / What it does**

**Si le script signale un motif sensible (réseau, sous-processus, presse-papiers…), pourquoi en a-t-il besoin ?**

**Capture d'écran / Screenshot**
