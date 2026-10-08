# Changelog

## 1.4.1

### Panel

- Redesigned panel to match Drawdy, in light and dark themes.
- Scale is a dropdown with a one-line description for each scale; resting on an option plays a short preview of it.
- New scales: Minor pentatonic and Phrygian.
- Range is a C1 to C8 piano keyboard with a handle at each end. Handles snap to C, stay at least an octave apart and play their note as they move; clicking a key moves the nearer handle.
- Backing is now Off, Pop (I vi IV V), Classic (I iii IV V), Simple (I V) or Drone (I), the same in every scale.
- Feel is a collapsible section of sliders: Speed (0.5× to 2.0×), Attack (0 to 1000 ms), Volume and Reverb. Double-click a slider to reset it.
- Frames list with a thumbnail of each frame's strokes, its duration at the current Speed and a play/pause button. Click a row to jump to the frame; double-click its name to rename it.
- With no Serene frames on the board, the panel offers **Create Serene frame** instead of adding one on its own.
- Removed the Voicing and Rhythm options, the separate Backing level, and the panel's big play button, timer and Loop toggle.
- New defaults: Range C3 to C6, Speed 1.0× (a 960 px frame lasts 4.8 s), Volume 70%, Reverb 30%. Saved settings carry over.

### Board

- Each Serene frame has a bar above it with the Serene icon, the frame's name and its time, replacing the play button and seek bar. The bar shrinks when zoomed out and never runs wider than its frame.
- Click the bar to select the frame; double-click it to rename the frame in the panel.
- A time ruler and note labels show while a frame is hovered, selected or playing, and while Range is being adjusted.
- New playhead with a handle on the frame's top edge. Pause keeps the position.
- An empty frame shows "Draw anywhere, then press play." with a **Try a sample** button.
- New frames are named "Serene {n}" and placed to the right of the rightmost Serene frame.
- New icon.

### Requires

- A Drawdy build that supports `meta.hideFrameLabel` and renders `component` preview elements. On older builds Drawdy's own frame label still shows and the frame bar's text does not appear.
