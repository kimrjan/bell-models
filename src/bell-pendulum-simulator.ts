export interface BellConfig {
  // Bell Physics
  mass: number; // Bell mass in kg (e.g., 500)
  length: number; // Distance from axle to bell center of mass (m)
  damping: number; // Bell friction (e.g., 0.2)

  // Motor / Rope Driving Force
  driveMaxVelocity: number;
  driveTorque: number; // Driving torque magnitude τ_0 (N·m)
  driveFrequency: number; // Driving frequency ω_d in rad/s (match natural frequency for resonance)

  // Clapper Physics
  clapperOffset: number; // Distance r from axle to clapper pivot staple (m)
  clapperLength: number; // Distance L_c to clapper hearth center (m)
  clapperEqLength: number; // Equivalent pendulum length L_c_eq (m)
  clapperStrikeAngle: number; // Max angle φ (rad) inside bell before striking inner wall (~0.35 rad)
  clapperRestitution: number; // Bounce/damping coefficient on impact (0.1 - 0.3)
}

export interface SimulationState {
  time: number;
  bellAngle: number; // θ (rad)
  bellAngularVelocity: number; // dθ/dt (rad/s)
  clapperAngle: number; // Relative angle φ (rad)
  clapperAngularVelocity: number; // dφ/dt (rad/s)
  clapperWorldPos: { x: number; y: number }; // Global Cartesian (x, y) of hearth
}

export class ChurchBellSimulator {
  private config: BellConfig;

  // Bell State
  public theta: number = 0; // θ (rad)
  public thetaVelocity: number = 0; // dθ/dt
  public time: number = 0; // t (s)

  // Clapper State
  public phi: number = 0; // Relative φ (rad)
  public phiVelocity: number = 0; // dφ/dt

  // Optional Callback for Sound FX
  public onStrike?: (impactVelocity: number, side: "left" | "right") => void;

  constructor(config: BellConfig) {
    this.config = config;
  }

  /**
   * Helper to calculate the natural frequency of the bell
   */
  public getNaturalFrequency(): number {
    return Math.sqrt(9.81 / this.config.length);
  }

  /**
   * Single update tick advances both bell and clapper physics simultaneously
   * @param dt Frame delta time in seconds (e.g., 1 / 60)
   */
  public update(dt: number): SimulationState {
    const g = 9.81;
    const {
      mass,
      length,
      damping,
      driveMaxVelocity,
      driveTorque,
      driveFrequency,
      clapperOffset,
      clapperEqLength,
      clapperStrikeAngle,
      clapperRestitution,
    } = this.config;

    // ==========================================
    // 1. STEP BELL PHYSICS (FORCED PENDULUM)
    // ==========================================
    const I_bell = mass * length * length;
    const gravityTorque = -mass * g * length * Math.sin(this.theta);
    const frictionTorque = -damping * this.thetaVelocity;
    // const externalDriveTorque = driveTorque * Math.cos(driveFrequency * this.time);
    let externalDriveTorque = 0;
    const driveSign = Math.cos(driveFrequency * this.time);

    // Only add torque if the push direction matches the bell's velocity direction
    if (Math.sign(driveSign) === Math.sign(this.thetaVelocity) || Math.sign(this.thetaVelocity) === 0) {
      externalDriveTorque = driveTorque * driveSign;
    }

    if (Math.abs(this.thetaVelocity) > driveMaxVelocity) {
      externalDriveTorque = 0;
    }

    // Bell Angular Acceleration (d²θ/dt²)
    const thetaAccel =
      (gravityTorque + frictionTorque + externalDriveTorque) / I_bell;

    // Integrate Bell State (Euler-Cromer)
    this.thetaVelocity += thetaAccel * dt;
    this.theta += this.thetaVelocity * dt;

    // ==========================================
    // 2. STEP CLAPPER PHYSICS (COUPLED PENDULUM)
    // ==========================================
    const gravityTerm = (g / clapperEqLength) * Math.sin(this.theta + this.phi);
    const centrifugalTerm =
      (clapperOffset / clapperEqLength) *
      Math.sin(this.phi) *
      Math.pow(this.thetaVelocity, 2);
    const frameAccelTerm =
      (clapperOffset / clapperEqLength) * Math.cos(this.phi) * thetaAccel;

    // Clapper Relative Angular Acceleration (d²φ/dt²)
    const phiAccel = -(
      thetaAccel +
      gravityTerm +
      centrifugalTerm +
      frameAccelTerm
    );

    // Integrate Clapper State
    this.phiVelocity += phiAccel * dt;
    this.phi += this.phiVelocity * dt;

    // ==========================================
    // 3. COLLISION DETECTION & STRIKE IMPACT
    // ==========================================
    console.log
    if (Math.abs(this.phi) >= clapperStrikeAngle) {
      const strikeSide: "left" | "right" = this.phi > 0 ? "right" : "left";

      // Compute relative collision impact speed (rad/s)
      const impactVelocity = Math.abs(this.phiVelocity);

      // Clamp position to bell wall
      this.phi = Math.sign(this.phi) * clapperStrikeAngle;

      // Invert velocity with restitution (rebound/chime strike)
      this.phiVelocity = -this.phiVelocity * clapperRestitution;

      // Fire audio / event callback if attached
      if (this.onStrike) {
        this.onStrike(impactVelocity, strikeSide);
      }
    }

    // Advance time clock
    this.time += dt;

    return this.getState();
  }

  /**
   * Returns complete world positions and rotation states for 3D/2D rendering
   */
  public getState(): SimulationState {
    const { clapperOffset, clapperLength } = this.config;
    const totalAngle = this.theta + this.phi;

    // Global Cartesian positions for the clapper hearth center
    const hearthX =
      clapperOffset * Math.sin(this.theta) +
      clapperLength * Math.sin(totalAngle);
    const hearthY =
      -clapperOffset * Math.cos(this.theta) -
      clapperLength * Math.cos(totalAngle);

    return {
      time: this.time,
      bellAngle: this.theta,
      bellAngularVelocity: this.thetaVelocity,
      clapperAngle: this.phi,
      clapperAngularVelocity: this.phiVelocity,
      clapperWorldPos: { x: hearthX, y: hearthY },
    };
  }
}