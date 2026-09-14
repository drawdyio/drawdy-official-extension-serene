# Serene

Play your drawing.

Right-click anything on a Drawdy board and pick **Serene play**. A playhead
sweeps left to right across the region at a constant rate — a wider region
takes proportionally longer — and every stroke it crosses rings out as a sine
tone struck hard on the attack, then decaying into a long reverb tail.

Pitch comes from height: the bottom of the region is **C4**, the top is **C7**,
and everything between snaps to a rung of the chosen scale, so nothing lands on
an interval you did not ask for no matter what you drew.

## Scales

Pick one in the panel. Every scale spans the same three octaves, C4 to C7, so
switching changes the colour and the number of rungs, never the range.

| Scale | Degrees | Rows |
| --- | --- | --- |
| C major pentatonic (default) | C D E G A | 16 |
| C major | C D E F G A B | 22 |
| C dorian | C D E&#9837; F G A B&#9837; | 22 |
| C lydian | C D E F&#9839; G A B | 22 |
| C mixolydian | C D E F G A B&#9837; | 22 |
| Japanese hirajoshi | C D E&#9837; G A&#9837; | 16 |

A seven-note scale gives the playhead more rungs to cross in the same height,
so the same drawing has finer pitch resolution and more steps in a slide.

## What gets played

`Serene play` resolves a region in this order:

1. the current selection — if a frame is selected, the frame's bounds
2. otherwise whatever sits under the cursor when you right-clicked (an
   enclosing frame wins over a single element)
3. otherwise the whole board

Everything intersecting that region becomes ink. Shapes contribute their
outline, freedraw and lines their stroke, text and images their bounding box.

Containers are staging, not content, so they stay silent: frames always, and
any element you pointed at whose bounds enclose everything else in the region —
a rectangle drawn around a sketch would otherwise drone its own four edges over
the thing it frames. A container is only played when it is the only thing there.

## Legato

Connected ink is one voice. Each polyline is split into runs that are monotonic
in x, and each run becomes a single oscillator that is struck once and then
*slides* — the pitch moves as the playhead climbs or falls along the stroke,
without a new attack. A horizontal stroke holds one note. A diagonal glides
from row to row. A circle is two arcs, one sweeping down to the bottom and back,
one up to the top and back. A vertical stroke covers one column and becomes a
fast glissando through every row it crosses.

Separate strokes still stack into chords, and a stroke that doubles back on
itself starts a new voice at the turn, because the playhead has already passed
that x.

Pitch breakpoints land on the column grid, so every step is a scale degree.
The **Glide** control sets how much of the gap between two breakpoints is spent
sliding: at 0 the voice steps cleanly from degree to degree, at 1 it is a
continuous portamento that passes through the pitches in between.

The region is rasterized onto a grid of the scale's pitch rows by
`durationSec * stepsPerSecond` columns, which drives note timing and the voice
velocities. Voices that start on the same column are
thinned to `maxVoices`, keeping the outermost ones so a chord keeps its shape.

## Panel

The extension rail opens a transport panel with play/stop, a speed slider
(px per second — this is what sets the duration), volume, glide and reverb.

Dry and reverb sum into a mix bus that runs through a limiter before the volume
control: a dense passage stacks five voices per column on top of the tails of
everything the playhead just passed, which sums past full scale and clips. The
limiter is a hard-knee compressor at -3 dB with a 20:1 ratio, a 2 ms attack and
a 180 ms release, followed by a fixed `LIMIT_TRIM` of 0.821 that cancels the
makeup gain `DynamicsCompressorNode` applies on its own — without it the
limiter would make everything *below* the threshold 1.22x louder instead of
only catching the peaks. Volume sits after the trim, so turning up cannot drive
the limiter harder.

Measured offline in Chromium against the real graph: a single voice and a
five-voice chord come through untouched (0.169 and 0.681 peak either way),
while a 3-second run of five voices per column peaks at 1.168 with hundreds of
clipped samples unlimited, and 0.796 with none through the limiter.

Audio lives in the panel's webview, which runs in a sandboxed opaque-origin
iframe. Browsers require one real click inside that frame before a page may
make sound, so the first play has to come from the panel's ▶ button. After
that, `Serene play` from the context menu starts playback on its own.

## Develop

```bash
pnpm install --ignore-workspace
pnpm dev          # serves /built.drawdyx for the "Add extension dev server" palette command
pnpm test
pnpm typecheck
pnpm build        # dist/drawdy-serene.drawdyx, also copied into frontend/public/extensions
```
