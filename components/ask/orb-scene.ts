import {
  ACESFilmicToneMapping, AnimationMixer, Box3, Clock, DirectionalLight, Mesh, PerspectiveCamera, PMREMGenerator, Scene,
  Sphere, WebGLRenderer, type Material, type Object3D,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { BotState } from "./assistant-orb";

export type OrbScene = { setState(state: BotState): void; dispose(): void };

const FOV = 28;
const FRAMING = 1.08;
const EASE_PER_SECOND = 8;
// Eye shape each state leans towards, layered on top of the designed Idle blinks.
const EXPRESSIONS: Record<BotState, { Wide: number; Squint: number; HalfBlink: number }> = {
  idle: { Wide: 0, Squint: 0, HalfBlink: 0 },
  listening: { Wide: 0.7, Squint: 0, HalfBlink: 0 },
  thinking: { Wide: 0, Squint: 0.55, HalfBlink: 0.2 },
  speaking: { Wide: 0.25, Squint: 0, HalfBlink: 0 },
};
type Shape = keyof (typeof EXPRESSIONS)["idle"];
const SHAPES: Shape[] = ["Wide", "Squint", "HalfBlink"];

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

/** Renders one assistant on `canvas`: its Idle animation plus a state expression and a talking bob. */
export async function mountOrb(canvas: HTMLCanvasElement, modelUrl: string): Promise<OrbScene> {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.toneMapping = ACESFilmicToneMapping;
  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  const key = new DirectionalLight(0xffffff, 1.4);
  key.position.set(-2, 3, 4);
  scene.add(key);

  let gltf;
  try {
    gltf = await new GLTFLoader().loadAsync(modelUrl);
  } catch (error) {
    environment.dispose(); pmrem.dispose(); renderer.dispose();
    throw error;
  }
  const model = gltf.scene;
  scene.add(model);
  const bounds = new Box3().setFromObject(model).getBoundingSphere(new Sphere());
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(bounds.center.x, bounds.center.y, bounds.center.z + (bounds.radius * FRAMING) / Math.sin((FOV * Math.PI) / 360));
  camera.lookAt(bounds.center);

  const mixer = new AnimationMixer(model);
  gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
  const eyes = eyesOf(model);
  const baseY = model.position.y;
  const clock = new Clock();
  const current = { Wide: 0, Squint: 0, HalfBlink: 0, bob: 0 };
  let target: BotState = "idle";
  let frame = 0;

  const draw = () => {
    frame = requestAnimationFrame(draw);
    if (document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.1);
    mixer.update(dt);
    const ease = Math.min(1, dt * EASE_PER_SECOND);
    for (const shape of SHAPES) current[shape] += (EXPRESSIONS[target][shape] - current[shape]) * ease;
    current.bob += ((target === "speaking" ? 1 : 0) - current.bob) * ease;
    for (const eye of eyes) {
      for (const shape of SHAPES) {
        const index = eye.morphTargetDictionary?.[shape];
        // Keep the animation's own blinks: only ever push a shape further, never cancel it.
        if (index !== undefined && eye.morphTargetInfluences) eye.morphTargetInfluences[index] = Math.max(eye.morphTargetInfluences[index], current[shape]);
      }
    }
    model.position.y = baseY + Math.sin(clock.elapsedTime * 11) * 0.025 * bounds.radius * current.bob;
    renderer.render(scene, camera);
  };
  draw();

  return {
    setState(state) { target = state; },
    dispose() {
      cancelAnimationFrame(frame);
      mixer.stopAllAction();
      disposeTree(model);
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
