import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { Bell } from "./bell";

const HIDE_STATIC = "visibility\_off";
const SHOW_STATIC = "visibility";

const canvas = document.querySelector("#webgl");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1e1e24);

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

const rgbeLoader = new HDRLoader();

rgbeLoader.load(
  `${import.meta.env.BASE_URL}studio_small_09_1k.hdr`,
  (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
  },
);

// --- Camera ---
const camera = new THREE.PerspectiveCamera(
  45,
  sizes.width / sizes.height,
  0.1,
  1000,
);
camera.position.set(8, 0.5, 4);
scene.add(camera);

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({
  canvas: canvas!,
  antialias: true,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 0.4;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// --- Controls ---
const controls = new OrbitControls(camera, canvas as HTMLElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.update();

controls.target.set(0, 1, 0);
controls.update();

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7.5);
dirLight.castShadow = true;
dirLight.shadow.normalBias = 0.05;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
scene.add(dirLight);

// --- GLTF Model Loader ---
const loader = new GLTFLoader();

let bell: Bell | undefined;

loader.load(
  `${import.meta.env.BASE_URL}bell.glb`,
  (gltf) => {
    const model = gltf.scene;

    // Enable shadows on loaded model meshes
    model.traverse((child) => {
      if ((child as any).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    scene.add(model);
    bell = new Bell(model);
  },
  () => {},
  (error) => {
    console.error("An error occurred loading the model:", error);
  },
);

// --- Window Resize Handler ---
window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// --- Animation Loop ---
const timer = new THREE.Timer();
function animate(timestamp: number) {
  controls.update();
  timer.update(timestamp);

  renderer.render(scene, camera);

  const dt = Math.min(timer.getDelta(), 0.1);
  bell?.update(dt);
}

renderer.setAnimationLoop(animate);

const button = document.getElementById("toggleBtn");
const buttonIcon = document.getElementById("toggleButtonIcon");

button?.addEventListener("click", () => {
  if (!bell) return;

  bell.toggleStaticVisible();
  if (buttonIcon) buttonIcon.textContent = bell.isStaticVisible ? HIDE_STATIC : SHOW_STATIC;
});
