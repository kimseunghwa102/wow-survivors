/**
 * Build edition.
 * WORLD_EDITION: false = the Genesis City estate (-106,76); true = the Creator Success test World
 *   (tools/edition.mjs flips this flag and scene.json together; never hand-edit both).
 * REVIEW_BUILD: true while Creator Success reviews the estate — no hold'em casino and no paid gold.
 *   Set it to false and redeploy to bring the casino and the Treasury back.
 */
export const WORLD_EDITION: boolean = false
export const REVIEW_BUILD: boolean = false
/** core game only: no gambling, no paid currency */
export const CORE_ONLY: boolean = WORLD_EDITION || REVIEW_BUILD
