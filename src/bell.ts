import * as THREE from "three";
import { ChurchBellSimulator } from "./bell-pendulum-simulator.js";

const BELL = "BellParent";
const CLAPPER = "ClapperParent";
const SCALE_BEAM = "ScaleBeam";
const BOTTOM = "Bottom";
const SIDE = "Side";
const PIVOT = "Pivot";
const CHAIN = "Chain";
const LUG = "Lug";
const STATIC = "Static";

function left(name: string) {
  return `${name}L`;
}

function right(name: string) {
  return `${name}R`;
}

function isObject3D(obj: unknown): obj is THREE.Object3D {
  return obj instanceof THREE.Object3D;
}

export class Bell {
  private _bell: THREE.Object3D;
  private _pivot: THREE.Object3D;
  private _clapper: THREE.Object3D;
  private _leftSide: THREE.Object3D;
  private _rightSide: THREE.Object3D;
  private _bottom: THREE.Object3D;
  private _leftChain: THREE.Object3D;
  private _rightChain: THREE.Object3D;
  private _scaleBeam: THREE.Object3D;
  private _leftLug: THREE.Object3D;
  private _staticPart: THREE.Object3D;

  private _pivotRadius: number;
  private _bottomRadius: number;
  private _sideRadius: number;
  private _lugRadius: number;
  private _leftChainOriginalPosition: THREE.Vector3;
  private _scaleBeamEffectiveLength: number;

  private _pendulumSimulator: ChurchBellSimulator;

  private _isStaticVisible: boolean = true;
  public get isStaticVisible(): boolean {
    return this._isStaticVisible;
  }

  constructor(model: THREE.Object3D) {
    const bell = model.getObjectByName(BELL);
    const pivot = model.getObjectByName(PIVOT);
    const clapper = model.getObjectByName(CLAPPER);
    const leftSide = model.getObjectByName(left(SIDE));
    const rightSide = model.getObjectByName(right(SIDE));
    const bottom = model.getObjectByName(BOTTOM);
    const leftChain = model.getObjectByName(left(CHAIN));
    const rightChain = model.getObjectByName(right(CHAIN));
    const scaleBeam = model.getObjectByName(SCALE_BEAM);
    const leftLug = model.getObjectByName(left(LUG));
    const staticParts = model.getObjectByName(STATIC);

    if (
      !isObject3D(bell) ||
      !isObject3D(pivot) ||
      !isObject3D(clapper) ||
      !isObject3D(leftSide) ||
      !isObject3D(rightSide) ||
      !isObject3D(bottom) ||
      !isObject3D(leftChain) ||
      !isObject3D(rightChain) ||
      !isObject3D(scaleBeam) ||
      !isObject3D(leftLug) ||
      !isObject3D(staticParts)
    ) {
      console.log(
        bell,
        pivot,
        clapper,
        leftSide,
        rightSide,
        bottom,
        leftChain,
        rightChain,
        scaleBeam,
        leftLug,
        staticParts,
      );
      throw Error("Invalid objects");
    }

    this._bell = bell;
    this._pivot = pivot;
    this._clapper = clapper;
    this._leftSide = leftSide;
    this._rightSide = rightSide;
    this._bottom = bottom;
    this._leftChain = leftChain;
    this._rightChain = rightChain;
    this._scaleBeam = scaleBeam;
    this._leftLug = leftLug;
    this._staticPart = staticParts;

    this._pivotRadius = this._getSize(this._pivot).x / 2;
    this._bottomRadius = this._getSize(this._bottom).y;
    this._sideRadius = this._getSize(this._leftSide).x;
    this._lugRadius = this._getOrigin(this._leftLug).sub(
      this._getOrigin(this._leftSide),
    ).x;

    const clapperSize = this._getSize(this._clapper);

    this._pendulumSimulator = new ChurchBellSimulator({
      mass: 2000,
      length: 1,
      damping: 0.5,
      driveMaxVelocity: 0.3,
      driveTorque: 200, // Motor force
      driveFrequency: Math.PI / 3, // Tuned to natural frequency ~2.33 rad/s
      clapperOffset: this._getOrigin(this._clapper).distanceTo(
        this._getOrigin(this._bell),
      ),
      clapperLength: clapperSize.z,
      clapperEqLength: 1.1,
      clapperStrikeAngle: (Math.PI / 180) * 24.7, // ~20 degrees inner clearance
      clapperRestitution: 0.15, // Slight rebound
    });

    this._leftChainOriginalPosition = this._leftChain.position.clone();
    this._scaleBeamEffectiveLength = this._leftChain.position.distanceTo(
      this._rightChain.position,
    );
  }

  update(dt: number) {
    const state = this._pendulumSimulator.update(dt);

    const sideAngle = (state.bellAngle * this._pivotRadius) / this._sideRadius;
    this._setRotation(this._bell, "z", state.bellAngle);
    this._setRotation(
      this._bottom,
      "z",
      (state.bellAngle * this._pivotRadius) / this._bottomRadius,
    );
    this._setRotation(this._rightSide, "y", sideAngle);
    this._setRotation(this._leftSide, "y", -sideAngle);
    this._setRotation(this._clapper, "z", state.clapperAngle);

    const yChange = Math.tan(sideAngle) * this._lugRadius;
    this._leftChain.position.y = this._leftChainOriginalPosition.y + yChange;
    this._rightChain.position.y = this._leftChainOriginalPosition.y - yChange;

    const scaleAngle = Math.asin(
      (2 * yChange) / this._scaleBeamEffectiveLength,
    );
    this._setRotation(this._scaleBeam, "y", -scaleAngle);
  }

  toggleStaticVisible() {
    this._isStaticVisible = !this._isStaticVisible;
    this._staticPart.visible = this._isStaticVisible;
  }

  private _getSize(obj: THREE.Object3D) {
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(obj, true).getSize(size);
    return size;
  }

  private _getOrigin(obj: THREE.Object3D) {
    const position = new THREE.Vector3();
    obj.getWorldPosition(position);
    return position;
  }

  private _setRotation(
    obj: THREE.Object3D,
    axis: "x" | "y" | "z",
    angle: number,
  ) {
    if (axis === "x") obj.rotateX(angle - obj.rotation.x);
    if (axis === "y") obj.rotateY(angle - obj.rotation.y);
    if (axis === "z") obj.rotateZ(angle - obj.rotation.z);
  }
}
