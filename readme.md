# Serene

Play your drawing.

Open Serene from the extension rail and it drops a **Serene frame** onto the
board (or offers to add another). Draw inside it, select it, and press the
play button that appears above the frame. A playhead sweeps left to right
across the frame at a constant rate — a wider region
takes proportionally longer — and every stroke it crosses rings out as a sine
tone with a short, tunable attack, then decaying into a long reverb tail.

Pitch comes from height: by default the bottom of the region is **C4** and the
top is **C7**, and the panel's **Range** row lets you move either end anywhere
from C1 to C8. Everything between snaps to a rung of the chosen scale, so nothing lands on
an interval you did not ask for no matter what you drew.

## Scales

Pick one in the panel. Every scale spans the same octave range, so switching
changes the colour and the number of rungs, never the range.

| Scale | Degrees | Rows (C4 to C7) |
| --- | --- | --- |
| C major pentatonic (default) | C D E G A | 16 |
| C major | C D E F G A B | 22 |
| C dorian | C D E&#9837; F G A B&#9837; | 22 |
| C lydian | C D E F&#9839; G A B | 22 |
| C mixolydian | C D E F G A B&#9837; | 22 |
| Japanese hirajoshi | C D E&#9837; G A&#9837; | 16 |

A seven-note scale gives the playhead more rungs to cross in the same height,
so the same drawing has finer pitch resolution and more steps in a slide.

## Serene frames

Only a Serene frame plays. It is an ordinary Drawdy frame tagged with
`meta.serene = true`, so you can move, resize, duplicate and delete it like any
other frame. The first time you open the panel with no Serene frame on the
board, one is added for you at the nearest empty spot around the camera and
the camera flies to it. After that, the panel's **Add another Serene frame**
button does the same.

When exactly one Serene frame is selected, a transport bar floats above its top
edge: a round play button on the left and a seek track spanning the frame's
width, with a knob that follows playback. Press the button to play the frame;
while it plays it turns into a stop button and the bar stays pinned to the
frame being played. Click anywhere on the track to jump there, or drag the knob; a drag lands when you release,
whether the frame is playing or paused, and the voices under the new position
pick up mid-note without a fresh attack. The right-click menu still
offers **Serene play** and **Serene stop** for a selected Serene frame, or for
the Serene frame under the cursor.

## What gets played

The region is the frame's bounds. Everything intersecting that region becomes
ink, and each element's opacity sets the loudness of the voices it produces on a squared
taper — 50% opacity is about 12 dB quieter, 25% about 24 dB — and a fully
transparent one is silent. Laser pointer trails count as ink while they are visible: draw with the
laser inside a playing frame and the trail sounds until it fades. The score follows the board live: drawing, moving or deleting anything
inside the frame, or moving the frame itself, rebuilds the score, and while the
frame is playing the new voices are slotted in ahead of the playhead so a stroke
you add mid-sweep still sounds when the playhead reaches it. Shapes contribute their
outline, freedraw and lines their stroke, text and images their bounding box.

Containers are staging, not content, so they stay silent: frames always, and
any element you pointed at whose bounds enclose everything else in the region —
a rectangle drawn around a sketch would otherwise drone its own four edges over
the thing it frames. A container is only played when it is the only thing there.

## Legato

Glide belongs to strokes. A freehand stroke, a line, an arrow or a laser trail
is one voice: it is split into runs that are monotonic in x, and each run
becomes a single oscillator that is struck once and then *slides* — the pitch
moves as the playhead climbs or falls along that stroke's own geometry, without
a new attack. Glide never crosses from one element to another; separate strokes
are separate voices. Everything else — rectangles, circles, diamonds, text and
image bounds — triggers discrete notes instead: every change of pitch along the
outline is a fresh strike, so a circle rings as a run of plucked notes and a
vertical edge as a quick arpeggio. A horizontal stroke holds one note. A diagonal glides
from row to row. A circle is two arcs, one sweeping down to the bottom and back,
one up to the top and back. A vertical stroke covers one column and becomes a
fast glissando through every row it crosses, but only when it spans three or
more rows in that column; shallower movement snaps to the single degree the
stroke mostly sits on, so a diagonal steps once per column and a dot is one
note. A dot is struck like a mallet: a short tap that rings down on its own
while the reverb carries it.

Separate strokes still stack into chords, and a stroke that doubles back on
itself starts a new voice at the turn, because the playhead has already passed
that x.

Pitch breakpoints land on the column grid, so every step is a scale degree, and
a stroke lands on each degree and then slides into the next one over the last
third of the gap, so you hear the notes the ink crosses and a short portamento
between them rather than a continuous sweep.

The region is rasterized onto a grid of the scale's pitch rows by
`durationSec * stepsPerSecond` columns, which drives note timing and the voice
velocities. Voices that start on the same column are
thinned to `maxVoices`, keeping the outermost ones so a chord keeps its shape.

## Panel

The extension rail opens a transport panel with play/stop, a speed slider
(px per second — this is what sets the duration), attack (0 to 300 ms, default
20 ms — how long each voice takes to reach full level), volume and reverb, a **Loop** toggle that wraps the sweep back to the start without cutting
any tails, and
an **Add Serene frame** button with a count of the frames on the board. Every
knob and the scale are remembered across sessions in the driver's key/value
storage, which is why the manifest asks for the `storage` permission.

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
that, the on-canvas play button and `Serene play` from the context menu start
playback on their own.

## Develop

```bash
pnpm install
pnpm dev          # serves /built.drawdyx for the "Add extension dev server" palette command
pnpm typecheck
pnpm build        # dist/drawdy-serene.drawdyx, also copied into frontend/public/extensions
```
