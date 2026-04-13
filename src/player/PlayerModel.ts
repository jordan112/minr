import * as THREE from "three";
import { ToolType } from "./ToolSystem";

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
  private swingTime = 0;
  private isSwinging = false;

  // Tool meshes — we swap visibility
  private toolGroups = new Map<ToolType, THREE.Group>();
  private currentTool: ToolType = ToolType.PICKAXE;

  constructor() {
    this.group = new THREE.Group();

    const skin = new THREE.MeshLambertMaterial({ color: 0xc68642 });
    const shirt = new THREE.MeshLambertMaterial({ color: 0x4a90d9 });
    const pants = new THREE.MeshLambertMaterial({ color: 0x3b3b6b });
    const hair = new THREE.MeshLambertMaterial({ color: 0x3b2316 });
    const shoe = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const eye = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const pupil = new THREE.MeshLambertMaterial({ color: 0x111111 });

    // Head
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
    this.head.position.y = 1.55;
    this.group.add(this.head);

    const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.15, 0.52), hair);
    hairMesh.position.y = 0.2;
    this.head.add(hairMesh);

    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.02), eye);
    leftEye.position.set(-0.12, 0.05, 0.26);
    this.head.add(leftEye);
    const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.02), eye);
    rightEye.position.set(0.12, 0.05, 0.26);
    this.head.add(rightEye);

    const leftPupil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), pupil);
    leftPupil.position.set(-0.12, 0.04, 0.27);
    this.head.add(leftPupil);
    const rightPupil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), pupil);
    rightPupil.position.set(0.12, 0.04, 0.27);
    this.head.add(rightPupil);

    // Body
    this.body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.3), shirt);
    this.body.position.y = 0.975;
    this.group.add(this.body);

    // Left arm
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.375, 1.3, 0);
    const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), shirt);
    leftArmMesh.position.y = -0.35;
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

    // Build all tool models and attach to right arm
    this.buildTools();

    this.group.add(this.rightArm);

    // Legs
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.125, 0.6, 0);
    const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.45, 0.27), pants);
    leftLegMesh.position.y = -0.225;
    const leftShin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.27), shoe);
    leftShin.position.y = -0.5;
    this.leftLeg.add(leftLegMesh, leftShin);
    this.group.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.125, 0.6, 0);
    const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.45, 0.27), pants);
    rightLegMesh.position.y = -0.225;
    const rightShin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.27), shoe);
    rightShin.position.y = -0.5;
    this.rightLeg.add(rightLegMesh, rightShin);
    this.group.add(this.rightLeg);

    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.castShadow = true;
    });

    this.setTool(ToolType.PICKAXE);
  }

  private buildTools(): void {
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x6b4226 });
    const ironMat = new THREE.MeshLambertMaterial({ color: 0x999999 });
    const swordMat = new THREE.MeshLambertMaterial({ color: 0xbbbbdd });
    const axeHeadMat = new THREE.MeshLambertMaterial({ color: 0x777777 });

    // Hand (empty) — just a small fist indicator, already have forearm
    const handGroup = new THREE.Group();
    this.toolGroups.set(ToolType.HAND, handGroup);
    this.rightArm.add(handGroup);

    // Pickaxe
    const pickGroup = new THREE.Group();
    pickGroup.position.set(0, -0.65, 0.2);
    pickGroup.rotation.x = -0.8;
    pickGroup.rotation.z = 0.1;

    const pickHandle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), handleMat);
    pickGroup.add(pickHandle);

    const pickHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.08), ironMat);
    pickHead.position.y = 0.4;
    pickGroup.add(pickHead);

    const pickTip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.08), ironMat);
    pickTip.position.set(0.3, 0.35, 0);
    pickTip.rotation.z = -0.4;
    pickGroup.add(pickTip);

    this.toolGroups.set(ToolType.PICKAXE, pickGroup);
    this.rightArm.add(pickGroup);

    // Axe
    const axeGroup = new THREE.Group();
    axeGroup.position.set(0, -0.65, 0.2);
    axeGroup.rotation.x = -0.8;
    axeGroup.rotation.z = 0.1;

    const axeHandle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), handleMat);
    axeGroup.add(axeHandle);

    // Axe head — wider on one side
    const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.08), axeHeadMat);
    axeHead.position.set(0.18, 0.35, 0);
    axeGroup.add(axeHead);

    // Axe blade edge
    const axeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.1), axeHeadMat);
    axeBlade.position.set(0.35, 0.35, 0);
    axeGroup.add(axeBlade);

    this.toolGroups.set(ToolType.AXE, axeGroup);
    this.rightArm.add(axeGroup);

    // Sword
    const swordGroup = new THREE.Group();
    swordGroup.position.set(0, -0.65, 0.2);
    swordGroup.rotation.x = -0.8;
    swordGroup.rotation.z = 0.1;

    // Sword handle
    const swordHandle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.06), handleMat);
    swordHandle.position.y = -0.15;
    swordGroup.add(swordHandle);

    // Crossguard
    const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.08), ironMat);
    crossguard.position.y = 0.0;
    swordGroup.add(crossguard);

    // Blade
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.04), swordMat);
    blade.position.y = 0.38;
    swordGroup.add(blade);

    // Blade tip
    const bladeTip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.04), swordMat);
    bladeTip.position.y = 0.75;
    swordGroup.add(bladeTip);

    this.toolGroups.set(ToolType.SWORD, swordGroup);
    this.rightArm.add(swordGroup);

    // Fishing Rod
    const rodGroup = new THREE.Group();
    rodGroup.position.set(0, -0.65, 0.2);
    rodGroup.rotation.x = -1.0;
    rodGroup.rotation.z = 0.1;

    // Rod pole (long thin stick)
    const rodPole = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.2, 0.04), handleMat);
    rodPole.position.y = 0.2;
    rodGroup.add(rodPole);

    // Rod tip (thinner)
    const rodTip = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.3, 0.025), handleMat);
    rodTip.position.y = 0.95;
    rodGroup.add(rodTip);

    // Reel
    const reelMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const reel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.1), reelMat);
    reel.position.set(0, -0.15, 0.05);
    rodGroup.add(reel);

    // Fishing line (thin vertical line from tip)
    const lineMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.5, 0.01), lineMat);
    line.position.set(0, 1.3, 0);
    rodGroup.add(line);

    // Hook
    const hookMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.03), hookMat);
    hook.position.set(0, 1.05, 0);
    rodGroup.add(hook);

    this.toolGroups.set(ToolType.FISHING_ROD, rodGroup);
    this.rightArm.add(rodGroup);
  }

  setTool(tool: ToolType): void {
    this.currentTool = tool;
    for (const [type, group] of this.toolGroups) {
      group.visible = type === tool;
    }
  }

  triggerSwing(): void {
    this.isSwinging = true;
    this.swingTime = 0;
  }

  update(dt: number, isMoving: boolean, yaw: number, position: THREE.Vector3): void {
    this.group.position.copy(position);
    this.group.rotation.y = yaw + Math.PI;

    // Walk animation
    if (isMoving) {
      this.walkTime += dt * 8;
    } else {
      this.walkTime *= 0.85;
    }

    const swing = Math.sin(this.walkTime) * 0.6;
    this.leftArm.rotation.x = swing;
    this.leftLeg.rotation.x = -swing;
    this.rightLeg.rotation.x = swing;

    // Right arm: walk swing OR attack swing
    if (this.isSwinging) {
      this.swingTime += dt * 8;
      // Quick swing down and back
      const swingAmt = Math.sin(this.swingTime * Math.PI) * 1.5;
      this.rightArm.rotation.x = -swingAmt;
      if (this.swingTime > 1) {
        this.isSwinging = false;
      }
    } else {
      this.rightArm.rotation.x = -swing;
    }
  }
}
