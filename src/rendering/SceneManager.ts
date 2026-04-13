import * as THREE from "three";
import { RENDER_DISTANCE, CHUNK_SIZE } from "../utils/constants";

export class SceneManager {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x87ceeb); // sky blue

    this.scene = new THREE.Scene();

    // Fog to hide chunk pop-in
    const fogDist = RENDER_DISTANCE * CHUNK_SIZE;
    this.scene.fog = new THREE.Fog(0x87ceeb, fogDist * 0.6, fogDist);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 80, 0);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.5);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(50, 100, 30);
    this.scene.add(sunLight);

    window.addEventListener("resize", this.onResize);
  }

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
