export const PANEL_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@400;500&display=swap" />
<style id="theme">:root{/*__DRAWDY_STYLING__*/}</style>
<style>
/* Figma tokens mapped onto the host's styling variables. Tokens the host
   does not pass through are restated here per theme. */
:root {
    --fg: var(--drawdy-foreground, rgb(0 0 0 / 0.95));
    --fg-2: var(--drawdy-muted-foreground, rgb(0 0 0 / 0.7));
    --fg-3: rgb(0 0 0 / 0.5);
    --fg-disabled: rgb(0 0 0 / 0.3);
    --surface: var(--drawdy-background, #fff);
    --border: var(--drawdy-border, rgb(0 0 0 / 0.1));
    --divider: rgb(0 0 0 / 0.06);
    --hover: rgb(0 0 0 / 0.04);
    --pressed: rgb(0 0 0 / 0.06);
    --track: rgb(0 0 0 / 0.04);
    --layer: rgb(0 0 0 / 0.11);
    --row-selected: rgb(0 0 0 / 0.04);
    --mark: rgb(0 0 0 / 0.1);
    --accent: var(--drawdy-primary, #c5f601);
    --accent-fg: var(--drawdy-accent, #7fae00);
    --accent-subtle: rgb(179 224 0 / 0.3);
    --on-accent: var(--drawdy-primary-foreground, #0a0a0a);
    --ring: var(--drawdy-ring, #b3e000);
    --key-white: var(--surface);
    --key-black: #71717a;
    --grip: #ffffff;
    --tooltip-bg: #52525b;
    --tooltip-fg: #fff;
    --pop-shadow: 0 4px 20px rgb(0 0 0 / 0.1);
    --grip-shadow: 0 1px 3px rgb(0 0 0 / 0.2);
    --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
}
:root[data-theme="dark"] {
    --fg-3: rgb(255 255 255 / 0.5);
    --fg-disabled: rgb(255 255 255 / 0.3);
    --divider: rgb(255 255 255 / 0.06);
    --hover: rgb(255 255 255 / 0.08);
    --pressed: rgb(255 255 255 / 0.02);
    --track: rgb(255 255 255 / 0.04);
    --layer: rgb(255 255 255 / 0.1);
    --row-selected: rgb(255 255 255 / 0.04);
    --mark: rgb(255 255 255 / 0.1);
    --accent-subtle: rgb(179 224 0 / 0.1);
    --tooltip-bg: #3f3f46;
    --pop-shadow: 0 4px 20px rgb(0 0 0 / 0.4);
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { margin: 0; height: 100%; }
body {
    font-family: "Google Sans Flex", "Google Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 12px;
    line-height: 16px;
    color: var(--fg);
    background: var(--surface);
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
}
button { font: inherit; color: inherit; }
:focus { outline: none; }
:focus-visible { outline: 2px solid var(--ring); outline-offset: 1px; }
main {
    height: 100%;
    overflow-y: auto;
    /* Never scroll sideways; edge-aligned controls may bleed a pixel or two. */
    overflow-x: hidden;
    padding: 16px;
    /* The scrollbar's room is always reserved and taken out of the right
       padding, so content keeps its width whether or not the panel scrolls. */
    padding-right: var(--scroll-pad, 16px);
    scrollbar-gutter: stable;
    scrollbar-width: thin;
    scrollbar-color: var(--mark) transparent;
}
.view { display: flex; flex-direction: column; gap: 12px; }
.label { color: var(--fg-2); }
.field { display: flex; flex-direction: column; gap: 8px; position: relative; }
.field-head { display: flex; align-items: center; justify-content: space-between; }
.field-value { color: var(--fg-3); font-variant-numeric: tabular-nums; }
.divider { border: 0; height: 1px; margin: 0; background: var(--divider); }
.chevron {
    width: 16px;
    height: 16px;
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 120ms var(--ease);
}

/* Scale select */
.select-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    height: 36px;
    padding: 0 10px 0 12px;
    color: var(--fg-2);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: background 120ms var(--ease);
}
.select-trigger:hover { background: linear-gradient(var(--hover), var(--hover)), var(--surface); }
.select-trigger:active { background: linear-gradient(var(--pressed), var(--pressed)), var(--surface); }
.select-trigger[aria-expanded="true"] .chevron { transform: rotate(180deg); }
.select-list {
    position: absolute;
    z-index: 5;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    padding: 4px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--pop-shadow);
    animation: drop 120ms var(--ease);
}
@keyframes drop {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: none; }
}
.option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 120ms var(--ease);
}
.option.active { background: var(--hover); }
.option:active { background: var(--pressed); }
.option-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.option-desc { color: var(--fg-3); font-size: 11px; line-height: 14px; }
.check {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: var(--fg);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    visibility: hidden;
}
.option[aria-selected="true"] .check { visibility: visible; }

/* Range piano */
.piano {
    position: relative;
    height: 40px;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--key-white);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;
}
.keys { position: absolute; inset: 0; }
.key { position: absolute; top: 0; }
.key.white {
    bottom: 0;
    background: var(--key-white);
    box-shadow: inset -1px 0 0 var(--divider);
}
.key.white:last-child { box-shadow: none; }
.key.black {
    z-index: 1;
    height: 60%;
    width: calc(100% / 50 * 0.64);
    transform: translateX(-50%);
    background: var(--key-black);
}
/* In range: a flat accent bar across the key's square bottom edge. */
.key.black::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: var(--accent);
    opacity: 0;
    transition: opacity 120ms var(--ease);
}
.key.black.in-range::after { opacity: 1; }
.band {
    position: absolute;
    z-index: 2;
    top: 0;
    bottom: 0;
    background: var(--accent-subtle);
    pointer-events: none;
}
.handle {
    position: absolute;
    z-index: 3;
    top: 0;
    bottom: 0;
    width: 16px;
    margin-left: -8px;
    cursor: ew-resize;
    border-radius: 6px;
}
.handle::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 7px;
    width: 2px;
    background: var(--accent);
}
.grip {
    position: absolute;
    top: 50%;
    left: 2px;
    width: 12px;
    height: 20px;
    margin-top: -8px;
    border-radius: 6px;
    background: var(--grip);
    box-shadow: 0 0 0 1px var(--border), var(--grip-shadow);
    transition: transform 120ms var(--ease);
}
.grip::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    transition: background 120ms var(--ease);
}
.handle:hover .grip, .handle.dragging .grip { transform: scale(1.15); }
.handle:hover .grip::after { background: var(--hover); }
.handle.dragging .grip::after { background: var(--pressed); }
.handle:focus-visible { outline: none; }
.handle:focus-visible .grip { outline: 2px solid var(--ring); outline-offset: 1px; }
.piano-labels { position: relative; height: 16px; margin-top: 6px; color: var(--fg-3); }
.key-label {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    transition: color 120ms var(--ease);
}
.key-label.first { transform: none; }
.key-label.last { left: auto !important; right: 0; transform: none; }
.key-label.end { color: var(--accent-fg); }

/* Backing segmented control */
.segmented {
    display: flex;
    height: 28px;
    padding: 2px;
    gap: 2px;
    background: var(--track);
    border-radius: 8px;
}
.segment {
    flex: 1;
    min-width: 0;
    padding: 0 4px;
    color: var(--fg-3);
    background: transparent;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
    transition: background 120ms var(--ease), color 120ms var(--ease);
}
.segment:hover { color: var(--fg); background: var(--hover); }
.segment:active { background: var(--pressed); }
.segment[aria-checked="true"] { color: var(--fg); background: var(--layer); font-weight: 500; }
.segment[aria-checked="true"]:hover { background: linear-gradient(var(--hover), var(--hover)), var(--layer); }
.segment:disabled { color: var(--fg-disabled); cursor: default; background: transparent; }
.segment[aria-checked="true"]:disabled { background: var(--layer); }

/* Collapsible sections */
.section-head {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 24px;
    padding: 0;
    color: var(--fg-2);
    background: transparent;
    border: 0;
    border-radius: 6px;
    text-align: left;
}
button.section-head { cursor: pointer; }
.section-title { flex: 1; }
.feel-summary { color: var(--fg-3); font-variant-numeric: tabular-nums; }
.feel.open .feel-summary { display: none; }
.feel:not(.open) .section-head .chevron { transform: rotate(-90deg); }
.feel .section-head .chevron { transition-duration: 180ms; }
.feel-body {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 180ms var(--ease);
}
.feel.open .feel-body { grid-template-rows: 1fr; }
.feel-inner { min-height: 0; overflow: hidden; }
.sliders { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; }

/* Feel sliders: label inside on the left, value on the right */
.slider {
    position: relative;
    height: 28px;
    border-radius: 8px;
    background: var(--track);
    cursor: ew-resize;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
}
.slider::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    transition: background 120ms var(--ease);
}
.slider:hover::after { background: var(--hover); }
.slider:focus-visible { outline-offset: 1px; }
.s-fill {
    position: absolute;
    top: 2px;
    bottom: 2px;
    left: 2px;
    border-radius: 6px;
    background: var(--layer);
}
.slider.active .s-fill { background: linear-gradient(var(--pressed), var(--pressed)), var(--layer); }
.s-marks { position: absolute; inset: 0; pointer-events: none; }
.s-tick, .s-dot { position: absolute; top: 50%; background: var(--mark); }
.s-tick { width: 1px; height: 8px; margin: -4px 0 0 -0.5px; }
.s-dot { width: 2px; height: 2px; margin: -1px 0 0 -1px; border-radius: 1px; }
.s-label {
    position: absolute;
    top: 6px;
    left: 10px;
    font-weight: 500;
    pointer-events: none;
}
.s-value {
    position: absolute;
    top: 6px;
    right: 10px;
    text-align: right;
    color: var(--fg-3);
    font-variant-numeric: tabular-nums;
    pointer-events: none;
    white-space: nowrap;
    transition: color 120ms ease;
}
.slider.active .s-value { color: var(--fg); }
.s-indicator {
    position: absolute;
    top: 8px;
    left: 0;
    width: 2px;
    height: 12px;
    border-radius: 1px;
    background: var(--fg-3);
    pointer-events: none;
    transition: background-color 120ms ease, width 120ms ease, margin 120ms ease;
}
.slider.active .s-indicator { background-color: var(--fg); width: 3px; margin-left: -0.5px; }
.slider.disabled { cursor: default; }
.slider.disabled .s-label, .slider.disabled .s-value { color: var(--fg-disabled); }
.slider.disabled .s-indicator { background: var(--fg-disabled); }
.measure { position: absolute; visibility: hidden; white-space: nowrap; font-variant-numeric: tabular-nums; }

/* Frames */
.frames { display: flex; flex-direction: column; gap: 8px; }
.text-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    margin-right: -6px;
    padding: 0 6px;
    color: var(--fg-2);
    background: transparent;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
    transition: background 120ms var(--ease), color 120ms var(--ease);
}
.text-action svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; }
.text-action:hover { color: var(--fg); background: var(--hover); }
.text-action:active { background: var(--pressed); }
.text-action:disabled { color: var(--fg-disabled); background: transparent; cursor: default; }
.frame-list { list-style: none; margin: 0 -4px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.frame-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px;
    border-radius: 10px;
    cursor: pointer;
    transition: background 120ms var(--ease);
}
.frame-row.selected { background: var(--row-selected); }
.frame-row:hover { background: var(--hover); }
.frame-row.selected:hover { background: linear-gradient(var(--hover), var(--hover)), var(--row-selected); }
.frame-row:active { background: var(--pressed); }
.thumb {
    flex: none;
    display: grid;
    place-items: center;
    width: 54px;
    height: 36px;
    padding: 3px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
}
.thumb svg { width: 100%; height: 100%; display: block; }
.thumb path {
    fill: none;
    stroke: var(--fg);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
}
.frame-text { flex: 1; min-width: 0; }
.frame-name { display: flex; align-items: center; gap: 6px; }
.name-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.name-input {
    flex: 1;
    min-width: 0;
    height: 20px;
    margin: -2px 0 -2px -4px;
    padding: 0 4px;
    font: inherit;
    color: var(--fg);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    outline: none;
}
.name-input:focus-visible, .name-input:focus { box-shadow: 0 0 0 2px var(--ring); }
.frame-dur { color: var(--fg-3); font-variant-numeric: tabular-nums; }
.eq { display: none; align-items: flex-end; gap: 1.5px; height: 10px; }
.frame-row.playing .eq { display: inline-flex; }
.eq i { width: 2px; height: 100%; border-radius: 1px; background: var(--fg-2); transform-origin: bottom; animation: eq 700ms ease-in-out infinite; }
.eq i:nth-child(2) { animation-delay: -240ms; }
.eq i:nth-child(3) { animation-delay: -470ms; }
@keyframes eq {
    0%, 100% { transform: scaleY(0.3); }
    50% { transform: scaleY(1); }
}
.icon-btn {
    flex: none;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    color: var(--fg-2);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: background 120ms var(--ease), color 120ms var(--ease);
}
.icon-btn svg { width: 12px; height: 12px; fill: currentColor; }
.icon-btn:hover { color: var(--fg); background: linear-gradient(var(--hover), var(--hover)), var(--surface); }
.icon-btn:active { background: linear-gradient(var(--pressed), var(--pressed)), var(--surface); }
.icon-btn[aria-pressed="true"] { color: var(--fg); background: var(--layer); }
.icon-btn[aria-pressed="true"]:hover { background: linear-gradient(var(--hover), var(--hover)), var(--layer); }
.icon-btn:disabled { color: var(--fg-disabled); cursor: default; background: var(--surface); }
.icon-btn.attention { animation: attention 1.4s ease-in-out infinite; }
@keyframes attention {
    0%, 100% { box-shadow: 0 0 0 0 var(--accent-subtle); }
    50% { box-shadow: 0 0 0 5px var(--accent-subtle); }
}

/* First use */
.first-use {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px 16px 40px;
    text-align: center;
    animation: fade 180ms var(--ease);
}
.logo-tile { width: 48px; height: 48px; border-radius: 12px; margin-bottom: 8px; }
.first-use h1 { margin: 0; font-size: 14px; line-height: 20px; font-weight: 500; }
.first-use p { margin: 0 0 8px; color: var(--fg-2); }
.primary {
    height: 32px;
    padding: 0 14px;
    font-weight: 500;
    color: var(--on-accent);
    background: var(--accent);
    border: 0;
    border-radius: 8px;
    cursor: pointer;
    transition: background 120ms var(--ease);
}
.primary:hover { background: linear-gradient(rgb(0 0 0 / 0.06), rgb(0 0 0 / 0.06)), var(--accent); }
.primary:active { background: linear-gradient(rgb(0 0 0 / 0.1), rgb(0 0 0 / 0.1)), var(--accent); }
.primary:disabled { opacity: 0.5; cursor: default; }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }

.tooltip {
    position: fixed;
    z-index: 10;
    max-width: 220px;
    padding: 4px 8px;
    font-size: 11px;
    line-height: 14px;
    color: var(--tooltip-fg);
    background: var(--tooltip-bg);
    border-radius: 6px;
    pointer-events: none;
    animation: fade 120ms var(--ease);
}
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
}
</style>
</head>
<body>
<main>
<div class="view" id="full" hidden>
    <div class="field" id="scale-field">
        <span class="label" id="scale-label">Scale</span>
        <button type="button" class="select-trigger" id="scale-trigger" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="scale-label scale-value">
            <span id="scale-value"></span>
            <svg class="chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>
        </button>
        <div class="select-list" id="scale-list" role="listbox" aria-labelledby="scale-label" tabindex="-1" hidden></div>
    </div>

    <div class="field">
        <div class="field-head">
            <span class="label" id="range-label">Range</span>
            <span class="field-value" id="range-value"></span>
        </div>
        <div>
            <div class="piano" id="piano">
                <div class="keys" id="keys"></div>
                <div class="band" id="band"></div>
                <div class="handle" id="handle-low" role="slider" tabindex="0" aria-label="Lowest note"><span class="grip"></span></div>
                <div class="handle" id="handle-high" role="slider" tabindex="0" aria-label="Highest note"><span class="grip"></span></div>
            </div>
            <div class="piano-labels" id="piano-labels" aria-hidden="true"></div>
        </div>
    </div>

    <div class="field">
        <span class="label" id="backing-label">Backing</span>
        <div class="segmented" id="backing" role="radiogroup" aria-labelledby="backing-label"></div>
    </div>

    <div class="field" id="voicing-field" hidden>
        <span class="label" id="voicing-label">Voicing</span>
        <div class="segmented" id="voicing" role="radiogroup" aria-labelledby="voicing-label"></div>
    </div>

    <div class="field" id="rhythm-field" hidden>
        <span class="label" id="rhythm-label">Rhythm</span>
        <div class="segmented" id="rhythm" role="radiogroup" aria-labelledby="rhythm-label"></div>
    </div>

    <hr class="divider" />

    <section class="feel" id="feel">
        <button type="button" class="section-head" id="feel-toggle" aria-expanded="false" aria-controls="feel-body">
            <span class="section-title">Feel</span>
            <span class="feel-summary" id="feel-summary"></span>
            <svg class="chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>
        </button>
        <div class="feel-body" id="feel-body">
            <div class="feel-inner"><div class="sliders" id="sliders"></div></div>
        </div>
    </section>

    <hr class="divider" />

    <section class="frames">
        <div class="section-head">
            <span class="section-title">Frames</span>
            <button type="button" class="text-action" id="new-frame">
                <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2.5v9M2.5 7h9"/></svg>New frame
            </button>
        </div>
        <ul class="frame-list" id="frame-list"></ul>
    </section>

</div>

<div class="first-use" id="first-use" hidden>
    <img class="logo-tile" src="__SERENE_ICON__" alt="" />
    <h1>Turn drawings into music</h1>
    <p>Draw inside a Serene frame and press play.</p>
    <button type="button" class="primary" id="create-frame">Create Serene frame</button>
</div>
</main>
<div class="tooltip" id="tooltip" role="tooltip" hidden></div>
<script>
(function () {
    var api = acquireDrawdyApi();
    var root = document.documentElement;
    var themeStyle = document.getElementById("theme");

    var BASE_PX_PER_SECOND = 220;
    var MIN_OCTAVE = 1;
    var MAX_OCTAVE = 8;
    var WHITE_KEYS = 50;
    var THUMB_WIDTH = 160;
    var PLAY_ICON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 2.2v7.6L9.8 6z"/></svg>';
    var PAUSE_ICON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 2.5h2v7H3zM7 2.5h2v7H7z"/></svg>';

    var settings = {
        speed: 1,
        attack: 0.02,
        notes: 0.8,
        backingLevel: 0.7,
        reverb: 0.38,
        scale: "major-pentatonic",
        lowOctave: 4,
        highOctave: 7,
        loop: false,
        backing: { enabled: false, style: "pop", voicing: "full", rhythm: 1 },
    };
    var attentionId = null;

    function applyTheme(css) {
        root.setAttribute("data-theme", css.indexOf("color-scheme: dark") >= 0 ? "dark" : "light");
    }
    applyTheme(themeStyle.textContent);

    var LOOKAHEAD = 0.25;
    var PROGRESS_MS = 33;
    var DECAY = 0.22;
    var MIN_ATTACK = 0.002;
    var LATE_FADE_IN = 0.02;
    var SUSTAIN_RATIO = 0.45;
    var RELEASE = 0.55;
    var PERCUSSIVE_TAU = 0.32;
    var BACKING_GAIN = 0.55;
    var BACKING_SUSTAIN = 0.7;
    var BACKING_PAD_ATTACK = 0.09;
    var BACKING_PLUCK_ATTACK = 0.006;
    var BACKING_PAD_MIN_SEC = 1.2;
    var BACKING_CUTOFF = 1100;
    var ARP_GAIN = 0.7;
    var ARP_SUSTAIN = 0.4;
    var ARP_ATTACK = 0.003;
    var GLIDE_PORTION = 0.35;
    var MAX_GLIDE = 0.3;
    var PEAK_GAIN = 0.2;
    var LIMIT_THRESHOLD = -3;
    var LIMIT_RATIO = 20;
    var LIMIT_ATTACK = 0.002;
    var LIMIT_RELEASE = 0.18;
    var LIMIT_TRIM = 0.821;

    var score = null;
    var audio = null;
    var playing = false;
    var startTime = 0;
    var cursor = 0;
    var scheduledUntil = 0;
    var scheduleOrigin = 0;
    var loop = false;
    var voices = [];
    var pumpTimer = null;
    var progressTimer = null;
    var elapsed = 0;

    function audioUnlocked() {
        return Boolean(audio) && audio.ctx.state === "running";
    }

    function makeImpulse(ctx, seconds, decay) {
        var rate = ctx.sampleRate;
        var length = Math.max(1, Math.floor(rate * seconds));
        var buffer = ctx.createBuffer(2, length, rate);
        for (var channel = 0; channel < 2; channel++) {
            var data = buffer.getChannelData(channel);
            for (var i = 0; i < length; i++) {
                var fade = Math.pow(1 - i / length, decay);
                data[i] = (Math.random() * 2 - 1) * fade;
            }
        }
        return buffer;
    }

    function ensureAudio() {
        if (audio) return audio;
        var Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        var ctx = new Ctor();
        var master = ctx.createGain();
        master.gain.value = 1;
        master.connect(ctx.destination);
        var trim = ctx.createGain();
        trim.gain.value = LIMIT_TRIM;
        trim.connect(master);
        var limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = LIMIT_THRESHOLD;
        limiter.knee.value = 0;
        limiter.ratio.value = LIMIT_RATIO;
        limiter.attack.value = LIMIT_ATTACK;
        limiter.release.value = LIMIT_RELEASE;
        limiter.connect(trim);
        var mix = ctx.createGain();
        mix.connect(limiter);
        var dry = ctx.createGain();
        dry.gain.value = 0.85;
        dry.connect(mix);
        var send = ctx.createDelay(0.5);
        send.delayTime.value = 0.024;
        var tone = ctx.createBiquadFilter();
        tone.type = "lowpass";
        tone.frequency.value = 3200;
        var convolver = ctx.createConvolver();
        convolver.buffer = makeImpulse(ctx, 2.8, 2.6);
        var wet = ctx.createGain();
        wet.gain.value = settings.reverb;
        send.connect(tone);
        tone.connect(convolver);
        convolver.connect(wet);
        wet.connect(mix);
        audio = {
            ctx: ctx,
            master: master,
            trim: trim,
            limiter: limiter,
            mix: mix,
            dry: dry,
            send: send,
            wet: wet
        };
        return audio;
    }

    function resumeAudio() {
        var a = ensureAudio();
        if (!a) return Promise.resolve(false);
        if (a.ctx.state === "running") return Promise.resolve(true);
        return a.ctx.resume().then(
            function () { return a.ctx.state === "running"; },
            function () { return false; }
        );
    }

    function tilt(hz) {
        var v = Math.pow(440 / Math.max(110, hz), 0.35);
        return Math.max(0.5, Math.min(1.25, v));
    }

    function meanHz(pitches) {
        var total = 0;
        for (var i = 0; i < pitches.length; i++) total += pitches[i].hz;
        return total / pitches.length;
    }

    function schedulePitches(osc, at, pitches, resumeAt, allowGlide) {
        var prevTime = at;
        var prevHz = pitches[0].hz;
        if (resumeAt !== undefined) {
            prevTime = resumeAt;
            prevHz = osc.frequency.value;
        }
        osc.frequency.setValueAtTime(prevHz, prevTime);
        for (var i = 1; i < pitches.length; i++) {
            var when = at + pitches[i].t;
            if (when <= prevTime) continue;
            var span = when - prevTime;
            var slide = allowGlide ? Math.min(span * GLIDE_PORTION, MAX_GLIDE) : 0;
            if (slide > 0.004) {
                if (slide < span) {
                    osc.frequency.setValueAtTime(prevHz, when - slide);
                }
                osc.frequency.exponentialRampToValueAtTime(
                    pitches[i].hz,
                    when
                );
            } else {
                osc.frequency.setValueAtTime(pitches[i].hz, when);
            }
            prevTime = when;
            prevHz = pitches[i].hz;
        }
    }

    function voiceKey(note, px) {
        var parts = [note.b ? "b" : "i", Math.round(note.t * px), Math.round((note.t + note.d) * px)];
        for (var i = 0; i < note.pitches.length; i++) {
            parts.push(Math.round(note.pitches[i].hz) + "@" + Math.round(note.pitches[i].t * px));
        }
        return parts.join("|");
    }

    function holdFor(note) {
        return Math.max(0.09, note.d);
    }

    function releaseAt(gain, end) {
        gain.gain.setTargetAtTime(0.0001, end, RELEASE / 3);
    }

    // Freeze a param at its current value and drop everything scheduled after
    // now. Plain cancelScheduledValues() would also delete a ramp that is in
    // progress, snapping the param back to the value before the ramp (0 during
    // an attack, the peak during a decay), which is a loud click.
    function holdParam(param, now) {
        if (typeof param.cancelAndHoldAtTime === "function") {
            param.cancelAndHoldAtTime(now);
            return param.value;
        }
        var level = param.value;
        param.cancelScheduledValues(now);
        param.setValueAtTime(level, now);
        return level;
    }

    function scheduleEnvelope(gain, at, peak, sustain, attack, end) {
        var param = gain.gain;
        var attackEnd = at + attack;
        var decayEnd = attackEnd + DECAY;
        var releaseStart = Math.max(end, attackEnd);
        param.setValueAtTime(0, at);
        param.linearRampToValueAtTime(peak, attackEnd);
        if (releaseStart >= decayEnd) {
            param.exponentialRampToValueAtTime(sustain, decayEnd);
            if (releaseStart > decayEnd) param.setValueAtTime(sustain, releaseStart);
        } else {
            var frac = (releaseStart - attackEnd) / DECAY;
            var level = peak * Math.pow(sustain / peak, frac);
            param.exponentialRampToValueAtTime(Math.max(0.0001, level), releaseStart);
        }
        var percussive = end - at < attack + DECAY;
        var tau = percussive ? PERCUSSIVE_TAU : RELEASE / 3;
        param.setTargetAtTime(0.0001, releaseStart, tau);
        return releaseStart + tau * 6;
    }

    function playVoice(note, origin) {
        var ctx = audio.ctx;
        var now = ctx.currentTime;
        var at = (origin === undefined ? startTime : origin) + note.t;
        var peak = Math.max(
            0.0005,
            note.v * PEAK_GAIN * tilt(meanHz(note.pitches))
        );
        if (note.b) peak *= (note.a ? ARP_GAIN : BACKING_GAIN) * settings.backingLevel;
        else peak *= settings.notes;
        var sustainRatio = note.a ? ARP_SUSTAIN : note.b ? BACKING_SUSTAIN : SUSTAIN_RATIO;
        var sustain = Math.max(0.0004, peak * sustainRatio);
        var end = Math.max(now, at + holdFor(note));
        var attack = note.a
            ? ARP_ATTACK
            : note.b
              ? (note.d >= BACKING_PAD_MIN_SEC ? BACKING_PAD_ATTACK : BACKING_PLUCK_ATTACK)
              : Math.max(MIN_ATTACK, settings.attack);
        var osc = ctx.createOscillator();
        osc.type = note.b && !note.a ? "triangle" : "sine";
        schedulePitches(osc, at, note.pitches, undefined, note.g);
        var gain = ctx.createGain();
        var source = osc;
        if (note.b && !note.a) {
            var cutoff = ctx.createBiquadFilter();
            cutoff.type = "lowpass";
            cutoff.frequency.value = BACKING_CUTOFF;
            cutoff.Q.value = 0.6;
            osc.connect(cutoff);
            source = cutoff;
        }
        var stopAt;
        if (at >= now) {
            stopAt = scheduleEnvelope(gain, at, peak, sustain, attack, end);
        } else {
            // Joining a note that is already under way: ease in instead of
            // stepping straight to the sustain level.
            var joined = now + LATE_FADE_IN;
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(sustain, joined);
            end = Math.max(end, joined);
            releaseAt(gain, end);
            stopAt = end + RELEASE * 3;
        }
        source.connect(gain);
        gain.connect(audio.dry);
        gain.connect(audio.send);
        osc.start(Math.max(at, now));
        osc.stop(stopAt);
        var voice = {
            osc: osc,
            gain: gain,
            sustain: sustain,
            start: at,
            end: end,
            key: voiceKey(note, score.pxPerSecond),
            dead: false,
        };
        voices.push(voice);
        osc.onended = function () {
            var index = voices.indexOf(voice);
            if (index >= 0) voices.splice(index, 1);
        };
    }

    function retimeVoice(voice, note) {
        var ctx = audio.ctx;
        var now = ctx.currentTime;
        var at = startTime + note.t;
        var end = Math.max(now, at + holdFor(note));
        holdParam(voice.osc.frequency, now);
        schedulePitches(voice.osc, at, note.pitches, now, note.g);
        var level = holdParam(voice.gain.gain, now);
        if (level > voice.sustain * 1.02) {
            voice.gain.gain.linearRampToValueAtTime(
                voice.sustain,
                Math.min(end, now + DECAY)
            );
        }
        releaseAt(voice.gain, end);
        voice.osc.stop(end + RELEASE * 3);
        voice.start = at;
        voice.end = end;
        voice.key = voiceKey(note, score.pxPerSecond);
    }

    function fadeVoice(voice, now) {
        voice.dead = true;
        var index = voices.indexOf(voice);
        if (index >= 0) voices.splice(index, 1);
        try {
            var param = voice.gain.gain;
            if (voice.start > now) {
                // Not sounding yet. Cancelling its envelope would leave the
                // gain at the node default of 1, so pin it to silence.
                param.cancelScheduledValues(0);
                param.setValueAtTime(0, now);
                voice.osc.stop(Math.max(now, voice.start) + 0.005);
                return;
            }
            holdParam(param, now);
            param.setTargetAtTime(0.0001, now, 0.03);
            voice.osc.stop(now + 0.25);
        } catch (err) {
            void err;
        }
    }

    function killVoices() {
        if (!audio) return;
        var now = audio.ctx.currentTime;
        var live = voices.slice();
        for (var i = 0; i < live.length; i++) fadeVoice(live[i], now);
    }

    function reconcileVoices() {
        var now = audio.ctx.currentTime;
        var nowT = now - startTime;
        var px = score.pxPerSecond;
        var wanted = {};
        for (var i = 0; i < score.voices.length; i++) {
            var note = score.voices[i];
            if (note.t <= nowT && nowT < note.t + holdFor(note)) {
                wanted[voiceKey(note, px)] = note;
            }
        }
        var live = voices.slice();
        for (var j = 0; j < live.length; j++) {
            var voice = live[j];
            if (voice.dead) continue;
            if (voice.start > now) {
                fadeVoice(voice, now);
                continue;
            }
            if (voice.end <= now) continue;
            var match = wanted[voice.key];
            if (match) {
                retimeVoice(voice, match);
                delete wanted[voice.key];
            } else {
                fadeVoice(voice, now);
            }
        }
        Object.keys(wanted).forEach(function (key) {
            playVoice(wanted[key]);
        });
    }

    function advanceLoop(now) {
        var duration = score.durationSec;
        if (duration <= 0) return;
        while (now - startTime >= duration) startTime += duration;
        if (scheduleOrigin < startTime) {
            scheduleOrigin = startTime;
            cursor = 0;
        }
    }

    function pump() {
        if (!playing || !score) return;
        var now = audio.ctx.currentTime;
        var duration = score.durationSec;
        if (loop) {
            advanceLoop(now);
        } else if (now - startTime >= duration) {
            finish();
            return;
        }
        var horizon = now + LOOKAHEAD;
        scheduledUntil = horizon;
        while (true) {
            while (
                cursor < score.voices.length &&
                scheduleOrigin + score.voices[cursor].t < horizon
            ) {
                playVoice(score.voices[cursor], scheduleOrigin);
                cursor++;
            }
            if (!loop || duration <= 0 || scheduleOrigin + duration > horizon) break;
            scheduleOrigin += duration;
            cursor = 0;
        }
    }

    function tickProgress() {
        if (!playing || !score) return;
        elapsed = currentElapsed();
        api.postMessage({ type: "progress", t: elapsed });
    }

    function rewindScheduling(now) {
        scheduleOrigin = startTime;
        scheduledUntil = now;
        cursor = firstVoiceAtOrAfter(now - startTime);
    }

    function currentElapsed() {
        return Math.max(
            0,
            Math.min(score.durationSec, audio.ctx.currentTime - startTime)
        );
    }

    // An empty frame still plays: the playhead sweeps it in silence.
    function start() {
        if (!score) return;
        resumeAudio().then(function (ok) {
            if (!ok) {
                markAttention(score.frameIds[0]);
                return;
            }
            stopTimers();
            killVoices();
            var from = elapsed > 0 && elapsed < score.durationSec ? elapsed : 0;
            var now = audio.ctx.currentTime;
            startTime = now + 0.12 - from;
            elapsed = from;
            rewindScheduling(now);
            attentionId = null;
            setPlaying(true);
            api.postMessage({ type: "started" });
            pumpTimer = setInterval(pump, 25);
            progressTimer = setInterval(tickProgress, PROGRESS_MS);
            reconcileVoices();
            pump();
        });
    }

    function stopTimers() {
        if (pumpTimer) clearInterval(pumpTimer);
        if (progressTimer) clearInterval(progressTimer);
        pumpTimer = null;
        progressTimer = null;
    }

    function stop(reason) {
        if (!playing) return;
        stopTimers();
        killVoices();
        setPlaying(false);
        elapsed = 0;
        api.postMessage({ type: reason });
    }

    // Holds the position; the next start() resumes from it.
    function pause() {
        if (!playing) return;
        elapsed = currentElapsed();
        stopTimers();
        killVoices();
        setPlaying(false);
        api.postMessage({ type: "progress", t: elapsed });
        api.postMessage({ type: "paused" });
    }

    function finish() {
        if (!playing) return;
        stopTimers();
        fadePendingVoices(audio.ctx.currentTime);
        setPlaying(false);
        elapsed = 0;
        api.postMessage({ type: "ended" });
    }

    function fadePendingVoices(now) {
        var live = voices.slice();
        for (var i = 0; i < live.length; i++) {
            if (live[i].start > now) fadeVoice(live[i], now);
        }
    }

    function setLoop(next) {
        loop = Boolean(next);
        if (!loop && playing && audio) {
            var now = audio.ctx.currentTime;
            fadePendingVoices(now);
            rewindScheduling(now);
        }
    }

    function setPlaying(next) {
        playing = next;
        renderRowStates();
    }

    function warpToSpeed(nextSpeed, now) {
        var oldSpeed = score.pxPerSecond;
        if (nextSpeed === oldSpeed) return;
        var playheadPx = (now - startTime) * oldSpeed;
        startTime = now - playheadPx / nextSpeed;
    }

    function firstVoiceAtOrAfter(t) {
        var index = 0;
        while (index < score.voices.length && score.voices[index].t < t) index++;
        return index;
    }

    function swapScore(next) {
        var now = audio.ctx.currentTime;
        warpToSpeed(next.pxPerSecond, now);
        score = next;
        rewindScheduling(now);
        reconcileVoices();
    }

    function seekTo(t) {
        if (!score) return;
        var target = Math.max(0, Math.min(score.durationSec, t));
        if (!playing) {
            elapsed = target >= score.durationSec ? 0 : target;
            api.postMessage({ type: "progress", t: elapsed });
            return;
        }
        if (target >= score.durationSec) {
            finish();
            return;
        }
        var now = audio.ctx.currentTime;
        killVoices();
        startTime = now - target;
        rewindScheduling(now);
        reconcileVoices();
        elapsed = target;
        api.postMessage({ type: "progress", t: target });
    }


    // ---------------------------------------------------------------- UI

    var fullView = document.getElementById("full");
    var firstUse = document.getElementById("first-use");
    var createFrameBtn = document.getElementById("create-frame");
    var newFrameBtn = document.getElementById("new-frame");

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function formatTime(sec) {
        var tenths = Math.round(Math.max(0, sec) * 10);
        var minutes = Math.floor(tenths / 600);
        var rest = (tenths - minutes * 600) / 10;
        return minutes + ":" + (rest < 10 ? "0" : "") + rest.toFixed(1);
    }

    function unlockAudio() {
        resumeAudio();
    }

    // Browsers only let the panel start sound from a click or key press inside
    // it, so any of them starts the audio, whatever was pressed.
    document.addEventListener("pointerdown", unlockAudio, true);
    document.addEventListener("keydown", unlockAudio, true);

    /**
     * Runs "play" once sound is allowed. Hover is not a gesture, so this asks
     * the browser to start audio and plays only if it agrees: after a click in
     * the panel, or when the host lets the panel autoplay.
     */
    function whenAudible(play) {
        if (audioUnlocked()) {
            play();
            return;
        }
        resumeAudio().then(function (ok) { if (ok) play(); });
    }

    // A short sine pluck at "at" (default now). The gain sits at 0 from
    // creation, so a pluck cancelled before it starts stays silent.
    function pluck(midi, at, level) {
        var ctx = audio.ctx;
        var now = ctx.currentTime;
        var when = Math.max(now, at === undefined ? now : at);
        var osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
        var gain = ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(level * tilt(osc.frequency.value), when + 0.006);
        gain.gain.setTargetAtTime(0.0001, when + 0.06, 0.22);
        osc.connect(gain);
        gain.connect(audio.dry);
        gain.connect(audio.send);
        osc.start(now);
        osc.stop(when + 1.6);
        return { osc: osc, gain: gain };
    }

    // Range snaps; silent until the panel has been clicked.
    function previewNote(midi) {
        if (!audioUnlocked()) return;
        pluck(midi, undefined, 0.16);
    }

    var SCALE_PREVIEW_DELAY_MS = 140;
    var SCALE_PREVIEW_STEP_SEC = 0.11;
    var SCALE_PREVIEW_TONIC = 60;
    var scalePreviewTimer = null;
    var scalePreviewVoices = [];

    function stopScalePreview() {
        clearTimeout(scalePreviewTimer);
        scalePreviewTimer = null;
        if (audio) {
            var now = audio.ctx.currentTime;
            scalePreviewVoices.forEach(function (voice) {
                holdParam(voice.gain.gain, now);
                voice.gain.gain.setTargetAtTime(0.0001, now, 0.02);
                voice.osc.stop(now + 0.15);
            });
        }
        scalePreviewVoices = [];
    }

    // One rising octave of the scale from C4, ending on the C above.
    function playScalePreview(scale) {
        if (!scale || !audioUnlocked()) return;
        var start = audio.ctx.currentTime + 0.02;
        var notes = scale.steps.concat([12]);
        scalePreviewVoices = notes.map(function (step, index) {
            return pluck(SCALE_PREVIEW_TONIC + step, start + index * SCALE_PREVIEW_STEP_SEC, 0.13);
        });
    }

    function scheduleScalePreview(index) {
        stopScalePreview();
        var timer = setTimeout(function () {
            whenAudible(function () {
                // Not if the list closed or moved on while audio was resuming.
                if (scalePreviewTimer !== timer) return;
                scalePreviewTimer = null;
                playScalePreview(scales[index]);
            });
        }, SCALE_PREVIEW_DELAY_MS);
        scalePreviewTimer = timer;
    }

    // ---- Backing preview: resting on a style plays one pass of it

    var BACKING_PREVIEW_DELAY_MS = 220;
    var backingPreviewTimer = null;
    var backingPreviewStyle = null;
    var backingPreviewVoices = [];

    function stopBackingPreview() {
        clearTimeout(backingPreviewTimer);
        backingPreviewTimer = null;
        backingPreviewStyle = null;
        if (audio) {
            var now = audio.ctx.currentTime;
            backingPreviewVoices.forEach(function (voice) {
                holdParam(voice.gain.gain, now);
                voice.gain.gain.setTargetAtTime(0.0001, now, 0.03);
                voice.osc.stop(now + 0.2);
            });
        }
        backingPreviewVoices = [];
    }

    // The driver voices the style in the current scale, voicing and rhythm.
    function scheduleBackingPreview(style) {
        stopBackingPreview();
        backingPreviewStyle = style;
        backingPreviewTimer = setTimeout(function () {
            backingPreviewTimer = null;
            api.postMessage({ type: "preview-backing", style: style });
        }, BACKING_PREVIEW_DELAY_MS);
    }

    // Pad chords and arpeggio notes, shaped like the ones playback makes.
    function playBackingPreview(notes) {
        if (!audioUnlocked()) return;
        var ctx = audio.ctx;
        var now = ctx.currentTime;
        var start = now + 0.03;
        backingPreviewVoices = notes.map(function (note) {
            var at = start + note.t;
            var hz = 440 * Math.pow(2, (note.midi - 69) / 12);
            var peak = Math.max(0.0005, note.v * PEAK_GAIN * tilt(hz)) * (note.a ? ARP_GAIN : BACKING_GAIN) * settings.backingLevel;
            var sustain = Math.max(0.0004, peak * (note.a ? ARP_SUSTAIN : BACKING_SUSTAIN));
            var attack = note.a ? ARP_ATTACK : note.d >= BACKING_PAD_MIN_SEC ? BACKING_PAD_ATTACK : BACKING_PLUCK_ATTACK;
            var end = at + Math.max(0.09, note.d);
            var osc = ctx.createOscillator();
            osc.type = note.a ? "sine" : "triangle";
            osc.frequency.value = hz;
            var gain = ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.setValueAtTime(0, at);
            gain.gain.linearRampToValueAtTime(peak, at + attack);
            gain.gain.setTargetAtTime(sustain, at + attack, DECAY / 3);
            gain.gain.setTargetAtTime(0.0001, end, RELEASE / 3);
            var source = osc;
            if (!note.a) {
                var cutoff = ctx.createBiquadFilter();
                cutoff.type = "lowpass";
                cutoff.frequency.value = BACKING_CUTOFF;
                cutoff.Q.value = 0.6;
                osc.connect(cutoff);
                source = cutoff;
            }
            source.connect(gain);
            gain.connect(audio.dry);
            gain.connect(audio.send);
            osc.start(now);
            osc.stop(end + RELEASE * 3);
            return { osc: osc, gain: gain };
        });
    }

    // ---- Tooltip

    var tip = document.getElementById("tooltip");
    var tipOwner = null;

    function showTip(el, text) {
        if (!text) return;
        tipOwner = el;
        tip.textContent = text;
        tip.hidden = false;
        var r = el.getBoundingClientRect();
        var t = tip.getBoundingClientRect();
        var left = clamp(r.left + r.width / 2 - t.width / 2, 8, window.innerWidth - t.width - 8);
        var top = r.top - t.height - 6;
        if (top < 8) top = r.bottom + 6;
        tip.style.left = left + "px";
        tip.style.top = top + "px";
    }

    function hideTip(el) {
        if (el && el !== tipOwner) return;
        tipOwner = null;
        tip.hidden = true;
    }

    function bindTip(el, text) {
        el.addEventListener("pointerenter", function () { showTip(el, text()); });
        el.addEventListener("pointerleave", function () { hideTip(el); });
        el.addEventListener("focus", function () {
            if (el.matches(":focus-visible")) showTip(el, text());
        });
        el.addEventListener("blur", function () { hideTip(el); });
    }

    // ---- Dropdowns (Scale, Backing)

    var CHECK_ICON = '<svg class="check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>';

    /**
     * A listbox dropdown. "items()" returns { name, description? }, "selected()"
     * the chosen index, "choose(index)" applies a new choice. "preview(index)" runs
     * when the user moves onto an option, "stopPreview()" when the list closes.
     */
    function createSelect(opts) {
        var field = document.getElementById(opts.id + "-field");
        var trigger = document.getElementById(opts.id + "-trigger");
        var valueEl = document.getElementById(opts.id + "-value");
        var list = document.getElementById(opts.id + "-list");
        var active = -1;

        function render() {
            list.textContent = "";
            var items = opts.items();
            var selected = opts.selected();
            items.forEach(function (item, index) {
                var option = document.createElement("div");
                option.className = "option";
                option.id = opts.id + "-option-" + index;
                option.setAttribute("role", "option");
                option.setAttribute("aria-selected", index === selected ? "true" : "false");
                option.innerHTML =
                    '<span class="option-text"><span class="option-name"></span><span class="option-desc"></span></span>' +
                    CHECK_ICON;
                option.querySelector(".option-name").textContent = item.name;
                var desc = option.querySelector(".option-desc");
                if (item.description) desc.textContent = item.description;
                else desc.remove();
                option.addEventListener("pointermove", function () { setActive(index, true); });
                option.addEventListener("click", function () { choose(index); });
                list.appendChild(option);
            });
            var current = items[selected];
            valueEl.textContent = current ? current.name : "";
        }

        function setActive(index, fromUser) {
            if (index === active) return;
            active = index;
            if (fromUser && opts.preview) opts.preview(index);
            var options = list.children;
            for (var i = 0; i < options.length; i++) options[i].classList.toggle("active", i === index);
            if (options[index]) list.setAttribute("aria-activedescendant", options[index].id);
        }

        function open() {
            if (!opts.items().length) return;
            // Opening is a click or key press in the panel, so sound may start here.
            unlockAudio();
            list.hidden = false;
            trigger.setAttribute("aria-expanded", "true");
            active = -1;
            setActive(opts.selected(), false);
            list.focus({ preventScroll: true });
        }

        function close(refocus) {
            if (list.hidden) return;
            if (opts.stopPreview) opts.stopPreview();
            list.hidden = true;
            trigger.setAttribute("aria-expanded", "false");
            if (refocus) trigger.focus({ preventScroll: true });
        }

        function choose(index) {
            close(true);
            if (index === opts.selected() || !opts.items()[index]) return;
            opts.choose(index);
            render();
        }

        trigger.addEventListener("click", function () {
            if (list.hidden) open();
            else close(false);
        });
        trigger.addEventListener("keydown", function (event) {
            if (["ArrowDown", "ArrowUp", "Enter", " "].indexOf(event.key) < 0) return;
            event.preventDefault();
            open();
        });
        list.addEventListener("keydown", function (event) {
            var last = opts.items().length - 1;
            switch (event.key) {
                case "ArrowDown": setActive(Math.min(last, active + 1), true); break;
                case "ArrowUp": setActive(Math.max(0, active - 1), true); break;
                case "Home": setActive(0, true); break;
                case "End": setActive(last, true); break;
                case "Enter":
                case " ": choose(active); break;
                case "Escape": close(true); break;
                case "Tab": close(false); return;
                default: return;
            }
            event.preventDefault();
        });
        document.addEventListener("pointerdown", function (event) {
            if (!field.contains(event.target)) close(false);
        });
        return { render: render };
    }

    var scales = [];

    var scaleSelect = createSelect({
        id: "scale",
        items: function () { return scales; },
        selected: function () {
            for (var i = 0; i < scales.length; i++) if (scales[i].id === settings.scale) return i;
            return 0;
        },
        choose: function (index) {
            settings.scale = scales[index].id;
            api.postMessage({ type: "scale", value: settings.scale });
        },
        preview: function (index) { scheduleScalePreview(index); },
        stopPreview: function () { stopScalePreview(); },
    });

    // ---- Range piano

    var piano = document.getElementById("piano");
    var keysEl = document.getElementById("keys");
    var band = document.getElementById("band");
    var handleLow = document.getElementById("handle-low");
    var handleHigh = document.getElementById("handle-high");
    var labelsEl = document.getElementById("piano-labels");
    var rangeValue = document.getElementById("range-value");
    var blackKeys = [];
    var keyLabels = [];
    var rangeDrag = null;

    (function buildPiano() {
        var width = 100 / WHITE_KEYS;
        for (var i = 0; i < WHITE_KEYS; i++) {
            var white = document.createElement("div");
            white.className = "key white";
            white.style.left = i * width + "%";
            white.style.width = width + "%";
            keysEl.appendChild(white);
        }
        // Black keys sit after C, D, F, G and A of each octave.
        [0, 1, 3, 4, 5].forEach(function (offset) {
            for (var octave = 0; octave < MAX_OCTAVE - MIN_OCTAVE; octave++) {
                var index = octave * 7 + offset;
                var black = document.createElement("div");
                black.className = "key black";
                black.style.left = (index + 1) * width + "%";
                keysEl.appendChild(black);
                blackKeys.push({ el: black, index: index });
            }
        });
        for (var o = MIN_OCTAVE; o <= MAX_OCTAVE; o++) {
            var label = document.createElement("span");
            label.className = "key-label";
            if (o === MIN_OCTAVE) label.classList.add("first");
            if (o === MAX_OCTAVE) label.classList.add("last");
            label.style.left = o === MIN_OCTAVE ? "0" : ((o - 1) * 7 + 0.5) * width + "%";
            label.textContent = "C" + o;
            labelsEl.appendChild(label);
            keyLabels.push(label);
        }
    })();

    function lowEdge(octave) {
        return ((octave - 1) * 7) / WHITE_KEYS;
    }

    function highEdge(octave) {
        return ((octave - 1) * 7 + 1) / WHITE_KEYS;
    }

    function renderRange() {
        var low = settings.lowOctave;
        var high = settings.highOctave;
        var from = lowEdge(low);
        var to = highEdge(high);
        band.style.left = from * 100 + "%";
        band.style.width = (to - from) * 100 + "%";
        handleLow.style.left = from * 100 + "%";
        handleHigh.style.left = to * 100 + "%";
        var lowIndex = (low - 1) * 7;
        var highIndex = (high - 1) * 7;
        blackKeys.forEach(function (key) {
            key.el.classList.toggle("in-range", key.index >= lowIndex && key.index < highIndex);
        });
        keyLabels.forEach(function (label, i) {
            var octave = i + MIN_OCTAVE;
            label.classList.toggle("end", octave === low || octave === high);
        });
        rangeValue.textContent = "C" + low + " to C" + high;
        [[handleLow, low, MIN_OCTAVE, high - 1], [handleHigh, high, low + 1, MAX_OCTAVE]].forEach(function (h) {
            h[0].setAttribute("aria-valuenow", String(h[1]));
            h[0].setAttribute("aria-valuetext", "C" + h[1]);
            h[0].setAttribute("aria-valuemin", String(h[2]));
            h[0].setAttribute("aria-valuemax", String(h[3]));
        });
    }

    function clampOctave(which, octave) {
        return which === "low"
            ? clamp(octave, MIN_OCTAVE, settings.highOctave - 1)
            : clamp(octave, settings.lowOctave + 1, MAX_OCTAVE);
    }

    function setOctave(which, octave) {
        var key = which === "low" ? "lowOctave" : "highOctave";
        var next = clampOctave(which, octave);
        if (settings[key] === next) return;
        settings[key] = next;
        renderRange();
        previewNote(12 * (next + 1));
        api.postMessage({ type: "range", low: settings.lowOctave, high: settings.highOctave });
    }

    function keyPosition(clientX) {
        var r = keysEl.getBoundingClientRect();
        return ((clientX - r.left) / r.width) * WHITE_KEYS;
    }

    function octaveAt(which, clientX) {
        var x = keyPosition(clientX);
        return which === "low" ? Math.round(x / 7) + 1 : Math.round((x - 1) / 7) + 1;
    }

    function handleFor(which) {
        return which === "low" ? handleLow : handleHigh;
    }

    piano.addEventListener("pointerdown", function (event) {
        if (event.button !== 0) return;
        event.preventDefault();
        unlockAudio();
        var handle = event.target.closest(".handle");
        var which;
        if (handle) {
            which = handle === handleLow ? "low" : "high";
        } else {
            // Clicking a key moves the handle nearest in pitch to that octave's C.
            var index = clamp(Math.floor(keyPosition(event.clientX)), 0, WHITE_KEYS - 1);
            var octave = Math.min(MAX_OCTAVE, Math.floor(index / 7) + 1);
            var toLow = Math.abs(octave - settings.lowOctave);
            var toHigh = Math.abs(octave - settings.highOctave);
            which = toLow < toHigh ? "low" : toHigh < toLow ? "high" : octave <= settings.lowOctave ? "low" : "high";
            setOctave(which, octave);
        }
        rangeDrag = { which: which, pointerId: event.pointerId };
        piano.setPointerCapture(event.pointerId);
        handleFor(which).classList.add("dragging");
        handleFor(which).focus({ preventScroll: true });
    });
    piano.addEventListener("pointermove", function (event) {
        if (!rangeDrag || event.pointerId !== rangeDrag.pointerId) return;
        setOctave(rangeDrag.which, octaveAt(rangeDrag.which, event.clientX));
    });
    function endRangeDrag() {
        if (!rangeDrag) return;
        handleFor(rangeDrag.which).classList.remove("dragging");
        rangeDrag = null;
    }
    piano.addEventListener("pointerup", endRangeDrag);
    piano.addEventListener("pointercancel", endRangeDrag);

    [[handleLow, "low"], [handleHigh, "high"]].forEach(function (pair) {
        pair[0].addEventListener("keydown", function (event) {
            var which = pair[1];
            var current = which === "low" ? settings.lowOctave : settings.highOctave;
            var next;
            switch (event.key) {
                case "ArrowLeft":
                case "ArrowDown": next = current - 1; break;
                case "ArrowRight":
                case "ArrowUp": next = current + 1; break;
                case "Home": next = MIN_OCTAVE; break;
                case "End": next = MAX_OCTAVE; break;
                default: return;
            }
            event.preventDefault();
            unlockAudio();
            setOctave(which, next);
        });
    });

    // ---- Backing: named styles, each the current scale's own progression

    var backingStyles = [];
    var backingEl = document.getElementById("backing");

    function isArp(rhythm) {
        return typeof rhythm === "string";
    }

    function setBacking(patch) {
        var next = {};
        for (var key in settings.backing) next[key] = settings.backing[key];
        for (var key2 in patch) next[key2] = patch[key2];
        settings.backing = next;
        renderBackingRows();
        api.postMessage({ type: "backing", value: settings.backing });
    }

    function backingItems() {
        return [{ value: "off", label: "Off", tip: "No backing chords", disabled: false }].concat(
            backingStyles.map(function (style) {
                return {
                    value: style.id,
                    label: style.label,
                    tip: style.progression ? "Chords " + style.progression : "Not in this scale",
                    disabled: !style.progression,
                };
            })
        );
    }

    function currentBacking() {
        return settings.backing.enabled ? settings.backing.style : "off";
    }

    function chooseBacking(value) {
        if (value === currentBacking()) return;
        if (value === "off") setBacking({ enabled: false });
        else setBacking({ enabled: true, style: value });
    }

    // Rebuilt when the scale changes, since the scale decides which styles exist.
    function renderBackingTabs() {
        backingEl.textContent = "";
        backingItems().forEach(function (item) {
            var button = document.createElement("button");
            button.type = "button";
            button.className = "segment";
            button.setAttribute("role", "radio");
            button.dataset.value = item.value;
            button.textContent = item.label;
            button.disabled = item.disabled;
            button.addEventListener("click", function () { chooseBacking(item.value); });
            if (item.value !== "off" && !item.disabled) {
                button.addEventListener("pointerenter", function () { scheduleBackingPreview(item.value); });
                button.addEventListener("pointerleave", stopBackingPreview);
            }
            bindTip(button, function () { return item.tip; });
            backingEl.appendChild(button);
        });
        updateBackingTabs();
    }

    function updateBackingTabs() {
        var value = currentBacking();
        Array.prototype.forEach.call(backingEl.children, function (button) {
            var on = button.dataset.value === value;
            button.setAttribute("aria-checked", on ? "true" : "false");
            button.tabIndex = on ? 0 : -1;
        });
    }

    backingEl.addEventListener("keydown", function (event) {
        var buttons = Array.prototype.slice.call(backingEl.children).filter(function (b) { return !b.disabled; });
        var at = buttons.indexOf(document.activeElement);
        if (at < 0) return;
        var next;
        switch (event.key) {
            case "ArrowLeft":
            case "ArrowUp": next = (at - 1 + buttons.length) % buttons.length; break;
            case "ArrowRight":
            case "ArrowDown": next = (at + 1) % buttons.length; break;
            case "Home": next = 0; break;
            case "End": next = buttons.length - 1; break;
            default: return;
        }
        event.preventDefault();
        chooseBacking(buttons[next].dataset.value);
        buttons[next].focus();
        var item = backingItems().filter(function (i) { return i.value === buttons[next].dataset.value; })[0];
        if (item) showTip(buttons[next], item.tip);
    });

    /** A row of segments; "items" are { value, label, tip }. */
    function createSegmented(id, items, current, choose) {
        var el = document.getElementById(id);
        items.forEach(function (item, index) {
            var button = document.createElement("button");
            button.type = "button";
            button.className = "segment";
            button.setAttribute("role", "radio");
            button.dataset.index = String(index);
            button.textContent = item.label;
            button.addEventListener("click", function () { choose(item.value); });
            bindTip(button, function () { return item.tip; });
            el.appendChild(button);
        });
        el.addEventListener("keydown", function (event) {
            var buttons = Array.prototype.slice.call(el.children);
            var at = buttons.indexOf(document.activeElement);
            if (at < 0) return;
            var next;
            switch (event.key) {
                case "ArrowLeft":
                case "ArrowUp": next = (at - 1 + buttons.length) % buttons.length; break;
                case "ArrowRight":
                case "ArrowDown": next = (at + 1) % buttons.length; break;
                case "Home": next = 0; break;
                case "End": next = buttons.length - 1; break;
                default: return;
            }
            event.preventDefault();
            choose(items[next].value);
            buttons[next].focus();
            showTip(buttons[next], items[next].tip);
        });
        return {
            render: function () {
                var value = current();
                Array.prototype.forEach.call(el.children, function (button, index) {
                    var on = items[index].value === value;
                    button.setAttribute("aria-checked", on ? "true" : "false");
                    button.tabIndex = on ? 0 : -1;
                });
            },
        };
    }

    var voicingControl = createSegmented(
        "voicing",
        [
            { value: "bass", label: "Bass", tip: "Bass note only" },
            { value: "omit3", label: "No 3rd", tip: "Bass, root and fifth" },
            { value: "full", label: "Full", tip: "Bass and the full triad" },
        ],
        function () { return settings.backing.voicing; },
        function (value) { if (value !== settings.backing.voicing) setBacking({ voicing: value }); }
    );

    var rhythmControl = createSegmented(
        "rhythm",
        [
            { value: 1, label: "1\u00d7", tip: "One strike per chord" },
            { value: 2, label: "2\u00d7", tip: "Two strikes per chord" },
            { value: 4, label: "4\u00d7", tip: "Four strikes per chord" },
            { value: "arp-up", label: "Arp \\u2191", tip: "Arpeggio up over a held bass" },
            { value: "arp-down", label: "Arp \\u2193", tip: "Arpeggio down over a held bass" },
        ],
        function () { return settings.backing.rhythm; },
        function (value) { if (value !== settings.backing.rhythm) setBacking({ rhythm: value }); }
    );

    var voicingField = document.getElementById("voicing-field");
    var rhythmField = document.getElementById("rhythm-field");

    // Voicing and Rhythm only matter with a backing on; arpeggios set their own voicing.
    function renderBackingRows() {
        updateBackingTabs();
        var on = settings.backing.enabled;
        rhythmField.hidden = !on;
        voicingField.hidden = !on || isArp(settings.backing.rhythm);
        voicingControl.render();
        rhythmControl.render();
        showBackingLevel(on);
    }

    // ---- Feel

    var feel = document.getElementById("feel");
    var feelToggle = document.getElementById("feel-toggle");
    var feelBody = document.getElementById("feel-body");
    var feelSummary = document.getElementById("feel-summary");
    var slidersEl = document.getElementById("sliders");
    var VALUE_INSET = 10;
    var MAP_START = 6;
    var MAP_GAP = 8;
    var MARK_GAP = 8;
    var KEY_ACTIVE_MS = 700;
    var SPEED_POST_MS = 120;

    function formatSpeed(v) {
        var hundredths = Math.round(v * 100);
        return (hundredths % 10 === 0 ? v.toFixed(1) : v.toFixed(2)) + "\u00d7";
    }

    function formatMs(v) {
        return Math.round(v * 1000) + "ms";
    }

    function formatPercent(v) {
        return Math.round(v * 100) + "%";
    }

    var SLIDERS = [
        { key: "speed", label: "Speed", min: 0.5, max: 2, step: 0.05, def: 1, marks: "ticks", widest: "0.55\u00d7", format: formatSpeed },
        { key: "attack", label: "Attack", min: 0, max: 0.3, step: 0.005, def: 0.02, marks: "dots", widest: "300ms", format: formatMs, hint: "Lower is sharper, higher is softer" },
        { key: "notes", label: "Notes", min: 0, max: 1, step: 0.01, def: 0.8, marks: "dots", widest: "100%", format: formatPercent },
        { key: "backingLevel", label: "Backing", min: 0, max: 1, step: 0.01, def: 0.7, marks: "dots", widest: "100%", format: formatPercent },
        { key: "reverb", label: "Reverb", min: 0, max: 1, step: 0.01, def: 0.38, marks: "dots", widest: "100%", format: formatPercent },
    ];

    function quantize(spec, raw) {
        var steps = Math.round((clamp(raw, spec.min, spec.max) - spec.min) / spec.step);
        return Number((spec.min + steps * spec.step).toFixed(4));
    }

    var speedPostTimer = null;

    function postSpeed() {
        clearTimeout(speedPostTimer);
        speedPostTimer = null;
        api.postMessage({ type: "speed", value: settings.speed });
    }

    function liveApply(key) {
        if (key === "speed") {
            renderRowStates();
            // Heard immediately, without rebuilding the score on every pixel.
            if (!speedPostTimer) speedPostTimer = setTimeout(postSpeed, SPEED_POST_MS);
            return;
        }
        if (!audio) return;
        var now = audio.ctx.currentTime;
        if (key === "reverb") audio.wet.gain.setTargetAtTime(settings.reverb, now, 0.02);
    }

    function commitSlider(slider) {
        if (slider.spec.key === "speed") {
            postSpeed();
            return;
        }
        api.postMessage({
            type: "knobs",
            values: {
                attack: settings.attack,
                notes: settings.notes,
                backingLevel: settings.backingLevel,
                reverb: settings.reverb,
            },
        });
    }

    function renderSummary() {
        feelSummary.textContent =
            settings.speed.toFixed(2) + "\u00d7 \u00b7 " + formatMs(settings.attack) + " \u00b7 " + formatPercent(settings.notes);
    }

    function measureText(text) {
        var probe = document.createElement("span");
        probe.className = "measure";
        probe.textContent = text;
        document.body.appendChild(probe);
        var width = probe.getBoundingClientRect().width;
        probe.remove();
        return Math.ceil(width);
    }

    function layoutSlider(slider) {
        var width = slider.el.clientWidth;
        if (!width) return;
        // Room for the widest value, so the value never shifts.
        var valueWidth = measureText(slider.spec.widest);
        slider.valueEl.style.width = valueWidth + "px";
        var valueStart = width - VALUE_INSET - valueWidth;
        slider.geom = {
            from: MAP_START,
            to: valueStart - MAP_GAP,
            marksFrom: slider.labelEl.offsetLeft + slider.labelEl.offsetWidth + MARK_GAP,
            marksTo: valueStart - MARK_GAP,
            labelEnd: slider.labelEl.offsetLeft + slider.labelEl.offsetWidth,
        };
        renderSlider(slider);
    }

    function sliderX(slider, value) {
        var g = slider.geom;
        var ratio = (value - slider.spec.min) / (slider.spec.max - slider.spec.min);
        return g.from + ratio * (g.to - g.from);
    }

    function renderSlider(slider) {
        var spec = slider.spec;
        var value = settings[spec.key];
        slider.valueEl.textContent = spec.format(value);
        slider.el.setAttribute("aria-valuenow", String(value));
        slider.el.setAttribute("aria-valuetext", spec.format(value));
        if (!slider.geom) return;
        var x = sliderX(slider, value);
        slider.indicator.style.transform = "translateX(" + (x - 1).toFixed(1) + "px)";
        // Low values put the indicator under the label text; the fill still shows them.
        slider.indicator.hidden = x < slider.geom.labelEnd + 3;
        slider.fill.style.width = Math.max(0, x + 4 - 2).toFixed(1) + "px";
        var g = slider.geom;
        slider.marks.forEach(function (mark) {
            var mx = sliderX(slider, mark.value);
            var visible =
                mx >= g.marksFrom &&
                mx <= g.marksTo &&
                Math.abs(mx - x) > 3 &&
                (spec.marks === "ticks" || mx > x);
            mark.el.hidden = !visible;
            mark.el.style.left = mx.toFixed(1) + "px";
        });
    }

    function setSliderValue(slider, value, commit) {
        var key = slider.spec.key;
        if (settings[key] !== value) {
            settings[key] = value;
            renderSlider(slider);
            renderSummary();
            liveApply(key);
        }
        if (commit) commitSlider(slider);
    }

    function buildSlider(spec) {
        var el = document.createElement("div");
        el.className = "slider";
        el.tabIndex = 0;
        el.setAttribute("role", "slider");
        el.setAttribute("aria-label", spec.label);
        el.setAttribute("aria-valuemin", String(spec.min));
        el.setAttribute("aria-valuemax", String(spec.max));
        el.innerHTML =
            '<div class="s-fill"></div><div class="s-marks"></div>' +
            '<span class="s-label"></span><span class="s-value"></span><span class="s-indicator"></span>';
        var slider = {
            spec: spec,
            el: el,
            fill: el.querySelector(".s-fill"),
            labelEl: el.querySelector(".s-label"),
            valueEl: el.querySelector(".s-value"),
            indicator: el.querySelector(".s-indicator"),
            marks: [],
            geom: null,
            dragging: false,
            keyTimer: null,
        };
        slider.labelEl.textContent = spec.label;

        var markValues = [];
        if (spec.marks === "ticks") {
            for (var tenths = Math.round(spec.min * 10) + 1; tenths < Math.round(spec.max * 10); tenths++) {
                markValues.push(tenths / 10);
            }
        } else {
            for (var p = 1; p < 10; p++) markValues.push(spec.min + ((spec.max - spec.min) * p) / 10);
        }
        var marksEl = el.querySelector(".s-marks");
        markValues.forEach(function (value) {
            var mark = document.createElement("span");
            mark.className = spec.marks === "ticks" ? "s-tick" : "s-dot";
            marksEl.appendChild(mark);
            slider.marks.push({ el: mark, value: value });
        });

        function valueAt(clientX) {
            var g = slider.geom;
            var r = el.getBoundingClientRect();
            var ratio = clamp((clientX - r.left - g.from) / (g.to - g.from), 0, 1);
            var value = quantize(spec, spec.min + ratio * (spec.max - spec.min));
            if (spec.key === "speed" && Math.abs(value - 1) <= 0.06) value = 1;
            return value;
        }

        function setActive(on) {
            el.classList.toggle("active", on);
        }

        el.addEventListener("pointerdown", function (event) {
            if (event.button !== 0 || !slider.geom) return;
            event.preventDefault();
            el.focus({ preventScroll: true });
            el.setPointerCapture(event.pointerId);
            slider.dragging = true;
            hideTip(el);
            setActive(true);
            setSliderValue(slider, valueAt(event.clientX), false);
        });
        el.addEventListener("pointermove", function (event) {
            if (!slider.dragging) return;
            setSliderValue(slider, valueAt(event.clientX), false);
        });
        function release() {
            if (!slider.dragging) return;
            slider.dragging = false;
            if (!slider.keyTimer) setActive(false);
            commitSlider(slider);
        }
        el.addEventListener("pointerup", release);
        el.addEventListener("pointercancel", release);
        el.addEventListener("dblclick", function () {
            setSliderValue(slider, spec.def, true);
        });
        el.addEventListener("keydown", function (event) {
            var value = settings[spec.key];
            var big = (spec.max - spec.min) / 10;
            var next;
            switch (event.key) {
                case "ArrowRight":
                case "ArrowUp": next = value + (event.shiftKey ? big : spec.step); break;
                case "ArrowLeft":
                case "ArrowDown": next = value - (event.shiftKey ? big : spec.step); break;
                case "PageUp": next = value + big; break;
                case "PageDown": next = value - big; break;
                case "Home": next = spec.min; break;
                case "End": next = spec.max; break;
                default: return;
            }
            event.preventDefault();
            hideTip(el);
            setActive(true);
            clearTimeout(slider.keyTimer);
            slider.keyTimer = setTimeout(function () {
                slider.keyTimer = null;
                if (!slider.dragging) setActive(false);
            }, KEY_ACTIVE_MS);
            setSliderValue(slider, quantize(spec, next), true);
        });
        el.addEventListener("blur", function () {
            clearTimeout(slider.keyTimer);
            slider.keyTimer = null;
            if (!slider.dragging) setActive(false);
        });
        if (spec.hint) {
            bindTip(el, function () { return slider.dragging ? "" : spec.hint; });
        }
        slidersEl.appendChild(el);
        renderSlider(slider);
        return slider;
    }

    var sliders = SLIDERS.map(buildSlider);
    showBackingLevel(settings.backing.enabled);

    // The Backing level slider only shows while a backing is on.
    function showBackingLevel(on) {
        sliders.forEach(function (slider) {
            if (slider.spec.key !== "backingLevel") return;
            slider.el.hidden = !on;
            if (on) layoutSlider(slider);
        });
    }

    function layoutSliders() {
        sliders.forEach(layoutSlider);
    }

    function renderSliders() {
        sliders.forEach(renderSlider);
        renderSummary();
    }

    function setFeelOpen(open) {
        feel.classList.toggle("open", open);
        feelToggle.setAttribute("aria-expanded", open ? "true" : "false");
        feelBody.inert = !open;
    }
    setFeelOpen(false);
    feelToggle.addEventListener("click", function () {
        setFeelOpen(!feel.classList.contains("open"));
    });

    if (window.ResizeObserver) new ResizeObserver(layoutSliders).observe(slidersEl);

    // Keep 16px of space on the right whether the scrollbar takes room or overlays.
    var mainEl = document.querySelector("main");
    function fitScrollGutter() {
        var gutter = mainEl.offsetWidth - mainEl.clientWidth;
        root.style.setProperty("--scroll-pad", Math.max(0, 16 - gutter) + "px");
    }
    fitScrollGutter();
    window.addEventListener("resize", fitScrollGutter);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutSliders);

    // ---- Frames

    var frameList = document.getElementById("frame-list");
    var frames = [];
    var selectedIds = [];

    function isPlayingFrame(id) {
        return playing && Boolean(score) && score.frameIds.indexOf(id) >= 0;
    }

    function markAttention(id) {
        attentionId = id || null;
        renderRowStates();
    }

    function frameDuration(frame) {
        return frame.width / (BASE_PX_PER_SECOND * settings.speed);
    }

    var SVG_NS = "http://www.w3.org/2000/svg";

    function buildThumb(frame) {
        var svg = document.createElementNS(SVG_NS, "svg");
        var height = (THUMB_WIDTH * frame.height) / frame.width;
        svg.setAttribute("viewBox", "0 0 " + THUMB_WIDTH + " " + height.toFixed(1));
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svg.setAttribute("aria-hidden", "true");
        frame.strokes.forEach(function (stroke) {
            var path = document.createElementNS(SVG_NS, "path");
            path.setAttribute("d", stroke.d);
            if (stroke.color) path.style.stroke = stroke.color;
            svg.appendChild(path);
        });
        var thumb = document.createElement("div");
        thumb.className = "thumb";
        thumb.appendChild(svg);
        return thumb;
    }

    function buildRow(frame) {
        var row = document.createElement("li");
        row.className = "frame-row";
        row.dataset.id = frame.id;
        row.tabIndex = 0;
        row.setAttribute("role", "button");
        row.appendChild(buildThumb(frame));

        var text = document.createElement("div");
        text.className = "frame-text";
        text.innerHTML =
            '<div class="frame-name"><span class="name-text"></span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></div>' +
            '<div class="frame-dur"></div>';
        bindName(text.querySelector(".name-text"), frame);
        row.appendChild(text);

        var play = document.createElement("button");
        play.type = "button";
        play.className = "icon-btn play";
        row.appendChild(play);

        row.addEventListener("click", function (event) {
            // The second click of a double-click on the name starts a rename instead.
            if (event.target.closest(".play, .name-input") || event.detail > 1) return;
            api.postMessage({ type: "focus-frame", id: frame.id });
        });
        row.addEventListener("keydown", function (event) {
            if (event.target !== row) return;
            if (event.key === "F2") {
                event.preventDefault();
                startRename(frame.id);
                return;
            }
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            api.postMessage({ type: "focus-frame", id: frame.id });
        });
        play.addEventListener("click", function () {
            playFrame(frame.id);
        });
        return row;
    }

    function bindName(el, frame) {
        el.textContent = frame.name;
        el.addEventListener("dblclick", function (event) {
            event.stopPropagation();
            startRename(frame.id);
        });
        bindTip(el, function () { return editing ? "" : "Double-click to rename"; });
    }

    function frameById(id) {
        for (var i = 0; i < frames.length; i++) if (frames[i].id === id) return frames[i];
        return null;
    }

    function rowById(id) {
        var rows = frameList.children;
        for (var i = 0; i < rows.length; i++) if (rows[i].dataset.id === id) return rows[i];
        return null;
    }

    // Rename in place: Enter or blur saves, Esc cancels, an empty name is ignored.
    var editing = null;
    var pendingRenameId = null;

    function startRename(id, draft) {
        var frame = frameById(id);
        var row = rowById(id);
        if (!frame || !row) {
            pendingRenameId = id;
            return;
        }
        pendingRenameId = null;
        if (editing && editing.id === id) {
            editing.input.focus();
            return;
        }
        if (editing) editing.finish(true);
        hideTip();
        var nameEl = row.querySelector(".name-text");
        var input = document.createElement("input");
        input.type = "text";
        input.className = "name-input";
        input.maxLength = 60;
        input.spellcheck = false;
        input.setAttribute("aria-label", "Frame name");
        input.value = draft === undefined ? frame.name : draft;
        nameEl.replaceWith(input);
        var done = false;
        function finish(commit, refocus) {
            if (done) return;
            done = true;
            editing = null;
            var next = input.value.trim();
            if (commit && next && next !== frame.name) {
                frame.name = next;
                api.postMessage({ type: "rename-frame", id: id, name: next });
            }
            if (!input.isConnected) return;
            var span = document.createElement("span");
            span.className = "name-text";
            bindName(span, frame);
            input.replaceWith(span);
            renderRowStates();
            if (refocus) row.focus({ preventScroll: true });
        }
        editing = { id: id, input: input, finish: finish, drop: function () { done = true; editing = null; } };
        input.addEventListener("keydown", function (event) {
            event.stopPropagation();
            if (event.key === "Enter") {
                event.preventDefault();
                finish(true, true);
            } else if (event.key === "Escape") {
                event.preventDefault();
                finish(false, true);
            }
        });
        input.addEventListener("blur", function () { finish(true); });
        input.addEventListener("click", function (event) { event.stopPropagation(); });
        input.addEventListener("dblclick", function (event) { event.stopPropagation(); });
        input.focus({ preventScroll: true });
        if (draft === undefined) input.select();
        row.scrollIntoView({ block: "nearest" });
    }

    function playFrame(id) {
        if (isPlayingFrame(id)) {
            pause();
            return;
        }
        // Resume inside the click so the browser lets this panel make sound.
        unlockAudio();
        attentionId = null;
        renderRowStates();
        api.postMessage({ type: "play-frame", id: id });
    }

    function renderRowStates() {
        Array.prototype.forEach.call(frameList.children, function (row) {
            var id = row.dataset.id;
            var frame = null;
            for (var i = 0; i < frames.length; i++) if (frames[i].id === id) frame = frames[i];
            if (!frame) return;
            var on = isPlayingFrame(id);
            var duration = formatTime(frameDuration(frame));
            row.classList.toggle("selected", selectedIds.indexOf(id) >= 0);
            row.classList.toggle("playing", on);
            row.setAttribute("aria-label", frame.name + ", " + duration);
            row.querySelector(".frame-dur").textContent = duration;
            var play = row.querySelector(".play");
            if (play.dataset.state !== (on ? "pause" : "play")) {
                play.dataset.state = on ? "pause" : "play";
                play.innerHTML = on ? PAUSE_ICON : PLAY_ICON;
            }
            play.setAttribute("aria-label", (on ? "Pause " : "Play ") + frame.name);
            play.setAttribute("aria-pressed", on ? "true" : "false");
            play.classList.toggle("attention", attentionId === id && !on);
        });
    }

    function renderFrames() {
        var any = frames.length > 0;
        fullView.hidden = !any;
        firstUse.hidden = any;
        createFrameBtn.disabled = false;
        newFrameBtn.disabled = false;
        var active = document.activeElement;
        var focusRow = active && active.closest ? active.closest(".frame-row") : null;
        var focusId = focusRow ? focusRow.dataset.id : null;
        var focusPlay = Boolean(focusRow) && active.classList.contains("play");
        // A list refresh rebuilds the rows; carry an unfinished rename across it.
        var draft = editing ? { id: editing.id, value: editing.input.value } : null;
        if (editing) editing.drop();
        frameList.textContent = "";
        frames.forEach(function (frame) {
            frameList.appendChild(buildRow(frame));
        });
        renderRowStates();
        if (focusId) {
            Array.prototype.forEach.call(frameList.children, function (row) {
                if (row.dataset.id !== focusId) return;
                (focusPlay ? row.querySelector(".play") : row).focus({ preventScroll: true });
            });
        }
        if (draft) startRename(draft.id, draft.value);
        else if (pendingRenameId) startRename(pendingRenameId);
        if (any) layoutSliders();
    }

    function addFrame(button) {
        button.disabled = true;
        api.postMessage({ type: "add-frame" });
    }
    createFrameBtn.addEventListener("click", function () { addFrame(createFrameBtn); });
    newFrameBtn.addEventListener("click", function () { addFrame(newFrameBtn); });

    // ---- Settings from the driver

    function applySettings(values) {
        ["speed", "attack", "notes", "backingLevel", "reverb"].forEach(function (key) {
            if (typeof values[key] === "number") settings[key] = values[key];
        });
        if (typeof values.scale === "string") settings.scale = values.scale;
        if (typeof values.lowOctave === "number" && typeof values.highOctave === "number") {
            settings.lowOctave = values.lowOctave;
            settings.highOctave = values.highOctave;
        }
        if (values.backing && typeof values.backing === "object") settings.backing = values.backing;
        if (typeof values.loop === "boolean") setLoop(values.loop);
        scaleSelect.render();
        renderRange();
        renderBackingRows();
        renderSliders();
        renderRowStates();
        if (audio) {
            var now = audio.ctx.currentTime;
            audio.wet.gain.setTargetAtTime(settings.reverb, now, 0.02);
        }
    }

    renderRange();
    renderSliders();

    function sameFrames(a, b) {
        return Boolean(a) && Boolean(b) && a.frameIds.join(",") === b.frameIds.join(",");
    }

    function receiveScore(msg) {
        var next = msg.score;
        var same = sameFrames(score, next);
        if (playing && same) {
            swapScore(next);
            return;
        }
        if (playing) stop("stopped");
        // A paused frame keeps its place; the playhead stays put in px, so a
        // speed change rescales the elapsed time.
        var keep = same && score ? (elapsed * score.pxPerSecond) / next.pxPerSecond : 0;
        score = next;
        elapsed = keep > 0 && keep < next.durationSec ? keep : 0;
        renderRowStates();
        api.postMessage({ type: "progress", t: elapsed });
        if (!msg.autoplay) return;
        var activated = navigator.userActivation ? navigator.userActivation.hasBeenActive : false;
        if (audioUnlocked() || activated) start();
        else markAttention(next.frameIds[0]);
    }

    api.onMessage(function (msg) {
        if (!msg || typeof msg !== "object") return;
        switch (msg.type) {
            case "theme":
                themeStyle.textContent = ":root{" + msg.css + "}";
                applyTheme(msg.css);
                return;
            case "stop":
                stop("stopped");
                return;
            case "frames":
                frames = msg.frames;
                renderFrames();
                return;
            case "edit-frame-name":
                startRename(msg.id);
                return;
            case "selection":
                selectedIds = msg.ids;
                renderRowStates();
                return;
            case "settings":
                applySettings(msg.values);
                return;
            case "seek":
                seekTo(msg.t);
                return;
            case "backing-preview":
                // Only if the pointer is still resting on that style.
                whenAudible(function () {
                    if (msg.style === backingPreviewStyle) playBackingPreview(msg.notes);
                });
                return;
            case "backing":
                stopBackingPreview();
                backingStyles = msg.styles;
                settings.backing = msg.value;
                renderBackingTabs();
                renderBackingRows();
                return;
            case "scales":
                scales = msg.scales;
                settings.scale = msg.current;
                scaleSelect.render();
                return;
            case "score":
                receiveScore(msg);
                return;
        }
    });

    api.postMessage({ type: "ready" });
})();
</script>
</body>
</html>`;
