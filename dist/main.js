'use strict';

function stamp(ctx) {
    return { driverId: ctx.driverId, requestId: ctx.nextRequestId() };
}
function unwrap(response) {
    const { error, value } = response.res;
    if (error !== undefined) {
        throw new Error(`${error.type}${error.message ? `: ${error.message}` : ""}`);
    }
    return value;
}

const playMenuId = (driverId) => `${driverId}:play`;
const stopMenuId = (driverId) => `${driverId}:stop`;
async function registerMenus(ctx) {
    const menus = [
        { menuId: playMenuId(ctx.driverId), menuTitle: "Serene play" },
        { menuId: stopMenuId(ctx.driverId), menuTitle: "Serene stop" },
    ];
    for (const menu of menus) {
        unwrap(await ctx.issueCommand({
            type: "command:context-menu:add",
            ...stamp(ctx),
            req: menu,
        }));
        unwrap(await ctx.issueCommand({
            type: "subscription:context-menu:clicked",
            ...stamp(ctx),
            req: { menuId: menu.menuId },
        }));
    }
}

const SCALES = [
    {
        id: "major-pentatonic",
        name: "C major pentatonic",
        steps: [0, 2, 4, 7, 9],
    },
    { id: "major", name: "C major", steps: [0, 2, 4, 5, 7, 9, 11] },
    { id: "dorian", name: "C dorian", steps: [0, 2, 3, 5, 7, 9, 10] },
    { id: "lydian", name: "C lydian", steps: [0, 2, 4, 6, 7, 9, 11] },
    { id: "mixolydian", name: "C mixolydian", steps: [0, 2, 4, 5, 7, 9, 10] },
    { id: "japanese", name: "Japanese hirajoshi", steps: [0, 2, 3, 7, 8] },
];
const DEFAULT_SCALE_ID = "major-pentatonic";
const MIN_OCTAVE = 1;
const MAX_OCTAVE = 8;
const DEFAULT_RANGE = { lowOctave: 4, highOctave: 7 };
function normalizeRange(lowOctave, highOctave, fallback = DEFAULT_RANGE) {
    const clampOctave = (value, alt) => typeof value === "number" && Number.isFinite(value)
        ? Math.min(MAX_OCTAVE, Math.max(MIN_OCTAVE, Math.round(value)))
        : alt;
    let low = clampOctave(lowOctave, fallback.lowOctave);
    let high = clampOctave(highOctave, fallback.highOctave);
    if (low >= high) {
        if (low >= MAX_OCTAVE)
            low = MAX_OCTAVE - 1;
        high = low + 1;
    }
    return { lowOctave: low, highOctave: high };
}
function bottomMidi(range) {
    return 12 * (range.lowOctave + 1);
}
function octaveSpan(range) {
    return range.highOctave - range.lowOctave;
}
function getScale(id) {
    return (SCALES.find((scale) => scale.id === id) ??
        SCALES.find((scale) => scale.id === DEFAULT_SCALE_ID));
}
function scaleRows(scale, range) {
    return scale.steps.length * octaveSpan(range) + 1;
}
function rowToMidi(scale, range, row) {
    const rows = scaleRows(scale, range);
    const clamped = Math.max(0, Math.min(rows - 1, Math.round(row)));
    const octave = Math.floor(clamped / scale.steps.length);
    const step = scale.steps[clamped % scale.steps.length];
    return bottomMidi(range) + octave * 12 + step;
}
function midiToHz(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}
function rowToHz(scale, range, row) {
    return midiToHz(rowToMidi(scale, range, row));
}
function yToRow(scale, range, y, top, height) {
    if (height <= 0)
        return 0;
    const rows = scaleRows(scale, range);
    const fromBottom = 1 - (y - top) / height;
    return Math.max(0, Math.min(rows - 1, Math.floor(fromBottom * rows)));
}

const PANEL_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style id="theme">:root{/*__DRAWDY_STYLING__*/}</style>
<style>
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 13px;
    line-height: 1.45;
    color: var(--drawdy-foreground, #111);
    background: var(--drawdy-background, #fff);
    background-image: radial-gradient(
        130% 70% at 50% -10%,
        color-mix(in oklab, var(--drawdy-primary, #6366f1) 16%, transparent),
        transparent 62%
    );
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
}
main {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 18px 18px 14px;
    display: flex;
    flex-direction: column;
    gap: 18px;
}
header {
    display: flex;
    align-items: center;
    gap: 8px;
}
.mark {
    width: 26px;
    height: 15px;
    fill: none;
    stroke: var(--drawdy-primary, #6366f1);
    stroke-width: 1.6;
    stroke-linecap: round;
    opacity: 0.9;
}
.brand {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
}
.chip {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    padding: 3px 8px;
    border-radius: 999px;
    color: var(--drawdy-muted-foreground, #888);
    border: 1px solid var(--drawdy-border, #e5e5e5);
}
.hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 6px 0 2px;
}
.dial {
    position: relative;
    width: 132px;
    height: 132px;
}
.dial::before {
    content: "";
    position: absolute;
    inset: 14px;
    border-radius: 999px;
    background: var(--drawdy-primary, #6366f1);
    opacity: 0;
    transition: opacity 0.4s ease;
}
body.playing .dial::before {
    opacity: 0.14;
    animation: breathe 3s ease-in-out infinite;
}
@keyframes breathe {
    0%, 100% { transform: scale(0.94); opacity: 0.08; }
    50% { transform: scale(1.05); opacity: 0.18; }
}
.ring {
    position: absolute;
    inset: 0;
    width: 132px;
    height: 132px;
    transform: rotate(-90deg);
}
.ring circle {
    fill: none;
    stroke-width: 5;
    stroke-linecap: round;
}
.ring-track {
    stroke: var(--drawdy-border, #e5e5e5);
}
.ring-fill {
    stroke: var(--drawdy-primary, #6366f1);
    stroke-dasharray: 339.292;
    stroke-dashoffset: 339.292;
    transition: stroke-dashoffset 0.09s linear;
}
#play {
    position: absolute;
    inset: 29px;
    display: grid;
    place-items: center;
    padding: 0;
    border: none;
    border-radius: 999px;
    cursor: pointer;
    color: var(--drawdy-primary-foreground, #fff);
    background: var(--drawdy-primary, #6366f1);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.18);
    transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
}
#play svg { width: 26px; height: 26px; fill: currentColor; }
#play:hover:not(:disabled) { transform: scale(1.05); }
#play:active:not(:disabled) { transform: scale(0.97); }
#play:focus-visible { outline: 2px solid var(--drawdy-ring, #94ba00); outline-offset: 3px; }
#play:disabled { opacity: 0.3; cursor: default; box-shadow: none; }
#play.pulse { animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse {
    0%, 100% {
        transform: scale(1);
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.18), 0 0 0 0 color-mix(in oklab, var(--drawdy-primary, #6366f1) 60%, transparent);
    }
    50% {
        transform: scale(1.07);
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.18), 0 0 0 16px color-mix(in oklab, var(--drawdy-primary, #6366f1) 0%, transparent);
    }
}
.meter {
    display: flex;
    align-items: center;
    gap: 10px;
}
.loop {
    font: inherit;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid var(--drawdy-border, #e5e5e5);
    background: transparent;
    color: var(--drawdy-muted-foreground, #888);
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.loop:hover { border-color: var(--drawdy-primary, #6366f1); }
.loop:focus-visible { outline: 2px solid var(--drawdy-ring, #94ba00); outline-offset: 2px; }
.loop[aria-pressed="true"] {
    color: var(--drawdy-primary, #6366f1);
    border-color: var(--drawdy-primary, #6366f1);
    background: color-mix(in oklab, var(--drawdy-primary, #6366f1) 12%, transparent);
}
.time {
    font-variant-numeric: tabular-nums;
    font-size: 12px;
    letter-spacing: 0.03em;
    color: var(--drawdy-muted-foreground, #888);
}
.time b { color: var(--drawdy-foreground, #111); font-weight: 600; }
.card {
    border: 1px solid var(--drawdy-border, #e5e5e5);
    border-radius: var(--drawdy-radius-lg, 14px);
    background: var(--drawdy-surface, #fafafa);
    padding: 4px 12px;
}
.row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
}
.row + .row { border-top: 1px solid var(--drawdy-border, #e5e5e5); }
.row label {
    width: 54px;
    flex: none;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--drawdy-muted-foreground, #888);
}
.row .val {
    width: 50px;
    flex: none;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    color: var(--drawdy-muted-foreground, #888);
}
select {
    flex: 1;
    min-width: 0;
    height: 30px;
    padding: 0 26px 0 9px;
    font: inherit;
    font-size: 12px;
    color: var(--drawdy-foreground, #111);
    background-color: var(--drawdy-background, #fff);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%23888' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 12px;
    border: 1px solid var(--drawdy-border, #e5e5e5);
    border-radius: var(--drawdy-radius-md, 9px);
    appearance: none;
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s ease;
}
select:hover { border-color: var(--drawdy-primary, #6366f1); }
select:focus-visible { box-shadow: 0 0 0 2px var(--drawdy-ring, #94ba00); }
.rack {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    padding: 14px 4px 12px;
}
.knob {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 2px 0;
    border-radius: var(--drawdy-radius-md, 9px);
    cursor: ns-resize;
    outline: none;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
}
.knob:focus-visible { box-shadow: 0 0 0 2px var(--drawdy-ring, #94ba00); }
.knob svg { width: 50px; height: 50px; display: block; }
.k-track {
    fill: none;
    stroke: var(--drawdy-border, #e5e5e5);
    stroke-width: 4;
    stroke-linecap: round;
}
.k-fill {
    fill: none;
    stroke: var(--drawdy-primary, #6366f1);
    stroke-width: 4;
    stroke-linecap: round;
    stroke-dasharray: 84.823;
    stroke-dashoffset: 84.823;
}
.k-cap {
    fill: var(--drawdy-background, #fff);
    stroke: var(--drawdy-border, #e5e5e5);
    stroke-width: 1;
    transition: stroke 0.15s ease;
}
.k-tick {
    stroke: var(--drawdy-foreground, #111);
    stroke-width: 2.4;
    stroke-linecap: round;
}
.knob:hover .k-cap, .knob.live .k-cap { stroke: var(--drawdy-primary, #6366f1); }
.knob.live .k-tick { stroke: var(--drawdy-primary, #6366f1); }
.k-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--drawdy-muted-foreground, #888);
}
.k-value {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--drawdy-foreground, #111);
}
.add-frame {
    flex: 1;
    height: 50px;
    padding: 0 12px;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    color: var(--drawdy-primary, #6366f1);
    background: transparent;
    border: 1px dashed var(--drawdy-primary, #6366f1);
    border-radius: var(--drawdy-radius-md, 9px);
    cursor: pointer;
    transition: background 0.15s ease;
}
.add-frame:hover:not(:disabled) { background: color-mix(in oklab, var(--drawdy-primary, #6366f1) 10%, transparent); }
.add-frame:focus-visible { outline: 2px solid var(--drawdy-ring, #94ba00); outline-offset: 2px; }
.add-frame:disabled { opacity: 0.5; cursor: default; }
.status {
    font-size: 11px;
    line-height: 1.6;
    text-align: center;
    text-wrap: balance;
    color: var(--drawdy-muted-foreground, #888);
}
.status.hint { color: var(--drawdy-warning, #d97706); }
.status b { color: var(--drawdy-foreground, #111); font-weight: 600; }
</style>
</head>
<body>
<main>
    <header>
        <svg class="mark" viewBox="0 0 28 16" aria-hidden="true"><path d="M1 8c3.2-7.5 6.4-7.5 9.6 0s6.4 7.5 9.6 0 4.6-3.4 6.8 0"/></svg>
        <div class="brand">Serene</div>
        <div class="chip" id="range-chip">C4&ndash;C7</div>
    </header>

    <div class="hero">
        <div class="dial">
            <svg class="ring" viewBox="0 0 132 132" aria-hidden="true">
                <circle class="ring-track" cx="66" cy="66" r="54"></circle>
                <circle class="ring-fill" id="ring" cx="66" cy="66" r="54"></circle>
            </svg>
            <button id="play" type="button" disabled aria-label="Play">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path id="play-icon" d="M9 5.5v13l10-6.5z"/></svg>
            </button>
        </div>
        <div class="meter">
            <div class="time" id="time"><b>0.0</b> / 0.0s</div>
            <button id="loop" type="button" class="loop" aria-pressed="false" aria-label="Loop">&#8635; Loop</button>
        </div>
    </div>

    <section class="card">
        <div class="row">
            <label for="scale">Scale</label>
            <select id="scale"></select>
        </div>
        <div class="row">
            <label for="low">Range</label>
            <select id="low" aria-label="Lowest octave"></select>
            <span class="val" style="width:auto">to</span>
            <select id="high" aria-label="Highest octave"></select>
        </div>
    </section>

    <section class="card rack" id="rack"></section>

    <section class="card">
        <div class="row">
            <label for="add-frame">Frames</label>
            <button id="add-frame" type="button" class="add-frame">Add a Serene frame</button>
            <span class="val" id="frame-count">0</span>
        </div>
    </section>

    <div class="status" id="status">Select a <b>Serene frame</b> and press the play button that appears above it.</div>
</main>
<script>
(function () {
    var api = acquireDrawdyApi();
    var themeStyle = document.getElementById("theme");
    var playBtn = document.getElementById("play");
    var playIcon = document.getElementById("play-icon");
    var ring = document.getElementById("ring");
    var timeEl = document.getElementById("time");
    var loopBtn = document.getElementById("loop");
    var statusEl = document.getElementById("status");
    var scaleSelect = document.getElementById("scale");
    var lowSelect = document.getElementById("low");
    var highSelect = document.getElementById("high");
    var rangeChip = document.getElementById("range-chip");
    var MIN_OCTAVE = 1;
    var MAX_OCTAVE = 8;

    function fillOctaves(select, from, to) {
        select.textContent = "";
        for (var octave = from; octave <= to; octave++) {
            var option = document.createElement("option");
            option.value = String(octave);
            option.textContent = "C" + octave;
            select.appendChild(option);
        }
    }
    fillOctaves(lowSelect, MIN_OCTAVE, MAX_OCTAVE - 1);
    fillOctaves(highSelect, MIN_OCTAVE + 1, MAX_OCTAVE);

    function showRange(low, high) {
        lowSelect.value = String(low);
        highSelect.value = String(high);
        rangeChip.textContent = "C" + low + "\u2013C" + high;
    }
    var rack = document.getElementById("rack");
    var addFrameBtn = document.getElementById("add-frame");
    var frameCountEl = document.getElementById("frame-count");

    var ARC_LENGTH = 84.823;
    var ARC_PATH = "M11.27 36.73A18 18 0 1 1 36.73 36.73";
    var DRAG_PX = 170;
    var FINE = 4;
    var WHEEL_STEP = 0.03;
    var WHEEL_COMMIT_MS = 220;

    function asPercent(value) {
        return Math.round(value * 100) + "%";
    }

    var KNOB_SPECS = [
        {
            id: "speed",
            label: "Speed",
            min: 40,
            max: 900,
            step: 10,
            value: 220,
            format: function (v) { return String(Math.round(v)); },
        },
        {
            id: "attack",
            label: "Attack",
            min: 0,
            max: 0.3,
            step: 0.005,
            value: 0.02,
            format: function (v) { return Math.round(v * 1000) + "ms"; },
        },
        {
            id: "volume",
            label: "Volume",
            min: 0,
            max: 1,
            step: 0.01,
            value: 0.7,
            format: asPercent,
        },
        {
            id: "reverb",
            label: "Reverb",
            min: 0,
            max: 1,
            step: 0.01,
            value: 0.38,
            format: asPercent,
        },
    ];

    function renderKnob(knob) {
        var spec = knob.spec;
        var value = Number(knob.input.value);
        var ratio = (value - spec.min) / (spec.max - spec.min);
        knob.fill.style.strokeDashoffset = String(ARC_LENGTH * (1 - ratio));
        knob.tick.setAttribute(
            "transform",
            "rotate(" + (225 + 270 * ratio).toFixed(2) + " 24 24)"
        );
        knob.valueEl.textContent = spec.format(value);
        knob.el.setAttribute("aria-valuenow", String(value));
        knob.el.setAttribute("aria-valuetext", spec.format(value));
    }

    function quantize(spec, raw) {
        var clamped = Math.max(spec.min, Math.min(spec.max, raw));
        var steps = Math.round((clamped - spec.min) / spec.step);
        return Number((spec.min + steps * spec.step).toFixed(6));
    }

    function applyKnob(knob, raw, commit, silent) {
        var next = quantize(knob.spec, raw);
        var changed = next !== Number(knob.input.value);
        if (changed) {
            knob.input.value = String(next);
            renderKnob(knob);
            if (!silent) knob.input.dispatchEvent(new Event("input"));
        }
        if (commit && !silent) knob.input.dispatchEvent(new Event("change"));
    }

    function nudgeKnob(knob, ratioDelta, commit) {
        var spec = knob.spec;
        applyKnob(
            knob,
            Number(knob.input.value) + ratioDelta * (spec.max - spec.min),
            commit,
            false
        );
    }

    function buildKnob(spec) {
        var input = document.createElement("input");
        input.type = "range";
        input.id = spec.id;
        input.min = String(spec.min);
        input.max = String(spec.max);
        input.step = String(spec.step);
        input.value = String(spec.value);
        input.hidden = true;

        var el = document.createElement("div");
        el.className = "knob";
        el.tabIndex = 0;
        el.setAttribute("role", "slider");
        el.setAttribute("aria-label", spec.label);
        el.setAttribute("aria-valuemin", String(spec.min));
        el.setAttribute("aria-valuemax", String(spec.max));
        el.innerHTML =
            '<svg viewBox="0 0 48 48" aria-hidden="true">' +
            '<path class="k-track" d="' + ARC_PATH + '"/>' +
            '<path class="k-fill" d="' + ARC_PATH + '"/>' +
            '<circle class="k-cap" cx="24" cy="24" r="12.5"/>' +
            '<line class="k-tick" x1="24" y1="16.4" x2="24" y2="11.6"/>' +
            "</svg>" +
            '<div class="k-label"></div>' +
            '<div class="k-value"></div>';

        var knob = {
            spec: spec,
            input: input,
            el: el,
            fill: el.querySelector(".k-fill"),
            tick: el.querySelector(".k-tick"),
            valueEl: el.querySelector(".k-value"),
            dragging: false,
            lastY: 0,
            wheelTimer: null,
        };
        el.querySelector(".k-label").textContent = spec.label;

        el.addEventListener("pointerdown", function (event) {
            event.preventDefault();
            el.setPointerCapture(event.pointerId);
            el.focus();
            knob.dragging = true;
            knob.lastY = event.clientY;
            el.classList.add("live");
        });
        el.addEventListener("pointermove", function (event) {
            if (!knob.dragging) return;
            var dy = knob.lastY - event.clientY;
            knob.lastY = event.clientY;
            nudgeKnob(knob, dy / (event.shiftKey ? DRAG_PX * FINE : DRAG_PX), false);
        });
        var release = function () {
            if (!knob.dragging) return;
            knob.dragging = false;
            el.classList.remove("live");
            knob.input.dispatchEvent(new Event("change"));
        };
        el.addEventListener("pointerup", release);
        el.addEventListener("pointercancel", release);
        el.addEventListener("dblclick", function () {
            applyKnob(knob, spec.value, true, false);
        });
        el.addEventListener(
            "wheel",
            function (event) {
                event.preventDefault();
                nudgeKnob(knob, event.deltaY < 0 ? WHEEL_STEP : -WHEEL_STEP, false);
                clearTimeout(knob.wheelTimer);
                knob.wheelTimer = setTimeout(function () {
                    knob.input.dispatchEvent(new Event("change"));
                }, WHEEL_COMMIT_MS);
            },
            { passive: false }
        );
        el.addEventListener("keydown", function (event) {
            if (event.key === "Home") {
                event.preventDefault();
                applyKnob(knob, spec.min, true, false);
                return;
            }
            if (event.key === "End") {
                event.preventDefault();
                applyKnob(knob, spec.max, true, false);
                return;
            }
            var up = event.key === "ArrowUp" || event.key === "ArrowRight";
            var down = event.key === "ArrowDown" || event.key === "ArrowLeft";
            if (!up && !down) return;
            event.preventDefault();
            var amount = spec.step * (event.shiftKey ? 10 : 1);
            applyKnob(
                knob,
                Number(input.value) + (up ? amount : -amount),
                true,
                false
            );
        });

        rack.appendChild(el);
        rack.appendChild(input);
        renderKnob(knob);
        return knob;
    }

    var knobs = {};
    KNOB_SPECS.forEach(function (spec) {
        knobs[spec.id] = buildKnob(spec);
    });
    var speedInput = knobs.speed.input;
    var attackInput = knobs.attack.input;
    var volumeInput = knobs.volume.input;
    var reverbInput = knobs.reverb.input;

    var LOOKAHEAD = 0.25;
    var PROGRESS_MS = 33;
    var DECAY = 0.22;
    var MIN_ATTACK = 0.002;
    var SUSTAIN_RATIO = 0.45;
    var RELEASE = 0.55;
    var PERCUSSIVE_TAU = 0.32;
    var PEAK_GAIN = 0.2;
    var LIMIT_THRESHOLD = -3;
    var LIMIT_RATIO = 20;
    var LIMIT_ATTACK = 0.002;
    var LIMIT_RELEASE = 0.18;
    var LIMIT_TRIM = 0.821;
    var RING_LENGTH = 339.292;
    var PLAY_PATH = "M9 5.5v13l10-6.5z";
    var STOP_PATH = "M7.5 7.5h9v9h-9z";

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
        master.gain.value = Number(volumeInput.value);
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
        wet.gain.value = Number(reverbInput.value);
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
            var slide = allowGlide ? span : 0;
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
        var parts = [Math.round(note.t * px), Math.round((note.t + note.d) * px)];
        for (var i = 0; i < note.pitches.length; i++) {
            parts.push(note.pitches[i].row + "@" + Math.round(note.pitches[i].t * px));
        }
        return parts.join("|");
    }

    function holdFor(note) {
        return Math.max(0.09, note.d);
    }

    function releaseAt(gain, end) {
        gain.gain.setTargetAtTime(0.0001, end, RELEASE / 3);
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
        var sustain = Math.max(0.0004, peak * SUSTAIN_RATIO);
        var end = Math.max(now, at + holdFor(note));
        var attack = Math.max(MIN_ATTACK, Number(attackInput.value));
        var osc = ctx.createOscillator();
        osc.type = "sine";
        schedulePitches(osc, at, note.pitches, undefined, note.g);
        var gain = ctx.createGain();
        var stopAt;
        if (at >= now) {
            stopAt = scheduleEnvelope(gain, at, peak, sustain, attack, end);
        } else {
            gain.gain.setValueAtTime(sustain, now);
            releaseAt(gain, end);
            stopAt = end + RELEASE * 3;
        }
        osc.connect(gain);
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
        voice.osc.frequency.cancelScheduledValues(now);
        schedulePitches(voice.osc, at, note.pitches, now, note.g);
        var level = Math.max(0.0001, voice.gain.gain.value);
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(level, now);
        if (level > voice.sustain * 1.02) {
            voice.gain.gain.exponentialRampToValueAtTime(
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
            voice.gain.gain.cancelScheduledValues(now);
            voice.gain.gain.setTargetAtTime(0.0001, now, 0.03);
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
        elapsed = Math.max(
            0,
            Math.min(score.durationSec, audio.ctx.currentTime - startTime)
        );
        render();
        api.postMessage({ type: "progress", t: elapsed });
    }

    function rewindScheduling(now) {
        scheduleOrigin = startTime;
        scheduledUntil = now;
        cursor = firstVoiceAtOrAfter(now - startTime);
    }

    function start() {
        if (!score || score.voices.length === 0) return;
        resumeAudio().then(function (ok) {
            syncPulse();
            if (!ok) {
                setStatusText(
                    "Audio stays blocked until you click inside this panel.",
                    true
                );
                return;
            }
            stopTimers();
            killVoices();
            var from = elapsed > 0 && elapsed < score.durationSec ? elapsed : 0;
            var now = audio.ctx.currentTime;
            startTime = now + 0.12 - from;
            elapsed = from;
            rewindScheduling(now);
            setPlaying(true);
            api.postMessage({ type: "started" });
            pumpTimer = setInterval(pump, 25);
            progressTimer = setInterval(tickProgress, PROGRESS_MS);
            pump();
            reconcileVoices();
            render();
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
        render();
        api.postMessage({ type: reason });
    }

    function finish() {
        if (!playing) return;
        stopTimers();
        fadePendingVoices(audio.ctx.currentTime);
        setPlaying(false);
        elapsed = 0;
        render();
        api.postMessage({ type: "ended" });
    }

    function fadePendingVoices(now) {
        var live = voices.slice();
        for (var i = 0; i < live.length; i++) {
            if (live[i].start > now) fadeVoice(live[i], now);
        }
    }

    function setLoop(next, announce) {
        loop = Boolean(next);
        loopBtn.setAttribute("aria-pressed", loop ? "true" : "false");
        if (!loop && playing && audio) {
            var now = audio.ctx.currentTime;
            fadePendingVoices(now);
            rewindScheduling(now);
        }
        if (announce) api.postMessage({ type: "loop", value: loop });
    }

    function setPlaying(next) {
        playing = next;
        document.body.classList.toggle("playing", next);
        playIcon.setAttribute("d", next ? STOP_PATH : PLAY_PATH);
        playBtn.setAttribute("aria-label", next ? "Stop" : "Play");
    }

    function render() {
        var total = score ? score.durationSec : 0;
        timeEl.innerHTML =
            "<b>" + elapsed.toFixed(1) + "</b> / " + total.toFixed(1) + "s";
        var progress = total > 0 ? Math.min(1, elapsed / total) : 0;
        ring.style.strokeDashoffset = String(RING_LENGTH * (1 - progress));
    }

    function setStatus(html, warn) {
        statusEl.innerHTML = html;
        statusEl.className = warn ? "status hint" : "status";
    }

    function setStatusText(text, warn) {
        statusEl.textContent = text;
        statusEl.className = warn ? "status hint" : "status";
    }

    function syncPulse() {
        var waitingForFirstClick =
            Boolean(score) && score.voices.length > 0 && !playing && !audioUnlocked();
        playBtn.classList.toggle("pulse", waitingForFirstClick);
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
        render();
        describe();
    }

    function seekTo(t) {
        if (!score) return;
        var target = Math.max(0, Math.min(score.durationSec, t));
        if (!playing) {
            elapsed = target >= score.durationSec ? 0 : target;
            render();
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
        render();
        api.postMessage({ type: "progress", t: target });
    }

    function describe() {
        if (!score) return;
        syncPulse();
        if (score.voices.length === 0) {
            setStatusText("Nothing to play in that region.", true);
            return;
        }
        if (!audioUnlocked()) {
            setStatusText(
                "Press play once to let this panel make sound.",
                true
            );
            return;
        }
        setStatus(
            "<b>" +
                score.voices.length +
                "</b> legato voices from <b>" +
                score.elementCount +
                "</b> elements<br />" +
                score.scaleName +
                " &middot; " +
                Math.round(score.rectWidth) +
                "&#215;" +
                Math.round(score.rectHeight) +
                " px",
            false
        );
    }

    function setFrames(count) {
        frameCountEl.textContent = String(count);
        addFrameBtn.textContent =
            count > 0 ? "Add another Serene frame" : "Add a Serene frame";
        addFrameBtn.disabled = false;
    }

    addFrameBtn.addEventListener("click", function () {
        addFrameBtn.disabled = true;
        api.postMessage({ type: "add-frame" });
    });

    loopBtn.addEventListener("click", function () {
        setLoop(!loop, true);
    });

    playBtn.addEventListener("click", function () {
        if (playing) {
            stop("stopped");
            return;
        }
        start();
    });

    speedInput.addEventListener("change", function () {
        api.postMessage({ type: "speed", value: Number(speedInput.value) });
    });

    function postKnobs() {
        api.postMessage({
            type: "knobs",
            values: {
                attack: Number(attackInput.value),
                volume: Number(volumeInput.value),
                reverb: Number(reverbInput.value),
            },
        });
    }

    [attackInput, volumeInput, reverbInput].forEach(function (input) {
        input.addEventListener("change", postKnobs);
    });

    function applySettings(values) {
        ["attack", "volume", "reverb"].forEach(function (key) {
            if (typeof values[key] === "number") {
                applyKnob(knobs[key], values[key], false, true);
            }
        });
        if (typeof values.speed === "number") {
            applyKnob(knobs.speed, values.speed, false, true);
        }
        if (typeof values.loop === "boolean") setLoop(values.loop, false);
        if (typeof values.lowOctave === "number" && typeof values.highOctave === "number") {
            showRange(values.lowOctave, values.highOctave);
        }
        if (audio) {
            audio.master.gain.value = Number(volumeInput.value);
            audio.wet.gain.value = Number(reverbInput.value);
        }
    }

    volumeInput.addEventListener("input", function () {
        if (audio) audio.master.gain.value = Number(volumeInput.value);
    });

    reverbInput.addEventListener("input", function () {
        if (audio) audio.wet.gain.value = Number(reverbInput.value);
    });

    function postRange(changed) {
        var low = Number(lowSelect.value);
        var high = Number(highSelect.value);
        if (low >= high) {
            if (changed === "low") high = Math.min(MAX_OCTAVE, low + 1);
            else low = Math.max(MIN_OCTAVE, high - 1);
        }
        showRange(low, high);
        api.postMessage({ type: "range", low: low, high: high });
    }

    lowSelect.addEventListener("change", function () { postRange("low"); });
    highSelect.addEventListener("change", function () { postRange("high"); });

    scaleSelect.addEventListener("change", function () {
        api.postMessage({ type: "scale", value: scaleSelect.value });
    });

    api.onMessage(function (msg) {
        if (!msg || typeof msg !== "object") return;
        if (msg.type === "theme") {
            themeStyle.textContent = ":root{" + msg.css + "}";
            return;
        }
        if (msg.type === "stop") {
            stop("stopped");
            return;
        }
        if (msg.type === "frames") {
            setFrames(msg.count);
            return;
        }
        if (msg.type === "settings") {
            applySettings(msg.values);
            return;
        }
        if (msg.type === "seek") {
            seekTo(msg.t);
            return;
        }
        if (msg.type === "scales") {
            scaleSelect.textContent = "";
            msg.scales.forEach(function (scale) {
                var option = document.createElement("option");
                option.value = scale.id;
                option.textContent = scale.name;
                scaleSelect.appendChild(option);
            });
            scaleSelect.value = msg.current;
            return;
        }
        if (msg.type !== "score") return;
        if (msg.live && playing) {
            swapScore(msg.score);
            return;
        }
        if (playing) stop("stopped");
        score = msg.score;
        if (scaleSelect.options.length > 0) scaleSelect.value = score.scaleId;
        showRange(score.lowOctave, score.highOctave);
        applyKnob(knobs.speed, score.pxPerSecond, false, true);
        elapsed = 0;
        playBtn.disabled = score.voices.length === 0;
        render();
        describe();
        api.postMessage({ type: "progress", t: 0 });
        if (msg.autoplay && audioUnlocked()) start();
    });

    render();
    api.postMessage({ type: "ready" });
})();
</script>
</body>
</html>`;

// Mozart portrait (assets/serene-icon-256.webp, 128px) embedded so the rail icon ships inside main.js.
const ACTION_BUTTON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18"><clipPath id="drawdy-serene-rail-clip"><rect width="24" height="24" rx="5"/></clipPath><image href="data:image/webp;base64,UklGRoYJAABXRUJQVlA4IHoJAABwMQCdASqAAIAAPlEijkUjoiMhKBQMKHAKCWMAxBxHPDdTShAS9lv097grzG+dLpxfoAdLBP3Oj8Z+vGh4lB1qOoWanMs2YbQ9sbmeD/56NGeT2UUBPGLL7Tg+nqbymBqZKj0sl1RkbGqP5tvN4uW+Kw0g+huo2KDD0/+YYLA6rb5xNYRIWTSQdcEGjj3dwnUzRhEtUxxd9IWUaUUN5FDtaS8/d7As4RISL7z4vkqZTdBHmhTKbi7b1/Op+WVmJBnInM0kuuYLN1kYR4/+ip6vARSNFQB3AkNAXSA8etr0Ou9bOAKFyAXggSqyG6735C2nvdxUd8ddiDHRYIqgjGiFK6QREK0pKQZq5i1/9ozq6Nr1obLl1TH5QkEJmY8HDc1FoyWxKRHRou5MQwOuyzcc2fuNqeFqgyu1ucPjmPO/KFJQYrDsuYRHT93dzSCYYzOw2LwzEw3hkdHs7UOMP8o5r8jKN4E9LzP2/iI7dRwJ4/O9PhPtpG1T6Uk/rOzXyH7yUKy/XH8lYNhg5ar+4kAuChbyAAD+/AP5dgWKDhlohUi8R8XiJvtt6OLAQyZTCWXdj9vC1YclbbY8g1ODBCT7ST4xl+gd9uv/dZn9DG6FgPCrPtQWl3gPdJddadn0+r8uz472YA0GUJIvoVeSNIE2vUyQCDvkgwQ4Mw4aKEW3lrchjNCv/ZrHrBCEgbfwEfok1ejy9x/ZFYVQwd4x8Xk4V8h6vB09RnzXMR28DgKGoNDG4MZfntRBpdZeZnFYA7SmGgFAMpIE59gzk6m3Ra1hlPM464gwx/BDaahn8e8JIpePvkLthzSAAXZHzairEXNZ1mjNM2RT0PgeqLyRUnhw0piPqT9aa9anVNZgU47nT292m/wsExk9PDR7aCHU2sBf4gSNjoreTHFilIEU8hLXzcexktm94VfXhZ41WmjxMsmN0xOSkcl6/PeGLPZ3xoPM2b7hQVMSseSJ9NilXpwZxEGNOGuxclpyzp4pQ3+XPjI2c6DndIJqoX/vyk3R6pFx9HRDQgGrPuBbQ+8mDvcDA95wvPUWD23dkggtnHG4CKYXNzmJ2q+BmJctC8+jybFTa4ZBLnqnXg1V0iKrFj5PmH7QgiysCnZqH6Ja1VzoRj6RPtgOV8/sEtj3XkKZhnhigIEL/1BeE9kZ3z6MmSPXOTpnQHnFP7L68GIdb+ALYjs6WYb6HajCMZ0UJzzyfq2pnKiu4x561OS+upXryEGaULYNXPhqoCl2W65VnMWu5PBdGpttgbP0gPVpt9p9AmQJvRryaCI3oUtNeBvQEunTZYJY5b1oa//OwP66l4cxUYvxKnAusToW2Lm5ANfXLM1W0JdM40SjRh84pLaNEie+w1NXbRbGBc15rzL7ybeRlJyF3p6Lvdr8jvqozde8A7jbB2OFfFGlQsqTCDeXufSVHHUF4sJwmJhnQcVuibyzAV+MtKUU3sKs3q/Z77qFWFkQrJSzGvzLkbyFpgV2ROkaGcNb4LJvl8TMRw4e+3pylj3KwjVaeCSMNYAZwwrjm5UTqvqACXbplqJbH2rb9UHF1BF1CW0syXqhLODufi+8WpmVv98Xop75oOI4BYNutqvBUpDKN9CvpkHoaL7xzeU0UjTK6vGwfre1GkVvh90Ly6mIkc+NIZqBWeetHLrI5qt37sHiPNjZce4aA1EgiRDXZBulzXSkcomf+43WhTEXiPsXIO4qvA3uEC/BwzOKA5yM3+NYX7vm5pHrpAUCd5XoqPbwSsb2K6fUjywavzOSRmqvqcfWLSjof+T5klSG03P1oEJ9xa3/w2FBpFHgLJTVNwNE4dsxEKsFui1iLLWUGuMzEfBf/UAdSgasxsmpj1QqqIejUOMB4pJgzs0hSWoBZ/L2Kc7WuVNU7IjQ7D9XAzo4upoEnj+v2VwuvUzIMDSY6Y4H1pJ34Lnn8GNcMjgYMRi7aQPP24i34/CNXCwC9MOoVdbF/15UaqhBvyfddJ3KcRTMQtzfqN1telx+28vpIwvA9/AGOwKbxh6uobduQ0duLzCF3u+pbMv0qKfJWeEZf+zDToUNY3Sdd2hrfOKdx0FeWsWpCehpQrmicdU7ZwlHOHYjEjOhtrSNGrk723v/w5zDyHplAr+JR/OF+G89OB4EtHIUw46Fg1pn3ZX2zFjhW9bDS4/gJ7hbD2KnXW1zu2eXR+a24cZvvxHbLv3L9rKBeJTLR1M+8h6xi4/K80+e+1T/AtJ5qti+gOCreQNqQ3LMKc3qbWRSCBSwJxSo2/73WYHaj0OFWpG6gtHERYdJa0MiMowFYf/fqgZlKp8Qj4DbivmMVBhsGqK3KgVdzXPG528fN2iL+4aVLTUgjoun9wx5TbGDQmWaLTbdZigSp0o7HiwxBUsHtefVGJhSkTfoX5MBOsYwmy02Id9wyytN5hhku7RIsulgwJhTq+TLY/l5j/33eomn/0x/2vVtfpNE1GIEr5/cCMH97jYGK5mKDslGUpcDnis9lLJNTqCrnPQ36/9fWlJM/6R3xYya5CEmD1cxwrUDpZ1Ic2WBuMTf0wHxEzQEoNSiHc3Q0CivF8cYAgEdL+2c5U2CLm5u9Jvxwo9Cj/G1+GXdTll1q1BmQe8QWLhOuqbJZOStnVk6vI7uBBk8LzqI3FtMG1jIXq5wiv3D+MY+1k0p4Gf3231UHYM+b+UJXeuJD+hicxzgK8WaNe1m7CIkSKIzQlyeL8I68BktOZQl7dn15aKo/B9j61C98Au3xnxkQ1utFsPbJd5CYj9tOef3eP375+CH5fsluiqO21wuTVAE+v4GaTWGNJjj2yX6LBRdOj0Y4He7vEq+/2uGns5TqSQJ1vgy51uDSaicJw43ZQAliWTZwSdLGsPBjMhka5WSTJq1nO1fckeBk7Ba13gOsfovlHP+1Vv/X/Dc3W/kqYrWrPcjaWn9/8txMb+bwnVOjvlEl5I1QSC6CAyUciwtgUX6V5xaaXk39N5R0/4utTIWnTb1V4jhyTAkzq0aH82mQLO4H1OVEs/j8Cc30itf47rX955gV15sIvaGo/ZQ7eKSHYHbhH/sXitmIHvkpuvTj6kt0OpfYEOVSUDHCYDvhdnlxq3x2FZqOOnOkhe9TU5ASsOqi6gYcLZ+q1EfLkIoY2RlS2PguOIFhCdtWwndY0Rl4ORSM5Jo43EtiHgL2IVgpbjXqRDROx61MW1/gXGksS6WYrd0bhbIMNfDyikzrEoZNO5z69zouwkQPEAAAA==" x="0" y="0" width="24" height="24" clip-path="url(#drawdy-serene-rail-clip)"/></svg>`;
const actionButtonId = (driverId) => `${driverId}:action-button`;
const panelWebviewId = (driverId) => `${driverId}:webview`;
function stylingCssVars(styling) {
    return Object.entries(styling)
        .map(([key, value]) => key === "theme"
        ? `color-scheme: ${value};`
        : `--drawdy-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${value};`)
        .join("");
}
const serializeVoice = (score) => (voice) => ({
    t: voice.startSec,
    d: voice.durationSec,
    v: voice.velocity,
    g: voice.glide,
    pitches: voice.pitches.map((pitch) => ({
        t: pitch.t,
        hz: rowToHz(score.scale, score.range, pitch.row),
        row: pitch.row,
    })),
});
function serializeScore(score, elementCount) {
    return {
        durationSec: score.durationSec,
        pxPerSecond: score.pxPerSecond,
        rectWidth: score.rect.width,
        rectHeight: score.rect.height,
        elementCount,
        scaleId: score.scale.id,
        scaleName: score.scale.name,
        lowOctave: score.range.lowOctave,
        highOctave: score.range.highOctave,
        voices: score.voices.map(serializeVoice(score)),
    };
}
async function openPanel(ctx, styling) {
    await ctx.issueCommand({
        type: "command:webview:create",
        ...stamp(ctx),
        req: {
            webviewDomId: panelWebviewId(ctx.driverId),
            htmlContent: PANEL_HTML.replace("/*__DRAWDY_STYLING__*/", stylingCssVars(styling)),
            keepStateWhenClosed: true,
        },
    });
}
const scaleOptions = () => SCALES.map((scale) => ({ id: scale.id, name: scale.name }));
function postToPanel(ctx, message) {
    void ctx.issueCommand({
        type: "command:webview:post-message",
        ...stamp(ctx),
        req: { webviewDomId: panelWebviewId(ctx.driverId), message },
    });
}

const PLAYHEAD_WIDTH = 2;
const REGION_SEED = 7;
const LINE_SEED = 11;
class Playhead {
    _ctx;
    _styling;
    _previewId = null;
    _rect = null;
    _inFlight = false;
    _pendingX = null;
    _lastX = null;
    constructor(_ctx, _styling) {
        this._ctx = _ctx;
        this._styling = _styling;
    }
    setStyling(styling) {
        this._styling = styling;
        const rect = this._rect;
        if (!this._previewId || !rect)
            return;
        void this._ctx.issueCommand({
            type: "command:scene:update-drawdy-preview-elements",
            ...stamp(this._ctx),
            req: {
                elements: [
                    this._regionSchema(rect),
                    this._lineSchema(rect, this._lastX ?? rect.x),
                ],
            },
        });
    }
    get _lineId() {
        return `${this._ctx.driverId}:playhead-line`;
    }
    get _regionId() {
        return `${this._ctx.driverId}:playhead-region`;
    }
    _lineSchema(rect, x) {
        return {
            type: "line",
            drawdyElementId: this._lineId,
            color: this._styling.primary,
            strokeWidth: PLAYHEAD_WIDTH,
            roughness: 0,
            seed: LINE_SEED,
            from: [x, rect.y],
            to: [x, rect.y + rect.height],
        };
    }
    _regionSchema(rect) {
        return {
            type: "shape",
            drawdyElementId: this._regionId,
            componentType: "rect",
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            strokeColor: this._styling.border,
            fillColor: "transparent",
            strokeWidth: 1,
            strokeDash: "dashed",
            cornerRadius: 0,
            roughness: 0,
            seed: REGION_SEED,
            opacity: 0.7,
        };
    }
    async show(rect) {
        await this.hide();
        const { previewId } = unwrap(await this._ctx.issueCommand({
            type: "command:scene:create-drawdy-preview-elements",
            ...stamp(this._ctx),
            req: {
                elements: [
                    this._regionSchema(rect),
                    this._lineSchema(rect, rect.x),
                ],
            },
        }));
        this._previewId = previewId;
        this._rect = rect;
        this._lastX = rect.x;
    }
    move(x) {
        if (!this._previewId || !this._rect)
            return;
        this._pendingX = x;
        if (this._inFlight)
            return;
        void this._flush();
    }
    async _flush() {
        const rect = this._rect;
        if (!rect || this._pendingX === null)
            return;
        const x = this._pendingX;
        this._pendingX = null;
        this._lastX = x;
        this._inFlight = true;
        try {
            await this._ctx.issueCommand({
                type: "command:scene:update-drawdy-preview-elements",
                ...stamp(this._ctx),
                req: { elements: [this._lineSchema(rect, x)] },
            });
        }
        finally {
            this._inFlight = false;
        }
        if (this._pendingX !== null)
            await this._flush();
    }
    async hide() {
        this._pendingX = null;
        this._lastX = null;
        this._rect = null;
        const previewId = this._previewId;
        this._previewId = null;
        if (!previewId)
            return;
        await this._ctx.issueCommand({
            type: "command:scene:delete-drawdy-preview-elements",
            ...stamp(this._ctx),
            req: { previewIds: [previewId] },
        });
    }
}

function rotatePoint(p, cx, cy, angle) {
    if (angle === 0)
        return [p[0], p[1]];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}
function rotatePolyline(points, cx, cy, angle) {
    if (angle === 0)
        return points;
    return points.map((p) => rotatePoint(p, cx, cy, angle));
}
function combineRects(rects) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const r of rects) {
        if (r.width < 0 || r.height < 0)
            continue;
        minX = Math.min(minX, r.x);
        minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.width);
        maxY = Math.max(maxY, r.y + r.height);
    }
    if (!isFinite(minX))
        return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
function rectContainsPoint(rect, x, y) {
    return (x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= rect.y + rect.height);
}
function rectArea(rect) {
    return Math.max(0, rect.width) * Math.max(0, rect.height);
}
function monotonicRuns(line) {
    if (line.length < 2)
        return [];
    const runs = [];
    let current = [line[0]];
    let direction = 0;
    for (let i = 1; i < line.length; i++) {
        const dx = line[i][0] - line[i - 1][0];
        const sign = dx > 0 ? 1 : dx < 0 ? -1 : 0;
        if (sign !== 0 && direction !== 0 && sign !== direction) {
            runs.push(current);
            current = [line[i - 1]];
            direction = sign;
        }
        else if (direction === 0) {
            direction = sign;
        }
        current.push(line[i]);
    }
    runs.push(current);
    return runs
        .filter((run) => run.length >= 2)
        .map((run) => run[run.length - 1][0] < run[0][0] ? [...run].reverse() : run);
}
function evenPick(items, keep) {
    if (items.length <= keep)
        return items;
    if (keep <= 1)
        return [items[0]];
    const out = [];
    for (let i = 0; i < keep; i++) {
        out.push(items[Math.round((i * (items.length - 1)) / (keep - 1))]);
    }
    return out;
}
function rectsOverlap(a, b) {
    return (a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y);
}

const ELLIPSE_SEGMENTS = 48;
const STROKE_COMPONENT_TYPES = new Set(["line", "arrow"]);
function elementGlides(el) {
    return (el.type === "freedraw" ||
        STROKE_COMPONENT_TYPES.has(el.componentType ?? ""));
}
const OPACITY_CURVE = 2;
function elementGain(el) {
    const opacity = el.opacity;
    if (typeof opacity !== "number" || !Number.isFinite(opacity))
        return 1;
    return Math.pow(Math.min(1, Math.max(0, opacity)), OPACITY_CURVE);
}
function elementBounds(el) {
    const { x, y, width, height } = el;
    if (x == null || y == null || width == null || height == null)
        return null;
    return { x, y, width, height };
}
function closed(points) {
    if (points.length < 2)
        return points;
    const first = points[0];
    const last = points[points.length - 1];
    if (first[0] === last[0] && first[1] === last[1])
        return points;
    return [...points, [first[0], first[1]]];
}
function rectOutline(r) {
    return closed([
        [r.x, r.y],
        [r.x + r.width, r.y],
        [r.x + r.width, r.y + r.height],
        [r.x, r.y + r.height],
    ]);
}
function diamondOutline(r) {
    return closed([
        [r.x + r.width / 2, r.y],
        [r.x + r.width, r.y + r.height / 2],
        [r.x + r.width / 2, r.y + r.height],
        [r.x, r.y + r.height / 2],
    ]);
}
function ellipseOutline(r) {
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const out = [];
    for (let i = 0; i <= ELLIPSE_SEGMENTS; i++) {
        const t = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
        out.push([
            cx + (r.width / 2) * Math.cos(t),
            cy + (r.height / 2) * Math.sin(t),
        ]);
    }
    return out;
}
function shapeOutline(componentType, r) {
    switch (componentType) {
        case "rect":
            return rectOutline(r);
        case "diamond":
            return diamondOutline(r);
        case "circle":
            return ellipseOutline(r);
        default:
            return null;
    }
}
function elementLines(el) {
    if (el.type === "frame")
        return [];
    const bounds = elementBounds(el);
    const rotation = el.rotation ?? 0;
    const center = bounds
        ? [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2]
        : null;
    const spin = (points) => center ? rotatePolyline(points, center[0], center[1], rotation) : points;
    if (el.type === "freedraw") {
        const points = el.points;
        if (!points || points.length < 2)
            return [];
        return [points.map(([x, y]) => [x, y])];
    }
    if (STROKE_COMPONENT_TYPES.has(el.componentType ?? "")) {
        const points = el.points;
        if (!points || points.length < 2)
            return [];
        return [spin(points.map(([x, y]) => [x, y]))];
    }
    if (!bounds || bounds.width < 0 || bounds.height < 0)
        return [];
    const outline = shapeOutline(el.componentType, bounds);
    if (outline)
        return [spin(outline)];
    return [spin(rectOutline(bounds))];
}
function elementInk(el) {
    const gain = elementGain(el);
    const glide = elementGlides(el);
    return elementLines(el)
        .filter((line) => line.length >= 2)
        .map((points) => ({ points, gain, glide }));
}
function sceneInk(elements) {
    return elements.flatMap(elementInk);
}
function laserInk(strokes) {
    return strokes
        .filter((stroke) => stroke.length >= 2)
        .map((stroke) => ({
        points: stroke.map(([x, y]) => [x, y]),
        gain: 1,
        glide: true,
    }));
}

const DEFAULT_SCORE_OPTIONS = {
    pxPerSecond: 220,
    stepsPerSecond: 8,
    maxVoices: 5,
    scale: DEFAULT_SCALE_ID,
    lowOctave: DEFAULT_RANGE.lowOctave,
    highOctave: DEFAULT_RANGE.highOctave,
};
const MIN_PX_PER_SECOND = 40;
const MAX_PX_PER_SECOND = 900;
const MIN_DURATION_SEC = 0.4;
const MAX_DURATION_SEC = 180;
const MAX_COLUMNS = 1024;
const MAX_SEGMENT_SAMPLES = 4096;
const MAX_PITCH_POINTS = 256;
const FULL_VELOCITY_HITS = 8;
const MIN_VELOCITY = 0.42;
function clampSpeed(pxPerSecond) {
    if (!isFinite(pxPerSecond))
        return DEFAULT_SCORE_OPTIONS.pxPerSecond;
    return Math.max(MIN_PX_PER_SECOND, Math.min(MAX_PX_PER_SECOND, pxPerSecond));
}
class Grid {
    _rect;
    columns;
    _scale;
    _range;
    cells;
    rows;
    constructor(_rect, columns, _scale, _range) {
        this._rect = _rect;
        this.columns = columns;
        this._scale = _scale;
        this._range = _range;
        this.rows = scaleRows(_scale, _range);
        this.cells = new Array(columns * this.rows).fill(0);
    }
    get colWidth() {
        return this._rect.width / this.columns;
    }
    get rowHeight() {
        return this._rect.height / this.rows;
    }
    locate(x, y) {
        const { _rect: rect } = this;
        if (x < rect.x ||
            x > rect.x + rect.width ||
            y < rect.y ||
            y > rect.y + rect.height) {
            return null;
        }
        const column = Math.max(0, Math.min(this.columns - 1, Math.floor((x - rect.x) / this.colWidth)));
        return {
            column,
            row: yToRow(this._scale, this._range, y, rect.y, rect.height),
        };
    }
    hit(cell) {
        this.cells[cell.column * this.rows + cell.row]++;
    }
    hitsAt(cell) {
        return this.cells[cell.column * this.rows + cell.row];
    }
}
function walkRun(run, grid, sampleStep, onCell) {
    for (let i = 1; i < run.length; i++) {
        const [ax, ay] = run[i - 1];
        const [bx, by] = run[i];
        const length = Math.hypot(bx - ax, by - ay);
        const samples = Math.max(1, Math.min(MAX_SEGMENT_SAMPLES, Math.ceil(length / sampleStep)));
        for (let s = i === 1 ? 0 : 1; s <= samples; s++) {
            const t = s / samples;
            onCell(grid.locate(ax + (bx - ax) * t, ay + (by - ay) * t));
        }
    }
}
function groupByColumn(cells) {
    const groups = [];
    for (const cell of cells) {
        const last = groups[groups.length - 1];
        if (last && last.column === cell.column) {
            if (last.rows[last.rows.length - 1] !== cell.row) {
                last.rows.push(cell.row);
            }
            continue;
        }
        groups.push({ column: cell.column, rows: [cell.row] });
    }
    return groups;
}
function decimate(pitches) {
    if (pitches.length <= MAX_PITCH_POINTS)
        return pitches;
    return evenPick(pitches, MAX_PITCH_POINTS);
}
const GLISSANDO_MIN_ROWS = 3;
function dominantRow(group, grid) {
    let best = group.rows[0];
    let bestHits = -1;
    for (const row of group.rows) {
        const hits = grid.hitsAt({ column: group.column, row });
        if (hits > bestHits) {
            bestHits = hits;
            best = row;
        }
    }
    return best;
}
function snapShallowColumns(groups, grid) {
    return groups.map((group) => group.rows.length >= GLISSANDO_MIN_ROWS
        ? group
        : { column: group.column, rows: [dominantRow(group, grid)] });
}
function runBounds(run) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of run) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
function splitIntoNotes(voice, stepSec) {
    if (voice.pitches.length <= 1)
        return [voice];
    return voice.pitches.map((pitch, index) => {
        const next = voice.pitches[index + 1];
        const startSec = voice.startSec + pitch.t;
        const endSec = next
            ? voice.startSec + next.t
            : voice.startSec + voice.durationSec;
        return {
            startSec,
            durationSec: Math.max(stepSec / 4, endSec - startSec),
            column: Math.floor(startSec / stepSec + 1e-6),
            velocity: voice.velocity,
            glide: false,
            pitches: [{ t: 0, row: pitch.row }],
        };
    });
}
function toVoice(groups, grid, stepSec, gain, glide) {
    if (groups.length === 0)
        return null;
    const firstColumn = groups[0].column;
    const lastColumn = groups[groups.length - 1].column;
    const startSec = firstColumn * stepSec;
    const pitches = [];
    let peak = 0;
    for (const group of groups) {
        const slots = group.rows.length;
        group.rows.forEach((row, index) => {
            peak = Math.max(peak, grid.hitsAt({ column: group.column, row }));
            const at = (group.column + index / slots) * stepSec - startSec;
            const previous = pitches[pitches.length - 1];
            if (previous && previous.row === row)
                return;
            pitches.push({ t: Math.max(0, at), row });
        });
    }
    if (pitches.length === 0)
        return null;
    return {
        startSec,
        durationSec: (lastColumn + 1) * stepSec - startSec,
        column: firstColumn,
        glide,
        velocity: gain *
            (MIN_VELOCITY +
                (1 - MIN_VELOCITY) * Math.min(1, peak / FULL_VELOCITY_HITS)),
        pitches: decimate(pitches),
    };
}
function buildVoices(ink, grid, stepSec, maxVoices) {
    const sampleStep = Math.max(0.5, Math.min(grid.colWidth, grid.rowHeight) / 2);
    const strands = [];
    for (const { points, gain, glide } of ink) {
        if (gain <= 0)
            continue;
        for (const run of monotonicRuns(points)) {
            const bounds = runBounds(run);
            if (bounds.width < grid.colWidth && bounds.height < grid.rowHeight) {
                const dot = grid.locate(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
                if (dot) {
                    grid.hit(dot);
                    strands.push({ cells: [dot], gain, glide });
                }
                continue;
            }
            let pending = [];
            const flush = () => {
                if (pending.length > 0) {
                    strands.push({ cells: pending, gain, glide });
                }
                pending = [];
            };
            walkRun(run, grid, sampleStep, (cell) => {
                if (!cell) {
                    flush();
                    return;
                }
                grid.hit(cell);
                pending.push(cell);
            });
            flush();
        }
    }
    const voices = strands
        .map((strand) => toVoice(snapShallowColumns(groupByColumn(strand.cells), grid), grid, stepSec, strand.gain, strand.glide))
        .filter((voice) => voice !== null)
        .flatMap((voice) => voice.glide ? [voice] : splitIntoNotes(voice, stepSec));
    const byColumn = new Map();
    for (const voice of voices) {
        const bucket = byColumn.get(voice.column);
        if (bucket)
            bucket.push(voice);
        else
            byColumn.set(voice.column, [voice]);
    }
    const kept = [];
    for (const bucket of byColumn.values()) {
        bucket.sort((a, b) => a.pitches[0].row - b.pitches[0].row);
        kept.push(...evenPick(bucket, maxVoices));
    }
    kept.sort((a, b) => a.startSec - b.startSec || a.pitches[0].row - b.pitches[0].row);
    return kept;
}
function buildScore(rect, ink, options = {}) {
    const { pxPerSecond, stepsPerSecond, maxVoices, scale, lowOctave, highOctave } = { ...DEFAULT_SCORE_OPTIONS, ...options };
    const resolved = getScale(scale);
    const range = normalizeRange(lowOctave, highOctave);
    const speed = clampSpeed(pxPerSecond);
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const durationSec = Math.max(MIN_DURATION_SEC, Math.min(MAX_DURATION_SEC, width / speed));
    const columns = Math.max(1, Math.min(MAX_COLUMNS, Math.round(durationSec * stepsPerSecond)));
    const stepSec = durationSec / columns;
    const normalized = { x: rect.x, y: rect.y, width, height };
    const grid = new Grid(normalized, columns, resolved, range);
    const voices = buildVoices(ink, grid, stepSec, maxVoices);
    return {
        rect: normalized,
        scale: resolved,
        range,
        pxPerSecond: speed,
        durationSec,
        columns,
        rows: grid.rows,
        stepSec,
        cells: grid.cells,
        voices,
    };
}
function playheadX(score, elapsedSec) {
    const t = Math.max(0, Math.min(score.durationSec, elapsedSec));
    return score.rect.x + (t / score.durationSec) * score.rect.width;
}

const SERENE_META_KEY = "serene";
const FRAME_WIDTH = 960;
const FRAME_HEIGHT = 600;
const FRAME_GAP = 80;
const SEARCH_RINGS = 6;
const FLY_MS = 600;
const FLY_MAX_ZOOM = 1;
const FRAME_PROPERTIES = [
    "type",
    "meta",
    "x",
    "y",
    "width",
    "height",
];
const BOUNDS_PROPERTIES = [
    "type",
    "x",
    "y",
    "width",
    "height",
];
function isSereneFrame(el) {
    if (el.type !== "frame")
        return false;
    const marker = el.meta?.[SERENE_META_KEY];
    return marker === true || (typeof marker === "object" && marker !== null);
}
function sereneFrameSchema(id, origin) {
    return {
        type: "frame",
        drawdyElementId: id,
        position: [origin.x, origin.y],
        width: FRAME_WIDTH,
        height: FRAME_HEIGHT,
        rotation: 0,
        meta: { [SERENE_META_KEY]: true },
    };
}
function overlaps(a, b) {
    return (a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y);
}
function pad(rect, amount) {
    return {
        x: rect.x - amount,
        y: rect.y - amount,
        width: rect.width + amount * 2,
        height: rect.height + amount * 2,
    };
}
function findFreeSpot(center, size, occupied, gap) {
    const stepX = (size.width + gap) / 2;
    const stepY = (size.height + gap) / 2;
    const candidates = [];
    for (let i = -SEARCH_RINGS; i <= SEARCH_RINGS; i++) {
        for (let j = -SEARCH_RINGS; j <= SEARCH_RINGS; j++) {
            const dx = i * stepX;
            const dy = j * stepY;
            candidates.push({
                rect: {
                    x: center.x + dx - size.width / 2,
                    y: center.y + dy - size.height / 2,
                    width: size.width,
                    height: size.height,
                },
                distance: Math.hypot(dx, dy),
            });
        }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    const free = candidates.find(({ rect }) => !occupied.some((taken) => overlaps(pad(rect, gap), taken)));
    if (free)
        return free.rect;
    const union = combineRects(occupied);
    const rightEdge = union ? union.x + union.width : center.x;
    return {
        x: rightEdge + gap,
        y: center.y - size.height / 2,
        width: size.width,
        height: size.height,
    };
}
async function framesWith(ctx, drawdyElementIds) {
    const { drawdyElements } = unwrap(await ctx.issueCommand({
        type: "command:scene:get-drawdy-elements",
        ...stamp(ctx),
        req: { properties: FRAME_PROPERTIES, drawdyElementIds },
    }));
    return drawdyElements.filter(isSereneFrame);
}
async function listSereneFrames(ctx) {
    return framesWith(ctx);
}
async function sereneFramesAmong(ctx, ids) {
    if (ids.length === 0)
        return [];
    return framesWith(ctx, ids);
}
async function occupiedAround(ctx, center) {
    const reachX = FRAME_WIDTH * (SEARCH_RINGS + 1);
    const reachY = FRAME_HEIGHT * (SEARCH_RINGS + 1);
    const { drawdyElements } = unwrap(await ctx.issueCommand({
        type: "command:scene:query-rect",
        ...stamp(ctx),
        req: {
            rect: {
                x: center.x - reachX,
                y: center.y - reachY,
                width: reachX * 2,
                height: reachY * 2,
            },
            properties: BOUNDS_PROPERTIES,
        },
    }));
    return drawdyElements
        .map(elementBounds)
        .filter((r) => r !== null);
}
async function addSereneFrame(ctx) {
    const { rect: viewport } = unwrap(await ctx.issueCommand({
        type: "command:camera:get-viewport-rect",
        ...stamp(ctx),
    }));
    const center = {
        x: viewport.x + viewport.width / 2,
        y: viewport.y + viewport.height / 2,
    };
    const occupied = await occupiedAround(ctx, center);
    const spot = findFreeSpot(center, { width: FRAME_WIDTH, height: FRAME_HEIGHT }, occupied, FRAME_GAP);
    const id = ctx.generateId();
    unwrap(await ctx.issueCommand({
        type: "command:scene:add-drawdy-elements",
        ...stamp(ctx),
        req: { elements: [sereneFrameSchema(id, spot)] },
    }));
    unwrap(await ctx.issueCommand({
        type: "command:scene:set-selection",
        ...stamp(ctx),
        req: { drawdyElementIds: [id] },
    }));
    unwrap(await ctx.issueCommand({
        type: "command:camera:fly-to-rect",
        ...stamp(ctx),
        req: {
            rect: pad(spot, FRAME_GAP),
            flyDurationMs: FLY_MS,
            zoom: FLY_MAX_ZOOM,
        },
    }));
    return id;
}

const INK_PROPERTIES = [
    "type",
    "componentType",
    "x",
    "y",
    "width",
    "height",
    "points",
    "rotation",
    "opacity",
];
const HIT_PAD = 8;
const STAGE_TOLERANCE = 1;
function encloses(outer, inner) {
    return (inner.x >= outer.x - STAGE_TOLERANCE &&
        inner.y >= outer.y - STAGE_TOLERANCE &&
        inner.x + inner.width <= outer.x + outer.width + STAGE_TOLERANCE &&
        inner.y + inner.height <= outer.y + outer.height + STAGE_TOLERANCE);
}
function dropStageElements(elements, stageIds) {
    const stage = new Set(stageIds);
    const content = elements.filter((el) => !stage.has(el.id));
    if (content.length === 0)
        return elements;
    const contentRects = content
        .map(elementBounds)
        .filter((r) => r !== null);
    return elements.filter((el) => {
        if (!stage.has(el.id))
            return true;
        const bounds = elementBounds(el);
        if (!bounds)
            return true;
        return !contentRects.every((inner) => encloses(bounds, inner));
    });
}
async function elementsInRect(ctx, rect, properties) {
    const { drawdyElements } = unwrap(await ctx.issueCommand({
        type: "command:scene:query-rect",
        ...stamp(ctx),
        req: { rect, properties },
    }));
    return drawdyElements;
}
async function elementsByIds(ctx, drawdyElementIds, properties) {
    const { drawdyElements } = unwrap(await ctx.issueCommand({
        type: "command:scene:get-drawdy-elements",
        ...stamp(ctx),
        req: { properties, drawdyElementIds },
    }));
    return drawdyElements;
}
function boundsUnion(elements) {
    const rects = elements
        .map(elementBounds)
        .filter((r) => r !== null);
    return combineRects(rects);
}
function smallestFrameUnder(frames, pointer) {
    let smallest = null;
    let smallestArea = Infinity;
    for (const frame of frames) {
        const bounds = elementBounds(frame);
        if (!bounds || !rectContainsPoint(bounds, pointer.x, pointer.y))
            continue;
        const area = rectArea(bounds);
        if (area < smallestArea) {
            smallestArea = area;
            smallest = frame;
        }
    }
    return smallest;
}
async function seedFrameIds(ctx, pointer, explicit) {
    if (explicit.length > 0)
        return explicit;
    const { drawdyElementIds } = unwrap(await ctx.issueCommand({
        type: "command:scene:get-current-selected-drawdy-elements",
        ...stamp(ctx),
    }));
    if (drawdyElementIds.length > 0) {
        const selected = await elementsByIds(ctx, drawdyElementIds, FRAME_PROPERTIES);
        const frames = selected.filter(isSereneFrame).map((el) => el.id);
        if (frames.length > 0)
            return frames;
    }
    if (!pointer)
        return [];
    const hits = await elementsInRect(ctx, {
        x: pointer.x - HIT_PAD,
        y: pointer.y - HIT_PAD,
        width: HIT_PAD * 2,
        height: HIT_PAD * 2,
    }, FRAME_PROPERTIES);
    const frame = smallestFrameUnder(hits.filter(isSereneFrame), pointer);
    return frame ? [frame.id] : [];
}
async function resolveRegion(ctx, pointer, explicit) {
    const stageIds = await seedFrameIds(ctx, pointer, explicit);
    if (stageIds.length === 0)
        return null;
    const frames = await elementsByIds(ctx, stageIds, FRAME_PROPERTIES);
    const rect = boundsUnion(frames);
    if (!rect || rect.width <= 0 || rect.height <= 0)
        return null;
    return { rect, stageIds };
}
async function resolveTarget(ctx, pointer, explicit = []) {
    const region = await resolveRegion(ctx, pointer, explicit);
    if (!region)
        return null;
    const inRegion = (await elementsInRect(ctx, region.rect, INK_PROPERTIES)).filter((el) => el.type !== "frame");
    const elements = dropStageElements(inRegion, region.stageIds);
    return { rect: region.rect, frameIds: region.stageIds, elements };
}

const SETTINGS_KEY = "settings";
const DEFAULT_SETTINGS = {
    speed: DEFAULT_SCORE_OPTIONS.pxPerSecond,
    scale: DEFAULT_SCALE_ID,
    loop: false,
    lowOctave: DEFAULT_RANGE.lowOctave,
    highOctave: DEFAULT_RANGE.highOctave,
    attack: 0.02,
    volume: 0.7,
    reverb: 0.38,
};
const KNOB_RANGES = {
    attack: [0, 0.3],
    volume: [0, 1],
    reverb: [0, 1],
};
function clampNumber(value, min, max, fallback) {
    if (typeof value !== "number" || !Number.isFinite(value))
        return fallback;
    return Math.min(max, Math.max(min, value));
}
function sanitizeKnobs(raw, current) {
    const next = { ...current };
    for (const key of Object.keys(KNOB_RANGES)) {
        const [min, max] = KNOB_RANGES[key];
        next[key] = clampNumber(raw[key], min, max, current[key]);
    }
    return next;
}
function sanitizeSettings(raw) {
    const scale = typeof raw.scale === "string" ? getScale(raw.scale).id : DEFAULT_SETTINGS.scale;
    const speed = typeof raw.speed === "number" && Number.isFinite(raw.speed)
        ? clampSpeed(raw.speed)
        : DEFAULT_SETTINGS.speed;
    return {
        ...sanitizeKnobs(raw, DEFAULT_SETTINGS),
        speed,
        scale,
        loop: raw.loop === true,
        ...normalizeRange(raw.lowOctave, raw.highOctave),
    };
}
async function loadSettings(ctx) {
    try {
        const response = await ctx.issueCommand({
            type: "command:kv-storage:get",
            ...stamp(ctx),
            req: { key: SETTINGS_KEY },
        });
        if (response.res.error !== undefined || !response.res.value.got) {
            return DEFAULT_SETTINGS;
        }
        return sanitizeSettings(response.res.value.got);
    }
    catch {
        return DEFAULT_SETTINGS;
    }
}
function saveSettings(ctx, settings) {
    void ctx
        .issueCommand({
        type: "command:kv-storage:set",
        ...stamp(ctx),
        req: { key: SETTINGS_KEY, payload: settings },
    })
        .catch(() => undefined);
}

const EMPTY_REGION = { x: 0, y: 0, width: 1, height: 1 };
const REFRESH_DEBOUNCE_MS = 120;
function sameRect(a, b) {
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
class SereneSession {
    _ctx;
    _playhead;
    _transport;
    _styling;
    _score = null;
    _rect = null;
    _lines = [];
    _laser = [];
    _elementCount = 0;
    _settings = DEFAULT_SETTINGS;
    _pointer = null;
    _pendingAutoplay = false;
    _frameIds = [];
    _playing = false;
    _refreshTimer = null;
    constructor(_ctx, _playhead, _transport, _styling) {
        this._ctx = _ctx;
        this._playhead = _playhead;
        this._transport = _transport;
        this._styling = _styling;
    }
    async restoreSettings() {
        this._settings = await loadSettings(this._ctx);
    }
    _updateSettings(patch) {
        this._settings = { ...this._settings, ...patch };
        saveSettings(this._ctx, this._settings);
    }
    postSettings() {
        postToPanel(this._ctx, { type: "settings", values: this._settings });
    }
    setPointer(pointer) {
        this._pointer = pointer;
    }
    setStyling(styling) {
        this._styling = styling;
        this._playhead.setStyling(styling);
        this._transport.setStyling(styling);
    }
    async openPanel() {
        await openPanel(this._ctx, this._styling);
    }
    async openFromRail() {
        await this.openPanel();
        this.postTheme();
        const frames = await listSereneFrames(this._ctx);
        if (frames.length === 0) {
            await this.addFrame();
            return;
        }
        this.postFrames(frames.length);
    }
    async addFrame() {
        try {
            await addSereneFrame(this._ctx);
        }
        finally {
            await this.postFrames();
        }
    }
    async postFrames(count) {
        const total = count ?? (await listSereneFrames(this._ctx)).length;
        postToPanel(this._ctx, { type: "frames", count: total });
    }
    postScales() {
        postToPanel(this._ctx, {
            type: "scales",
            scales: scaleOptions(),
            current: this._settings.scale,
        });
    }
    postTheme() {
        postToPanel(this._ctx, {
            type: "theme",
            css: stylingCssVars(this._styling),
        });
    }
    async _resolve(seedIds) {
        const target = await resolveTarget(this._ctx, this._pointer, seedIds);
        if (!target) {
            this._rect = null;
            this._frameIds = [];
            this._lines = [];
            this._elementCount = 0;
            this._score = buildScore(EMPTY_REGION, [], {
                scale: this._settings.scale,
            });
            return false;
        }
        this._rect = target.rect;
        this._frameIds = target.frameIds;
        this._elementCount = target.elements.length;
        this._lines = sceneInk(target.elements);
        this._rebuild();
        return true;
    }
    async play(seedIds = []) {
        const resolved = await this._resolve(seedIds);
        await this.openPanel();
        if (!resolved) {
            this._postScore(false);
            return;
        }
        this._postScore(true);
    }
    setLaser(strokes) {
        this._laser = laserInk(strokes);
        if (!this._rect)
            return;
        this._rebuild();
        this._postScore(false, true);
    }
    onSceneChanged(changed) {
        const rect = this._rect;
        if (!rect)
            return;
        const touches = changed.some((el) => {
            if (this._frameIds.includes(el.id))
                return true;
            const bounds = elementBounds(el);
            return bounds ? rectsOverlap(bounds, rect) : false;
        });
        if (!touches)
            return;
        if (this._refreshTimer)
            clearTimeout(this._refreshTimer);
        this._refreshTimer = setTimeout(() => {
            this._refreshTimer = null;
            void this._refresh();
        }, REFRESH_DEBOUNCE_MS);
    }
    async _refresh() {
        const previous = this._rect;
        const resolved = await this._resolve(this._frameIds);
        if (!resolved) {
            if (this._playing)
                await this.stop();
            this._postScore(false);
            return;
        }
        const rect = this._rect;
        if (this._playing && rect && previous && !sameRect(rect, previous)) {
            await this._playhead.show(rect);
            this._transport.setPlaying(rect);
        }
        this._postScore(false, true);
    }
    seek(progress) {
        if (!this._score)
            return;
        postToPanel(this._ctx, {
            type: "seek",
            t: progress * this._score.durationSec,
        });
    }
    async stop() {
        postToPanel(this._ctx, { type: "stop" });
        await this._playhead.hide();
    }
    async onPanelMessage(message) {
        switch (message.type) {
            case "ready":
                this.postTheme();
                this.postSettings();
                this.postScales();
                void this.postFrames();
                if (this._score) {
                    const autoplay = this._pendingAutoplay;
                    this._pendingAutoplay = false;
                    this._postScore(autoplay);
                }
                return;
            case "started":
                this._pendingAutoplay = false;
                this._playing = true;
                if (this._rect)
                    await this._playhead.show(this._rect);
                this._transport.setPlaying(this._rect);
                return;
            case "progress":
                if (this._score) {
                    this._playhead.move(playheadX(this._score, message.t));
                    this._transport.setProgress(this._score.durationSec > 0
                        ? message.t / this._score.durationSec
                        : 0);
                }
                return;
            case "ended":
            case "stopped":
                this._playing = false;
                this._transport.setPlaying(null);
                this._transport.setProgress(0);
                await this._playhead.hide();
                return;
            case "add-frame":
                await this.addFrame();
                return;
            case "range":
                this._updateSettings(normalizeRange(message.low, message.high, this._settings));
                if (!this._rect)
                    return;
                this._rebuild();
                this._postScore(false, true);
                return;
            case "loop":
                this._updateSettings({ loop: message.value === true });
                return;
            case "knobs":
                this._updateSettings(sanitizeKnobs(message.values, this._settings));
                return;
            case "speed":
                this._updateSettings({ speed: clampSpeed(message.value) });
                if (!this._rect)
                    return;
                this._rebuild();
                this._postScore(false, true);
                return;
            case "scale":
                this._updateSettings({ scale: getScale(message.value).id });
                if (!this._rect)
                    return;
                this._rebuild();
                this._postScore(false, true);
                return;
        }
    }
    _rebuild() {
        if (!this._rect)
            return;
        this._score = buildScore(this._rect, [...this._lines, ...this._laser], {
            pxPerSecond: this._settings.speed,
            scale: this._settings.scale,
            lowOctave: this._settings.lowOctave,
            highOctave: this._settings.highOctave,
        });
    }
    _postScore(autoplay, live = false) {
        if (!this._score)
            return;
        if (autoplay)
            this._pendingAutoplay = true;
        postToPanel(this._ctx, {
            type: "score",
            score: serializeScore(this._score, this._elementCount),
            autoplay,
            live,
        });
    }
}

const BUTTON_SIZE = 28;
const BAR_GAP = 12;
const TRACK_GAP = 10;
const TRACK_WIDTH = 3;
const KNOB_SIZE = 14;
const KNOB_ACTIVE_SIZE = 20;
const TRACK_HIT_HEIGHT = 24;
const HOVER_SCALE = 1.15;
const MIN_TRACK = 40;
const FRAME_LABEL_REACH = 12 * (1.75 + 0.35);
const GLYPH_RATIO = 0.5;
const SHIELD_REACH = 1;
const BUTTON_SEED = 13;
const TRACK_SEED = 17;
const PLAYED_SEED = 19;
const KNOB_SEED = 23;
const SHIELD_SEED = 29;
const HIT_SEED = 31;
function frameLabelReach(zoom) {
    return FRAME_LABEL_REACH / Math.min(zoom || 1, 1);
}
function barLayout(anchor, zoom) {
    const y = anchor.y - frameLabelReach(zoom) - (BAR_GAP + BUTTON_SIZE / 2) / zoom;
    const buttonCenterX = anchor.x + BUTTON_SIZE / 2 / zoom;
    const trackStart = anchor.x + (BUTTON_SIZE + TRACK_GAP) / zoom;
    const trackEnd = Math.max(anchor.x + anchor.width, trackStart + MIN_TRACK / zoom);
    return { y, buttonCenterX, trackStart, trackEnd };
}
function progressAt(layout, x) {
    const span = layout.trackEnd - layout.trackStart;
    if (span <= 0)
        return 0;
    return Math.min(1, Math.max(0, (x - layout.trackStart) / span));
}
function knobX(layout, progress) {
    return layout.trackStart + progress * (layout.trackEnd - layout.trackStart);
}
class TransportBar {
    _ctx;
    _styling;
    _selection = null;
    _playingRect = null;
    _previewId = null;
    _previewShape = "";
    _zoom = 1;
    _buttonHovered = false;
    _knobHovered = false;
    _hiddenForDrag = false;
    _progress = 0;
    _dragX = null;
    _progressBeforeDrag = 0;
    _shield = null;
    _queue = Promise.resolve();
    _dirty = false;
    _syncing = false;
    constructor(_ctx, _styling) {
        this._ctx = _ctx;
        this._styling = _styling;
    }
    get buttonId() {
        return `${this._ctx.driverId}:transport-button`;
    }
    get knobId() {
        return `${this._ctx.driverId}:transport-knob`;
    }
    get shieldId() {
        return `${this._ctx.driverId}:transport-shield`;
    }
    get _trackId() {
        return `${this._ctx.driverId}:transport-track`;
    }
    get _playedId() {
        return `${this._ctx.driverId}:transport-played`;
    }
    get _hitId() {
        return `${this._ctx.driverId}:transport-hit`;
    }
    get hitIds() {
        return [this.buttonId, this.knobId, this.shieldId];
    }
    get trackIds() {
        return [this._trackId, this._playedId, this._hitId];
    }
    get clickIds() {
        return [this.buttonId, ...this.trackIds];
    }
    get ownIds() {
        return [...this.hitIds, this._trackId, this._playedId];
    }
    get mode() {
        return this._playingRect ? "stop" : "play";
    }
    get seedIds() {
        return this._selection?.ids ?? [];
    }
    get isDragging() {
        return this._dragX !== null;
    }
    setStyling(styling) {
        this._styling = styling;
        this._requestSync();
    }
    setZoom(zoom) {
        if (zoom === this._zoom)
            return;
        this._zoom = zoom;
        this._requestSync();
    }
    setButtonHovered(hovered) {
        if (hovered === this._buttonHovered)
            return;
        this._buttonHovered = hovered;
        this._requestSync();
    }
    setKnobHovered(hovered) {
        if (hovered === this._knobHovered)
            return;
        this._knobHovered = hovered;
        this._requestSync();
    }
    jumpTo(x) {
        const anchor = this._anchor();
        if (!anchor || this.isDragging)
            return null;
        this._progress = progressAt(barLayout(anchor, this._zoom), x);
        this._requestSync();
        return this._progress;
    }
    setProgress(progress) {
        if (this.isDragging)
            return;
        const clamped = Math.min(1, Math.max(0, progress));
        if (clamped === this._progress)
            return;
        this._progress = clamped;
        this._requestSync();
    }
    async beginDrag(x) {
        const anchor = this._anchor();
        if (!anchor)
            return;
        const { rect: viewport } = unwrap(await this._ctx.issueCommand({
            type: "command:camera:get-viewport-rect",
            ...stamp(this._ctx),
        }));
        this._shield = {
            x: viewport.x - viewport.width * SHIELD_REACH,
            y: viewport.y - viewport.height * SHIELD_REACH,
            width: viewport.width * (1 + SHIELD_REACH * 2),
            height: viewport.height * (1 + SHIELD_REACH * 2),
        };
        this._progressBeforeDrag = this._progress;
        this._dragX = x;
        this._progress = progressAt(barLayout(anchor, this._zoom), x);
        this._requestSync();
    }
    dragTo(x) {
        const anchor = this._anchor();
        if (!this.isDragging || !anchor)
            return;
        this._dragX = x;
        this._progress = progressAt(barLayout(anchor, this._zoom), x);
        this._requestSync();
    }
    endDrag() {
        if (!this.isDragging)
            return null;
        this._dragX = null;
        this._shield = null;
        this._requestSync();
        return this._progress;
    }
    cancelDrag() {
        if (!this.isDragging)
            return;
        this._dragX = null;
        this._shield = null;
        this._progress = this._progressBeforeDrag;
        this._requestSync();
    }
    setSelection(ids) {
        this._enqueue(async () => {
            this._hiddenForDrag = false;
            this._selection = await this._selectionFor(ids);
            this._requestSync();
        });
    }
    refreshIfAffected(changedIds) {
        const current = this._selection;
        if (!current)
            return;
        const watched = new Set(current.ids);
        if (!changedIds.some((id) => watched.has(id)))
            return;
        this.setSelection(current.ids);
    }
    hideWhileDragging() {
        this._enqueue(async () => {
            this._hiddenForDrag = true;
            this._requestSync();
        });
    }
    setPlaying(rect) {
        this._enqueue(async () => {
            this._playingRect = rect;
            this._requestSync();
        });
    }
    _enqueue(task) {
        this._queue = this._queue.then(task).catch(() => undefined);
    }
    _requestSync() {
        this._dirty = true;
        if (this._syncing)
            return;
        void this._drain();
    }
    async _drain() {
        this._syncing = true;
        try {
            while (this._dirty) {
                this._dirty = false;
                try {
                    await this._sync();
                }
                catch {
                    this._previewId = null;
                    this._previewShape = "";
                }
            }
        }
        finally {
            this._syncing = false;
        }
    }
    async _selectionFor(ids) {
        const frames = await sereneFramesAmong(this._ctx, ids);
        if (frames.length !== 1)
            return null;
        const rect = elementBounds(frames[0]);
        if (!rect || rect.width <= 0 || rect.height <= 0)
            return null;
        return { rect, ids: [frames[0].id] };
    }
    _anchor() {
        if (this._playingRect)
            return this._playingRect;
        if (this._hiddenForDrag)
            return null;
        return this._selection?.rect ?? null;
    }
    _circle(id, centerX, centerY, size, seed) {
        return {
            type: "shape",
            drawdyElementId: id,
            componentType: "circle",
            x: centerX - size / 2,
            y: centerY - size / 2,
            width: size,
            height: size,
            strokeColor: this._styling.background,
            fillColor: this._styling.primary,
            strokeWidth: 2 / this._zoom,
            roughness: 0,
            seed,
        };
    }
    _line(id, fromX, toX, y, color, seed) {
        return {
            type: "line",
            drawdyElementId: id,
            color,
            strokeWidth: TRACK_WIDTH / this._zoom,
            roughness: 0,
            seed,
            from: [fromX, y],
            to: [Math.max(toX, fromX + 0.5 / this._zoom), y],
        };
    }
    _hitBox(id, rect, seed) {
        return {
            type: "shape",
            drawdyElementId: id,
            componentType: "rect",
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            strokeColor: "transparent",
            fillColor: this._styling.primary,
            strokeWidth: 0,
            roughness: 0,
            seed,
            opacity: 0,
        };
    }
    _elements(anchor) {
        const layout = barLayout(anchor, this._zoom);
        const buttonSize = (BUTTON_SIZE * (this._buttonHovered ? HOVER_SCALE : 1)) / this._zoom;
        const knobSize = (this._knobHovered || this.isDragging ? KNOB_ACTIVE_SIZE : KNOB_SIZE) /
            this._zoom;
        const knobCenter = knobX(layout, this._progress);
        const button = {
            ...this._circle(this.buttonId, layout.buttonCenterX, layout.y, buttonSize, BUTTON_SEED),
            text: this.mode === "play" ? "▶" : "■",
            textColor: this._styling.primaryForeground,
            fontSize: (BUTTON_SIZE * GLYPH_RATIO) / this._zoom,
            textAlign: "center",
            textVerticalAlign: "middle",
        };
        const hitHeight = TRACK_HIT_HEIGHT / this._zoom;
        const elements = [
            this._hitBox(this._hitId, {
                x: layout.trackStart,
                y: layout.y - hitHeight / 2,
                width: layout.trackEnd - layout.trackStart,
                height: hitHeight,
            }, HIT_SEED),
            button,
            this._line(this._trackId, layout.trackStart, layout.trackEnd, layout.y, this._styling.border, TRACK_SEED),
            this._line(this._playedId, layout.trackStart, knobCenter, layout.y, this._styling.primary, PLAYED_SEED),
            this._circle(this.knobId, knobCenter, layout.y, knobSize, KNOB_SEED),
        ];
        if (this._shield) {
            elements.push(this._hitBox(this.shieldId, this._shield, SHIELD_SEED));
        }
        return elements;
    }
    async _sync() {
        const anchor = this._anchor();
        if (!anchor) {
            await this._remove();
            return;
        }
        const elements = this._elements(anchor);
        const shape = elements.map((el) => el.drawdyElementId).join(",");
        if (this._previewId && shape === this._previewShape) {
            await this._ctx.issueCommand({
                type: "command:scene:update-drawdy-preview-elements",
                ...stamp(this._ctx),
                req: { elements },
            });
            return;
        }
        await this._remove();
        const { previewId } = unwrap(await this._ctx.issueCommand({
            type: "command:scene:create-drawdy-preview-elements",
            ...stamp(this._ctx),
            req: { elements, hitTestable: true },
        }));
        this._previewId = previewId;
        this._previewShape = shape;
    }
    async _remove() {
        const previewId = this._previewId;
        this._previewId = null;
        this._previewShape = "";
        if (!previewId)
            return;
        await this._ctx.issueCommand({
            type: "command:scene:delete-drawdy-preview-elements",
            ...stamp(this._ctx),
            req: { previewIds: [previewId] },
        });
    }
}

const SCENE_CHANGE_SUBSCRIPTIONS = [
    "subscription:scene:elements-added",
    "subscription:scene:elements-removed",
    "subscription:scene:elements-updated",
    "subscription:scene:elements-replaced",
];
let driver = null;
const activate = async ({ manifest, issueCommand, generateId, styling, }) => {
    let requestId = 0;
    const ctx = {
        driverId: manifest.driverId,
        issueCommand,
        generateId,
        nextRequestId: () => String(requestId++),
    };
    const playhead = new Playhead(ctx, styling);
    const transport = new TransportBar(ctx, styling);
    const session = new SereneSession(ctx, playhead, transport, styling);
    driver = { ctx, session, transport, styling };
    await session.restoreSettings();
    unwrap(await issueCommand({
        type: "command:dom:create-action-button",
        ...stamp(ctx),
        req: {
            domElementId: actionButtonId(ctx.driverId),
            svg: ACTION_BUTTON_SVG,
        },
    }));
    unwrap(await issueCommand({
        type: "subscription:dom:element-clicked",
        ...stamp(ctx),
        req: { domElementId: actionButtonId(ctx.driverId) },
    }));
    unwrap(await issueCommand({
        type: "subscription:webview:message",
        ...stamp(ctx),
        req: { webviewDomId: panelWebviewId(ctx.driverId) },
    }));
    unwrap(await issueCommand({
        type: "subscription:dom:theme-changed",
        ...stamp(ctx),
    }));
    unwrap(await issueCommand({
        type: "subscription:scene:pointer-position",
        ...stamp(ctx),
    }));
    await registerMenus(ctx);
    await subscribeTransport(ctx, transport);
};
async function subscribeTransport(ctx, transport) {
    unwrap(await ctx.issueCommand({
        type: "subscription:scene:drawdy-element-selection",
        ...stamp(ctx),
    }));
    unwrap(await ctx.issueCommand({
        type: "subscription:scene:drawdy-elements-dragged",
        ...stamp(ctx),
    }));
    for (const type of SCENE_CHANGE_SUBSCRIPTIONS) {
        unwrap(await ctx.issueCommand({
            type,
            ...stamp(ctx),
            req: { properties: FRAME_PROPERTIES },
        }));
    }
    unwrap(await ctx.issueCommand({
        type: "subscription:camera:moved-rapid",
        ...stamp(ctx),
    }));
    unwrap(await ctx.issueCommand({
        type: "subscription:tool:laser",
        ...stamp(ctx),
    }));
    unwrap(await ctx.issueCommand({
        type: "subscription:scene:click",
        ...stamp(ctx),
        req: { elementIds: transport.clickIds },
    }));
    unwrap(await ctx.issueCommand({
        type: "subscription:scene:pointer",
        ...stamp(ctx),
        req: { elementIds: transport.hitIds },
    }));
    const camera = unwrap(await ctx.issueCommand({
        type: "command:camera:get-info",
        ...stamp(ctx),
    }));
    transport.setZoom(camera.zoom);
    await syncTransportWithSelection(ctx, transport);
}
async function syncTransportWithSelection(ctx, transport) {
    const { drawdyElementIds } = unwrap(await ctx.issueCommand({
        type: "command:scene:get-current-selected-drawdy-elements",
        ...stamp(ctx),
    }));
    transport.setSelection(drawdyElementIds.filter((id) => !transport.ownIds.includes(id)));
}
const onEvent = async (event) => {
    if (!driver)
        return;
    const { ctx, session, transport } = driver;
    switch (event.type) {
        case "subscription:context-menu:clicked": {
            if (event.body.menuId === playMenuId(ctx.driverId)) {
                await session.play();
                return;
            }
            if (event.body.menuId === stopMenuId(ctx.driverId)) {
                await session.stop();
            }
            return;
        }
        case "subscription:scene:pointer-position": {
            session.setPointer(event.body.position.canvasSpace);
            if (transport.isDragging) {
                transport.dragTo(event.body.position.canvasSpace.x);
            }
            return;
        }
        case "subscription:scene:drawdy-element-selection": {
            const ids = event.body.drawdyElementIds;
            const foreign = ids.filter((id) => !transport.ownIds.includes(id));
            if (foreign.length === 0 && ids.length > 0)
                return;
            transport.setSelection(foreign);
            return;
        }
        case "subscription:scene:drawdy-elements-dragged": {
            if (event.body.type === "dragStart")
                transport.hideWhileDragging();
            if (event.body.type === "dragEnd") {
                await syncTransportWithSelection(ctx, transport);
            }
            return;
        }
        case "subscription:scene:elements-added":
        case "subscription:scene:elements-removed":
        case "subscription:scene:elements-updated":
        case "subscription:scene:elements-replaced": {
            const changed = [
                ...event.body.drawdyElements,
                ...(event.type === "subscription:scene:elements-replaced"
                    ? event.body.replaced
                    : []),
            ];
            if (event.type !== "subscription:scene:elements-updated" && changed.some(isSereneFrame)) {
                await session.postFrames();
            }
            transport.refreshIfAffected(changed.map((el) => el.id));
            session.onSceneChanged(changed);
            return;
        }
        case "subscription:tool:laser": {
            session.setLaser(event.body.lasers);
            return;
        }
        case "subscription:camera:moved-rapid": {
            transport.setZoom(event.body.zoom);
            return;
        }
        case "subscription:scene:pointer": {
            const body = event.body;
            if (body.type === "cancel") {
                transport.cancelDrag();
                transport.setButtonHovered(false);
                transport.setKnobHovered(false);
                return;
            }
            const ids = body.drawdyElementIds;
            if (body.type === "down") {
                if (ids.includes(transport.knobId)) {
                    await transport.beginDrag(body.cursor.canvasSpace.x);
                }
                return;
            }
            if (body.type === "up") {
                const progress = transport.endDrag();
                if (progress !== null)
                    session.seek(progress);
                return;
            }
            const entering = body.type === "enter";
            if (ids.includes(transport.buttonId)) {
                transport.setButtonHovered(entering);
            }
            if (ids.includes(transport.knobId)) {
                transport.setKnobHovered(entering);
            }
            return;
        }
        case "subscription:scene:click": {
            if (transport.isDragging)
                return;
            const clicked = event.body.drawdyElementIds;
            if (clicked.includes(transport.knobId))
                return;
            if (clicked.some((id) => transport.trackIds.includes(id))) {
                const progress = transport.jumpTo(event.body.cursor.canvasSpace.x);
                if (progress !== null)
                    session.seek(progress);
                return;
            }
            if (!clicked.includes(transport.buttonId))
                return;
            if (transport.mode === "stop") {
                await session.stop();
                return;
            }
            await session.play(transport.seedIds);
            return;
        }
        case "subscription:dom:element-clicked": {
            if (event.body.domElementId !== actionButtonId(ctx.driverId))
                return;
            await session.openFromRail();
            return;
        }
        case "subscription:webview:message": {
            if (event.body.webviewDomId !== panelWebviewId(ctx.driverId))
                return;
            const message = event.body.message;
            if (typeof message !== "object" || message === null)
                return;
            await session.onPanelMessage(message);
            return;
        }
        case "subscription:dom:theme-changed": {
            driver.styling = event.body.styling;
            session.setStyling(event.body.styling);
            session.postTheme();
            return;
        }
        default:
            return;
    }
};

exports.activate = activate;
exports.onEvent = onEvent;
