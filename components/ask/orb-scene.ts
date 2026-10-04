import {
  ACESFilmicToneMapping, AnimationMixer, Box3, Clock, DirectionalLight, Mesh, PerspectiveCamera, PMREMGenerator, Scene,
  Vector3, WebGLRenderer, type Material, type Object3D,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { AskMood } from "../../lib/ask/mood";
import { faceFor, pointerGaze, type BotState, type Face } from "./orb-face";

export type OrbScene = { setState(state: BotState): void; setMood(mood: AskMood | null): void; dispose(): void };

const FOV = 28;
const ENVIRONMENT_INTENSITY = 0.3;
const KEY_INTENSITY = 2.4;
const FRAMING = 1.08;
const EASE_PER_SECOND = 8;
const IMPULSE_DECAY_PER_SECOND = 2.5;
// How far a full look turns the orb (radians) and slides its eyes (share of the orb's radius).
const TURN = { x: 0.32, y: 0.22, tilt: 0.16 };
const EYE_SHIFT = 0.025;
const GAZE_PER_SECOND = 6;
const MORPHS = ["Wide", "Squint", "HalfBlink", "Blink"] as const;
const MOTIONS = ["lookX", "lookY", "follow", "scan", "tilt", "hop", "bob", "sink"] as const;
type Pose = Record<(typeof MORPHS)[number] | (typeof MOTIONS)[number], number>;

function eyesOf(root: Object3D): Mesh[] {
  const eyes: Mesh[] = [];
  root.traverse((node) => { if (node instanceof Mesh && node.morphTargetDictionary?.Blink !== undefined) eyes.push(node); });
  return eyes;
}

function disposeTree(root: Object3D) {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.geometry.dispose();
    (Array.isArray(node.material) ? node.material : [node.material]).forEach((material: Material) => material.dispose());
  });
}

function ease(pose: Pose, face: Face, amount: number) {
  for (const key of [...MORPHS, ...MOTIONS]) pose[key] += (face[key] - pose[key]) * amount;
}

/** Eye shapes on top of the designed Idle animation: only ever push a shape further, never cancel its own blinks. */
function shapeEyes(eyes: Mesh[], pose: Pose) {
  for (const eye of eyes) {
    for (const shape of MORPHS) {
      const index = eye.morphTargetDictionary?.[shape];
      if (index !== undefined && eye.morphTargetInfluences) eye.morphTargetInfluences[index] = Math.max(eye.morphTargetInfluences[index], pose[shape]);
    }
  }
}

async function loadModel(renderer: WebGLRenderer, scene: Scene, url: string) {
  try {
    return await new GLTFLoader().loadAsync(url);
  } catch (error) {
    scene.environment?.dispose();
    renderer.dispose();
    throw error;
  }
}

function setUp(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  // Match the supplied renders: a soft key from the upper right, little fill, so the lower left falls into shade.
  scene.environmentIntensity = ENVIRONMENT_INTENSITY;
  const key = new DirectionalLight(0xffffff, KEY_INTENSITY);
  key.position.set(4, 2, 2);
  scene.add(key);
  return { renderer, scene };
}

/** Frames the orb itself: a box's bounding sphere is √3 too large for a round model. */
function frame(model: Object3D) {
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const radius = Math.max(size.x, size.y) / 2;
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(center.x, center.y, center.z + (radius * FRAMING) / Math.sin((FOV * Math.PI) / 360));
  camera.lookAt(center);
  return { camera, radius };
}

/** Renders one assistant on `canvas`: its Idle animation, a pose for its state and mood, and eyes that follow the pointer. */
export async function mountOrb(canvas: HTMLCanvasElement, modelUrl: string): Promise<OrbScene> {
  const { renderer, scene } = setUp(canvas);
  const gltf = await loadModel(renderer, scene, modelUrl);
  const model = gltf.scene;
  scene.add(model);
  const { camera, radius } = frame(model);
  const mixer = new AnimationMixer(model);
  gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
  const eyes = eyesOf(model);
  const eyeShift = eyes.map((eye) => radius * EYE_SHIFT / (eye.parent?.getWorldScale(new Vector3()).x || 1));
  const clock = new Clock();
  const pose: Pose = { Wide: 0, Squint: 0, HalfBlink: 0, Blink: 0, lookX: 0, lookY: 0, follow: 1, scan: 0, tilt: 0, hop: 0, bob: 0, sink: 0 };
  const pointer = { x: 0, y: 0, gazeX: 0, gazeY: 0 };
  const impulse = { shake: 0, pop: 0 };
  const slid = { x: 0, y: 0 };
  const slide = (sign: number) => eyes.forEach((eye, index) => {
    eye.position.x += sign * slid.x * eyeShift[index];
    eye.position.y += sign * slid.y * eyeShift[index];
  });
  let state: BotState = "idle";
  let mood: AskMood | null = null;
  let face = faceFor(state, mood);
  let raf = 0;

  const onPointer = (event: PointerEvent) => {
    const gaze = pointerGaze({ x: event.clientX, y: event.clientY }, canvas.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight });
    pointer.x = gaze.x; pointer.y = gaze.y;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  const refresh = () => {
    const next = faceFor(state, mood);
    if (next.impulse && next.impulse !== face.impulse) impulse[next.impulse] = 1;
    face = next;
  };

  const place = (t: number, dt: number) => {
    const follow = Math.min(1, dt * GAZE_PER_SECOND);
    pointer.gazeX += (pointer.x - pointer.gazeX) * follow;
    pointer.gazeY += (pointer.y - pointer.gazeY) * follow;
    const clamp = (value: number) => Math.max(-1, Math.min(1, value));
    const x = clamp(pose.lookX + pointer.gazeX * pose.follow + Math.sin(t * 6) * 0.7 * pose.scan);
    const y = clamp(pose.lookY + pointer.gazeY * pose.follow);
    slid.x = x; slid.y = y;
    slide(1);
    model.rotation.set(-y * TURN.y, x * TURN.x + Math.sin(t * 45) * 0.12 * impulse.shake, pose.tilt * TURN.tilt);
    const lift = Math.sin(t * 11) * 0.025 * pose.bob + Math.abs(Math.sin(t * 6)) * 0.05 * pose.hop - 0.05 * pose.sink;
    model.position.y = lift * radius;
    // Sleeping breathes slowly; a pop swells and settles.
    model.scale.setScalar(1 + 0.1 * Math.sin(Math.PI * impulse.pop) + Math.sin(t * 1.6) * 0.012 * pose.Blink);
  };

  const draw = () => {
    raf = requestAnimationFrame(draw);
    if (document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.1);
    // Undo last frame's eye slide first: the animation may or may not rewrite eye positions.
    slide(-1);
    mixer.update(dt);
    ease(pose, face, Math.min(1, dt * EASE_PER_SECOND));
    impulse.shake = Math.max(0, impulse.shake - dt * IMPULSE_DECAY_PER_SECOND);
    impulse.pop = Math.max(0, impulse.pop - dt * IMPULSE_DECAY_PER_SECOND);
    shapeEyes(eyes, pose);
    place(clock.elapsedTime, dt);
    renderer.render(scene, camera);
  };
  draw();

  return {
    setState(next) { state = next; refresh(); },
    setMood(next) { mood = next; refresh(); },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      mixer.stopAllAction();
      disposeTree(model);
      scene.environment?.dispose();
      renderer.dispose();
    },
  };
}
