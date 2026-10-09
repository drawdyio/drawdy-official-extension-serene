# Changelog

## 1.4.1

### Panel

- Redesigned panel to match Drawdy, in light and dark themes.
- Scale is a dropdown with a one-line description for each scale; resting on an option plays a short preview of it.
- Range is a C1 to C8 piano keyboard with a handle at each end. Handles snap to C, stay at least an octave apart and play their note as they move; clicking a key moves the nearer handle.
- Backing is a row of tabs: Off, Pop, Classic, Simple and Drone. Each plays the current scale's own progression of that kind (Simple is I V in major and i IV in dorian); a style the scale has no progression for is disabled. Voicing (Bass, No 3rd, Full) and Rhythm (1×, 2×, 4×, Arp ↑, Arp ↓) appear under it while a backing is on. Resting on a style plays a short preview of it.
- Major's I IV and lydian's I V and I II I II progressions are no longer offered; a saved choice of one moves to the first style the scale has.
- Feel is a collapsible section of sliders: Speed (0.5× to 2.0×), Attack, Notes, Backing (while a backing is on) and Reverb. Double-click a slider to reset it.
- Frames list with a thumbnail of each frame's strokes, its duration at the current Speed and a play/pause button. Click a row to jump to the frame; double-click its name to rename it.
- With no Serene frames on the board, the panel offers **Create Serene frame** instead of adding one on its own.
- Removed the panel's big play button, timer and Loop toggle.
- Speed is now a multiplier; 1.0× is the previous default rate of 220 px per second, and a saved speed carries over. The sound, progressions and other defaults are unchanged.

### Board

- Each Serene frame has a bar above it with the Serene icon, the frame's name and its time, replacing the play button and seek bar. The bar shrinks when zoomed out and never runs wider than its frame.
- Click the bar to select the frame; double-click it to rename the frame in the panel.
- A time ruler and note labels show while a frame is hovered, selected or playing, and while Range is being adjusted.
- New playhead with a handle on the frame's top edge. Drag the handle to move the playback position; playback jumps there when you let go. Pause keeps the position.
- An empty frame shows "Draw anywhere, then press play."
- New frames are named "Serene {n}" and placed to the right of the rightmost Serene frame.
- New icon.

### Requires

- A Drawdy build that supports `meta.hideFrameLabel` and renders `component` preview elements. On older builds Drawdy's own frame label still shows and the frame bar's text does not appear.
