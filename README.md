# ShaLoop

Générateur de boucles shamaniques — deux outils complémentaires :

- **ShaLoop** — joueur live dans le navigateur, paramètres ajustables en temps réel (hot-swap)
- **shaman.csd + render.sh** — rendu offline en MP3 via Csound

**Démo en ligne :** https://l0d0v1c.github.io/shaloop

## Inspirations

Le réglage par défaut s'appuie sur ce que l'ethnomusicologie et la neurophysiologie ont établi sur les musiques de transe (Rouget, Neher, Maurer ; plus récemment les travaux de l'IRCAM et de l'Université de Liège). Quelques invariants trans-culturels :

- **Pulsation 4–5 Hz** (≈ 240–300 BPM si on compte chaque coup) → zone **theta** du cerveau.
- **Répétition avec micro-variation** : la régularité parfaite (machine) « fonctionne » moins bien que la régularité humaine avec des écarts de quelques millisecondes.
- **Léger accelerando** sur 10–15 minutes, parfois avec retours en arrière.
- **Polyrythmie subtile** : 2 ou 3 couches en phase légèrement décalée créent des battements.
- **Drone basse fréquence continu** (60–90 Hz) qui « porte » la pulsation.
- **Contenu spectral riche** : peau de tambour = harmoniques denses, pas un sinus pur.
- **Accents probabilistes** plutôt que motifs fixes (le cerveau anticipe moins, reste plus engagé).

Les paramètres exposés (pulsation, note du drone, dérive, hochet, reverb…) permettent de moduler ces invariants en restant dans des plages musicalement « efficaces ».

## ShaLoop (webapp)

Tout est embarqué localement (runtime Strudel + samples + code en base64 dans `data.js`). Aucun serveur requis :

```sh
open index.html
```

### Ajouter un preset

1. Déposer un fichier `.strudel` dans `codes/`
2. L'ajouter dans `manifest.json` avec ses `params` (id, label, min/max/step/default ; ou `type: "select"` + `options`)
3. Référencer les params comme variables JS dans le `.strudel` (ex. `s("frame").fast(pulse)`)

### Ajouter un sample

1. Déposer le fichier audio dans `samples/`
2. Ajouter une entrée dans `manifest.json` (`bindings: { nom: "samples/xxx.mp3" }`)

## Csound

Synthèse offline avec le sample frame drum et toutes les couches modélisées dans `shaman.csd` (pulsation humanisée, drone sub C1, hochet, reverb, dérive cosinus, dcblock, soft-clip).

```sh
./render.sh                       # 3 min, sortie shaman.mp3
./render.sh -d 600                # 10 min
./render.sh -d 300 -p 4.5 -m 22   # pulsation 4.5 Hz, drone Bb0
./render.sh -h                    # toutes les options
```

Dépendances : `csound`, `ffmpeg`, `lame` (Homebrew).

## Licence

**AGPL-3.0-or-later** — imposée par l'embarquement du runtime [Strudel](https://strudel.cc) (`lib/strudel/`). Toute redistribution, y compris en SaaS / web, doit fournir le code source aux utilisateurs.

La partie Csound (`shaman.csd`, `render.sh`) reste utilisable indépendamment ; Csound est sous LGPL-2.1+.

## Crédits

- Sample frame drum : [Freesound 116678](https://freesound.org/s/116678/)
- Runtime [Strudel](https://strudel.cc) (Felix Roos & contributeurs, AGPL-3.0)
- Moteur audio [Csound](https://csound.com) (LGPL-2.1+)
