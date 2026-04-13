import * as THREE from "three";

/**
 * Blocky Minecraft-style player model built from box geometries.
 * Body parts are grouped so they can be animated (arm/leg swing while walking).
 */
export class PlayerModel {
  group: THREE.Group;
  private head: THREE.Mesh;
  private body: THREE.Mesh;
  private leftArm: THREE.Group;
  private rightArm: THREE.Group;
  private leftLeg: THREE.Group;
  private rightLeg: THREE.Group;
  private walkTime = 0;

  constructor() {
    this.group = new THREE.Group();

    const skin = new THREE.MeshLambertMaterial({ color: 0xc68642 }); // skin tone
    const shirt = new THREE.MeshLambertMaterial({ color: 0x4a90d9 }); // blue shirt
    const pants = new THREE.MeshLambertMaterial({ color: 0x3b3b6b }); // dark pants
    const hair = new THREE.MeshLambertMaterial({ color: 0x3b2316 }); // dark hair
    const shoe = new THREE.MeshLambertMaterial({ color: 0x2a2a2a }); // dark shoes
    const eye = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const pupil = new THREE.MeshLambertMaterial({ color: 0x111111 });

    // Head (8x8x8 pixels → 0.5 x 0.5 x 0.5 units)
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
    this.head.position.y = 1.55;
    this.group.add(this.head);

    // Hair on top of head
    const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.15, 0.52), hair);
    hairMesh.position.y = 0.2;
    this.head.add(hairMesh);

    // Eyes
    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.02), eye);
    leftEye.position.set(-0.12, 0.05, 0.26);
    this.head.add(leftEye);
    const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.02), eye);
    rightEye.position.set(0.12, 0.05, 0.26);
    this.head.add(rightEye);

    // Pupils
    const leftPupil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), pupil);
    leftPupil.position.set(-0.12, 0.04, 0.27);
    this.head.add(leftPupil);
    const rightPupil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), pupil);
    rightPupil.position.set(0.12, 0.04, 0.27);
    this.head.add(rightPupil);

    // Body / torso (8x12x4 → 0.5 x 0.75 x 0.25)
    this.body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.3), shirt);
    this.body.position.y = 0.975;
    this.group.add(this.body);

    // Arms — pivot from shoulder, so group origin is at shoulder
    // Left arm
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.375, 1.3, 0);
    const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), shirt);
    leftArmMesh.position.y = -0.35;
    // Forearm skin
    const leftForearm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.24), skin);
    leftForearm.position.y = -0.55;
    this.leftArm.add(leftArmMesh, leftForearm);
    this.group.add(this.leftArm);

    // Right arm
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.375, 1.3, 0);
    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), shirt);
    rightArmMesh.position.y = -0.35;
    const rightForearm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.24), skin);
    rightForearm.position.y = -0.55;
    this.rightArm.add(rightArmMesh, rightForearm);
    this.group.add(this.rightArm);

    // Legs — pivot from hip
    // Left leg
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.125, 0.6, 0);
    const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.45, 0.27), pants);
    leftLegMesh.position.y = -0.225;
    const leftShin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.27), shoe);
    leftShin.position.y = -0.5;
    this.leftLeg.add(leftLegMesh, leftShin);
    this.group.add(this.leftLeg);

    // Right leg
    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.125, 0.6, 0);
    const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.45, 0.27), pants);
    rightLegMesh.position.y = -0.225;
    const rightShin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.27), shoe);
    rightShin.position.y = -0.5;
    this.rightLeg.add(rightLegMesh, rightShin);
    this.group.add(this.rightLeg);

    // Cast shadows from all parts
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
      }
    });
  }

  update(dt: number, isMoving: boolean, yaw: number, position: THREE.Vector3): void {
    // Position the model at player feet
    this.group.position.copy(position);
    // Face the direction the player is looking
    this.group.rotation.y = yaw + Math.PI; // model faces +Z, camera faces -Z

    // Walk animation
    if (isMoving) {
      this.walkTime += dt * 8;
    } else {
      // Ease back to idle
      this.walkTime *= 0.85;
    }

    const swing = Math.sin(this.walkTime) * 0.6;
    this.leftArm.rotation.x = swing;
    this.rightArm.rotation.x = -swing;
    this.leftLeg.rotation.x = -swing;
    this.rightLeg.rotation.x = swing;
  }
}
