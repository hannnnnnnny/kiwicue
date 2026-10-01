# Five assistants that theme the site

The owner supplied five 3D assistants (`ai-chatbots-white-outline-v4`): coloured matte orbs with
hollow white capsule eyes, a 30 s `Idle` animation with personal blink timing, and four eye
morph targets (`Blink`, `HalfBlink`, `Squint`, `Wide`). Visitors pick one; the whole site takes
its colour, and its name, tone and voice follow.

## The assistants

| id | Name | Orb | Personality | Role (en / zh) | Speaking style |
| --- | --- | --- | --- | --- | --- |
| `iris` | Iris | purple | INTJ | Strategist / 策略家 | calm, concise, gives the reason |
| `rua` | Rua | red | ENTJ | Commander / 指挥官 | decisive, upbeat, leads with the pick |
| `sunny` | Sunny | yellow | ENTP | Inventor / 发明家 | playful, a little witty |
| `fern` | Fern | green | ISFJ | Guardian / 守护者 | warm, reassuring, practical details |
| `kai` | Kai | blue | ISTP | Maker / 实干家 | relaxed, plain, to the point |

Fern is the default: green is closest to the current teal brand.

## Colour

Each assistant defines `--portal-brand`, `--portal-brand-hover`, `--portal-brand-soft`,
`--portal-accent` and `--portal-focus` under `:root[data-assistant="…"]`. Every brand colour
must reach 4.5:1 on white (white text on brand buttons and brand text on white), checked by a
unit test. Yellow therefore uses a deep amber for text and buttons; the orb itself stays yellow.

The choice is stored in `localStorage` (`kiwicue.assistant`). A tiny inline script in the root
layout sets `data-assistant` before first paint, so there is no flash of the default colour.

## Rendering

- `public/assistants/{id}.glb` (as supplied, ~700 KB, no Draco/KTX2, so no decoder and no CSP
  change) and `{id}.webp` (256 px render, ~20 KB).
- `AssistantOrb` lazy-loads three.js (`GLTFLoader`, `RoomEnvironment`) only when the Kiwi
  overlay is open, plays `Idle`, and layers state on top of the animation each frame:
  listening → `Wide`, thinking → `Squint` + slight gaze up, speaking → gentle bob. A brand-colour
  ring/orbit around the canvas marks listening/thinking as before.
- The poster image shows until the model is ready, and stays instead of WebGL when
  `prefers-reduced-motion` is set, WebGL is unavailable or the model fails to load.
- The launcher button always uses the poster (no WebGL on every page).

## Picking

The overlay header's orb opens a picker: five options (poster, name, role) as a radio group.
Choosing one re-themes the page immediately, saves it, and the new assistant introduces
itself in the thread ("Hi, I'm Sunny — I'll take it from here!"). The greeting, title and status
use the current name.

## Personality

- `/api/ask` accepts `assistant` (enum, default `fern`); the reply prompt adds that assistant's
  one-line speaking style. Same single DeepSeek call, so no extra cost.
- Browser speech uses a per-assistant pitch and rate (e.g. Rua faster, Iris lower).

## Testing

Registry and contrast test, theme script, request schema default, reply prompt style, voice
options, picker (switch re-themes, persists, adds intro line), orb fallback to poster without
WebGL, e2e: pick Sunny → `data-assistant="sunny"`, brand colour changes, name shown, no
horizontal overflow on three viewports; screenshots of all five.
