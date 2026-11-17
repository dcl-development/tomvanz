/**
 * DJI drones name every photo `DJI_####.JPG`, and the DJI Fly app's exports start with
 * `dji_fly_`. Both begin with `dji_`, which is how drone photos are spotted automatically.
 * (The same rule is written in GROQ in the site query and the Studio's Drone photos list.)
 */
export function isDroneFileName(fileName: string | null | undefined): boolean {
  return /^dji_/i.test(fileName ?? '')
}

/** A hand-set value wins; otherwise fall back to what the file name says. */
export function effectiveDrone(manual: boolean | null | undefined, fileName: string | null | undefined): boolean {
  return manual ?? isDroneFileName(fileName)
}
