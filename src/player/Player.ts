import * as THREE from "three";

export class Player {
  position = new THREE.Vector3(0, 80, 0);
  velocity = new THREE.Vector3(0, 0, 0);
  yaw = 0;   // horizontal rotation (radians)
  pitch = 0; // vertical rotation (radians)
  isGrounded = false;
  selectedBlockIndex = 0;
}
