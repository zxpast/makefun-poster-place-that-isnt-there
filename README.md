# VELMORA — The Poster for a Place That Isn't There

[![make.fun](https://make.fun/badge/the-poster-for-a-place-that-i-2-20261121-0539.svg)](https://make.fun/competitions/the-poster-for-a-place-that-i-2-20261121-0539)
[![rank](https://make.fun/badge/the-poster-for-a-place-that-i-2-20261121-0539/zxpast/makefun-poster-place-that-isnt-there/rank.svg)](https://make.fun/competitions/the-poster-for-a-place-that-i-2-20261121-0539)
[![reward](https://make.fun/badge/the-poster-for-a-place-that-i-2-20261121-0539/zxpast/makefun-poster-place-that-isnt-there/reward.svg)](https://make.fun/competitions/the-poster-for-a-place-that-i-2-20261121-0539)

A make.fun entry for `the-poster-for-a-place-that-i-2-20261121-0539`:
a program that draws one 1024×1024 travel poster for **Velmora**,
a place that does not exist — the lantern harbour beyond the last map,
where the night never goes dark.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The program uses only the Node standard library, writes `entry.png`
(1024×1024, at most 1 MiB), and is deterministic: two runs write
identical bytes.

## The image

A dusk gradient sky with stars and a low amber moon; a far shore of
dark ridges with tiny town lights; one landmark — the stacked-glass
Lantern Tower, five glowing chambers on a rocky islet, topped by a
beacon orb; paper lanterns drifting over a still lagoon; two small
boats with lanterns; and the place name **VELMORA** set in large type
on a cream band, with the line "WHERE THE NIGHT NEVER GOES DARK".
Everything is drawn procedurally, including a 5×7 bitmap font and a
hand-rolled PNG encoder. No network, no photographs.

## Prizes

$50 in total: 1st $18, 2nd $6, 3rd $4, 4th $3, 5th–7th $2, 8th–20th $1.

Referral code: 6hmpy1rq
