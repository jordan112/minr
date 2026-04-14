import * as THREE from "three";
import { World } from "../world/World";
import { BlockId } from "../world/BlockType";

export class Boat {
  group: THREE.Group;
  position: THREE.Vector3;
  yaw = 0;
  private world: World;
  isOccupied = false;
  private bobTime = Math.random() * 10;

  constructor(world: World, x: number, y: number, z: number) {
    this.world = world;
    this.position = new THREE.Vector3(x, y, z);
    this.group = new THREE.Group();

    const woodMat = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
    const darkWood = new THREE.MeshLambertMaterial({ color: 0x5c4020 });
    const seatMat = new THREE.MeshLambertMaterial({ color: 0x6b4226 });

    // Hull bottom
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 2.2), woodMat);
    hull.position.y = -0.1;
    this.group.add(hull);

    // Left side
    const leftSide = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 2.2), darkWood);
    leftSide.position.set(-0.6, 0.1, 0);
    this.group.add(leftSide);

    // Right side
    const rightSide = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 2.2), darkWood);
    rightSide.position.set(0.6, 0.1, 0);
    this.group.add(rightSide);

    // Front (bow)
    const bow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 0.12), darkWood);
    bow.position.set(0, 0.1, 1.1);
    this.group.add(bow);

    // Back (stern)
    const stern = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 0.12), darkWood);
    stern.position.set(0, 0.1, -1.1);
    this.group.add(stern);

    // Seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.4), seatMat);
    seat.position.set(0, 0.05, -0.2);
    this.group.add(seat);

    // Front raised bow
    const bowRaise = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.3), woodMat);
    bowRaise.position.set(0, 0.2, 0.9);
    bowRaise.rotation.x = -0.3;
    this.group.add(bowRaise);

    // Paddle (leaning against side)
    const paddleHandle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.0), seatMat);
    paddleHandle.position.set(0.45, 0.3, 0);
    paddleHandle.rotation.x = 0.1;
    this.group.add(paddleHandle);

    const paddleBlade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.3), darkWood);
    paddleBlade.position.set(0.45, 0.28, 0.6);
    this.group.add(paddleBlade);

    this.group.position.copy(this.position);
  }

  update(dt: number): void {
    if (this.isOccupied) return; // Player controls movement when occupied

    // Bob on water
    this.bobTime += dt;
    const waterY = this.findWaterSurface();
    if (waterY > 0) {
      this.position.y = waterY + Math.sin(this.bobTime * 1.5) * 0.05;
    }

    // Gentle drift
    this.position.x += Math.sin(this.bobTime * 0.3) * 0.005;
    this.position.z += Math.cos(this.bobTime * 0.2) * 0.005;

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    this.group.rotation.z = Math.sin(this.bobTime * 2) * 0.03; // rock side to side
  }

  steer(forward: number, turn: number, dt: number): void {
    this.yaw += turn * 2 * dt;

    const speed = 6;
    this.position.x += Math.sin(this.yaw) * forward * speed * dt;
    this.position.z += Math.cos(this.yaw) * forward * speed * dt;

    // Stay on water surface
    const waterY = this.findWaterSurface();
    if (waterY > 0) {
      this.bobTime += dt;
      this.position.y = waterY + Math.sin(this.bobTime * 2) * 0.05;
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    this.group.rotation.z = turn * -0.15; // lean into turns
  }

  private findWaterSurface(): number {
    const bx = Math.floor(this.position.x);
    const bz = Math.floor(this.position.z);
    for (let y = Math.floor(this.position.y) + 3; y >= 0; y--) {
      if (this.world.getBlock(bx, y, bz) === BlockId.WATER &&
          this.world.getBlock(bx, y + 1, bz) !== BlockId.WATER) {
        return y + 0.9; // float slightly above water
      }
    }
    return -1;
  }

  get radius(): number { return 1.5; }
}
