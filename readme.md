# Serene

Play your drawing.

Open Serene from the extension rail. On a board with no Serene frame the panel
offers **Create Serene frame**; after that, **New frame** in the panel's Frames
list adds another. Draw inside a frame and press its play button, in the
Frames list or above the selected frame. A playhead sweeps left to right
across the frame at a constant rate — a wider region
takes proportionally longer — and every stroke it crosses rings out as a sine
tone with a short, tunable attack, then decaying into a long reverb tail.

Pitch comes from height: by default the bottom of the region is **C4** and the
top is **C7**, and the panel's **Range** keyboard lets you drag either end to
any C from C1 to C8, at least an octave apart. Everything between snaps to a rung of the chosen scale, so nothing lands on
an interval you did not ask for no matter what you drew.

## Scales

Pick one in the panel. Every scale spans the same octave range, so switching
changes the colour and the number of rungs, never the range.

| Scale | Degrees | Rows (C4 to C7) |
| --- | --- | --- |
| Major pentatonic (default) | C D E G A | 16 |
| Major | C D E F G A B | 22 |
| Dorian | C D E&#9837; F G A B&#9837; | 22 |
| Lydian | C D E F&#9839; G A B | 22 |
| Mixolydian | C D E F G A B&#9837; | 22 |
| Hirajoshi | C D E&#9837; G A&#9837; | 16 |

A seven-note scale gives the playhead more rungs to cross in the same height,
so the same drawing has finer pitch resolution and more steps in a slide.

## Serene frames

Only a Serene frame plays. It is an ordinary Drawdy frame tagged with
`meta.serene = true`, so you can move, resize, duplicate and delete it like any
other frame. The first time you open the panel with no Serene frame on the
board, the panel shows **Create Serene frame**, which adds "Serene 1" centered
in view. **New frame** adds "Serene {n}" 120 px to the right of the rightmost
Serene frame, level with it. Either way the frame is selected and the camera
fits it. Drivers cannot read or set a Drawdy frame's own name, so the Serene
name lives in `meta.serene.name`; frames from before names existed are listed
as "Serene {position}".

Every Serene frame carries a bar above its top-left corner with the Serene
icon, the frame's name and its time: the duration (`0:04.8`) when idle, and
`elapsed / duration` while it plays or is paused part way. When zoomed out
the bar shrinks (to 85% at most) and never runs wider than its frame: it
drops the time, then shortens the name, then shows only the icon. New frames
set `meta.hideFrameLabel` so Drawdy skips its own name chip, and frames from
before that flag existed get it (and their name) the first time Serene lists
them; a Drawdy build without support for the flag still draws its chip under
the bar.

Clicking the bar selects its frame; double-clicking it opens the panel with
that frame's name ready to edit in the Frames list, where a double-click on a
row's name (or F2 on a focused row) does the same. Enter or clicking away
saves, Esc cancels, and an empty name is ignored.

While a frame is hovered, selected or playing, or while Range is being
dragged in the panel (and for 600 ms after), it shows its guides:

- a time ruler along the top edge, with a tick every 0.5 s of playback time
  (Speed applied) and whole seconds longer and labeled (`1s`, `2s`); labels
  thin out when zoomed far out and stop 20 px short of the right edge;
- a label for each C in the Range at the height that C plays (`C4`, `C5`),
  kept clear of the ruler and the bottom edge.

The playhead is a line with a pill-shaped handle straddling the top edge. It
shows on a hovered, selected or active frame and is dimmed at 0 when idle.
Drag the handle to move it: the playhead follows the pointer and playback
jumps there when you let go, whether the frame is playing or paused; on
another frame, that frame is loaded and starts from there on the next play.
The handle is a hit-testable preview, and a large invisible one covers the
view while dragging so the drag never selects or draws on the board.
An empty frame says "Draw anywhere, then press play."

All of it is preview elements, so it pans and zooms with the board and stays
under Drawdy's panels: ticks and the playhead are canvas lines, and the text
(bar, labels, empty state) is `component` previews, DOM on the canvas's widget
layer, so it gets the app's font and the real icon. Drawdy renders component
previews only from the build that includes that change.

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

## Backing track

The panel's **Backing** tabs add a chord progression under the drawing, played
by a soft triangle pad (or plucks when a chord is struck more than once). Pick a
style, then a **Voicing** (Bass: bass only; No
3rd: bass plus root and fifth; Full: the full triad) and a **Rhythm**, which
appear under it while a backing is on. Balance it against the drawing with the
**Notes** and **Backing** sliders under Feel. Rhythm is 1×, 2× or 4× strikes per chord (a single sustained chord is held
for 85% of its slot so chords breathe), or an arpeggio over a sustained bass (Voicing is hidden then). **Arp ↑** runs 1 3 5 1' 3' 5 3 1 through the
triad and its octave, **Arp ↓** is the mirror image starting from the top, and
either pattern plays twice per chord in double time. Arpeggio notes are plain
sines struck with a near-instant attack. The bass sits around C2 and the chord
tones in the C3 octave regardless of the melodic range.

Each style plays the current scale's own progression of that kind, built
diatonically from the scale so chord qualities follow the mode. A style the
scale has no progression for is disabled, and its tooltip shows the chords:

| Scale | Pop | Classic | Simple | Drone |
| --- | --- | --- | --- | --- |
| Major, major pentatonic | I vi IV V | I iii IV V | I V | I |
| Dorian | i III IV | i III/6 IV/6 | i IV | i |
| Lydian | I II V | | I II | I |
| Mixolydian | | I vii | I v | I |
| Hirajoshi | | | | I |

Dorian's **i III/6 IV/6** uses first inversions whose bass walks down from the
tonic (C, G below, A); mixolydian's vii bass steps down to the B♭ below the
tonic rather than up. The major pentatonic is harmonised from the full major
scale. Switching scale keeps the style when the new scale has it, and moves
to the first style it does have otherwise.

The backing is locked to the sweep. A frame up to about 1000 px wide plays the
progression once across its duration; every further 1000 px adds another pass
(nearest multiple, minimum one), so a 2000 px frame plays it twice and a
1500 px frame twice at a brisker pace. Because the chords are ordinary voices in
the score, they follow speed changes, seeks and loops exactly like the ink.

## Panel

The panel holds the settings shared by every Serene frame, and the frames
themselves:

- **Scale**, with a one-line description of each; resting on an option plays
  a short preview of it.
- **Range**, a C1 to C8 keyboard with a handle at each end. Handles snap to C,
  stay an octave apart and play their note as they snap; clicking a key moves
  the nearer handle there. Arrow keys move a focused handle an octave.
- **Backing**: Off, Pop, Classic, Simple or Drone, each the current scale's
  own progression, with **Voicing** and **Rhythm** under it while a backing is
  on (see Backing track). Resting on a style plays one pass of it in the
  current scale, voicing and rhythm.
- **Feel** (collapsed by default, with a summary): **Speed** 0.5&times; to
  2.0&times; on a 220 px per second sweep, so a 960 px frame lasts about 4.4 s
  at 1.0&times;; **Attack** 0 to 300 ms; **Notes**, the level of the drawn
  voices; **Backing**, the level of the backing (only while one is on);
  **Reverb**. Double-click a slider to reset it.
- **Frames**: a row per Serene frame with a thumbnail of its strokes, its
  duration at the current Speed and a play/pause button. Clicking a row selects
  the frame and fits the camera to it.

Every setting is remembered in the driver's key/value storage, which is why
the manifest asks for the `storage` permission. Settings saved before 1.4.1
are migrated: a speed in px per second becomes the nearest multiplier.

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
make sound, so playback starts from the play buttons in the panel's
Frames list.

## Develop

```bash
pnpm install
pnpm dev          # serves /built.drawdyx for the "Add extension dev server" palette command
pnpm typecheck
pnpm build        # dist/drawdy-serene.drawdyx, also copied into frontend/public/extensions
```
