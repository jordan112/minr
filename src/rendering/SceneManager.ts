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
    this.sunLight = sunLight;
    this.scene.add(sunLight);

    // Sun sphere
    const sunGeo = new THREE.SphereGeometry(8, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffee55 });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.scene.add(this.sunMesh);

    // Moon sphere
    const moonGeo = new THREE.SphereGeometry(5, 16, 16);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xccccdd });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.scene.add(this.moonMesh);

    // Stars (small white dots, visible at night)
    const starsGeo = new THREE.BufferGeometry();
    const starPositions: number[] = [];
    for (let i = 0; i < 500; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = 300;
      starPositions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
    }
    starsGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5 });
    this.stars = new THREE.Points(starsGeo, starsMat);
    this.stars.visible = false;
    this.scene.add(this.stars);

    window.addEventListener("resize", this.onResize);
  }

  sunLight!: THREE.DirectionalLight;
  sunMesh!: THREE.Mesh;
  moonMesh!: THREE.Mesh;
  stars!: THREE.Points;

  updateDayNight(dayTime: number, playerPos: THREE.Vector3): void {
    const sunAngle = dayTime * Math.PI * 2 - Math.PI / 2;
    const skyRadius = 200;

    // Sun position (orbits around player)
    this.sunMesh.position.set(
      playerPos.x + Math.cos(sunAngle) * skyRadius,
      Math.sin(sunAngle) * skyRadius + 50,
      playerPos.z
    );

    // Moon opposite the sun
    this.moonMesh.position.set(
      playerPos.x + Math.cos(sunAngle + Math.PI) * skyRadius,
      Math.sin(sunAngle + Math.PI) * skyRadius + 50,
      playerPos.z
    );

    // Sun only visible above horizon
    this.sunMesh.visible = Math.sin(sunAngle) > -0.1;
    this.moonMesh.visible = Math.sin(sunAngle + Math.PI) > -0.1;

    // Stars visible at night
    const isNight = dayTime < 0.25 || dayTime > 0.75;
    this.stars.visible = isNight;
    if (isNight) {
      this.stars.position.copy(playerPos);
    }

    // Move directional light with sun
    this.sunLight.position.set(
      Math.cos(sunAngle) * 50,
      Math.max(10, Math.sin(sunAngle) * 100),
      30
    );
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
