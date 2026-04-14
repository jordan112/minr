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

    // Sun — bright yellow sphere, fog-proof
    const sunGeo = new THREE.SphereGeometry(12, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffee55, fog: false });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    // Sun glow (larger transparent sphere around sun)
    const glowGeo = new THREE.SphereGeometry(20, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.15, fog: false });
    this.sunGlow = new THREE.Mesh(glowGeo, glowMat);
    this.sunMesh.add(this.sunGlow);
    this.scene.add(this.sunMesh);

    // Moon — white sphere, fog-proof
    const moonGeo = new THREE.SphereGeometry(7, 16, 16);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xddddee, fog: false });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.scene.add(this.moonMesh);

    // Stars — fog-proof
    const starsGeo = new THREE.BufferGeometry();
    const starPositions: number[] = [];
    for (let i = 0; i < 800; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = 400;
      starPositions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
    }
    starsGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, fog: false });
    this.stars = new THREE.Points(starsGeo, starsMat);
    this.stars.visible = false;
    this.scene.add(this.stars);

    // Clouds — flat white boxes floating in the sky
    this.cloudGroup = new THREE.Group();
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, fog: false });
    for (let i = 0; i < 25; i++) {
      const cw = 8 + Math.random() * 15;
      const cd = 6 + Math.random() * 10;
      const cloud = new THREE.Mesh(new THREE.BoxGeometry(cw, 1.5, cd), cloudMat);
      cloud.position.set(
        (Math.random() - 0.5) * 300,
        70 + Math.random() * 20,
        (Math.random() - 0.5) * 300
      );
      // Add extra puffs
      for (let j = 0; j < 3; j++) {
        const puff = new THREE.Mesh(
          new THREE.BoxGeometry(cw * 0.5, 2, cd * 0.4),
          cloudMat
        );
        puff.position.set(
          (Math.random() - 0.5) * cw * 0.6,
          0.8 + Math.random() * 0.5,
          (Math.random() - 0.5) * cd * 0.4
        );
        cloud.add(puff);
      }
      this.cloudGroup.add(cloud);
    }
    this.scene.add(this.cloudGroup);

    window.addEventListener("resize", this.onResize);
  }

  sunLight!: THREE.DirectionalLight;
  sunMesh!: THREE.Mesh;
  sunGlow!: THREE.Mesh;
  moonMesh!: THREE.Mesh;
  stars!: THREE.Points;
  cloudGroup!: THREE.Group;

  updateDayNight(dayTime: number, playerPos: THREE.Vector3): void {
    const sunAngle = dayTime * Math.PI * 2 - Math.PI / 2;
    const skyRadius = 150;

    // Sun position — orbits player, ABOVE fog
    this.sunMesh.position.set(
      playerPos.x + Math.cos(sunAngle) * skyRadius,
      Math.max(30, Math.sin(sunAngle) * skyRadius + 60),
      playerPos.z + Math.sin(sunAngle) * skyRadius * 0.3
    );

    // Moon opposite
    this.moonMesh.position.set(
      playerPos.x + Math.cos(sunAngle + Math.PI) * skyRadius,
      Math.max(30, Math.sin(sunAngle + Math.PI) * skyRadius + 60),
      playerPos.z + Math.sin(sunAngle + Math.PI) * skyRadius * 0.3
    );

    // Visibility
    this.sunMesh.visible = Math.sin(sunAngle) > -0.2;
    this.moonMesh.visible = Math.sin(sunAngle + Math.PI) > -0.2;

    // Stars
    const isNight = dayTime < 0.25 || dayTime > 0.75;
    this.stars.visible = isNight;
    this.stars.position.copy(playerPos);

    // Clouds follow player, drift slowly
    this.cloudGroup.position.x = playerPos.x;
    this.cloudGroup.position.z = playerPos.z;
    this.cloudGroup.rotation.y += 0.0002; // slow drift
    // Dim clouds at night
    this.cloudGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshBasicMaterial) {
        obj.material.opacity = isNight ? 0.2 : 0.7;
      }
    });

    // Directional light follows sun
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
