# Loading indicator preview

Standalone design review, before changing the Angular application. From the repository root:

```sh
python3 -m http.server 4300 --directory docs/previews/loading-indicator
```

Open <http://localhost:4300>. The preview uses no CDN or runtime dependencies.

- Seven normalized Material shapes in the AndroidX order: SoftBurst, Cookie9Sided, Pentagon,
  Pill, Sunny, Cookie4Sided, Oval, then back to SoftBurst.
- Matched cubic Bézier segments, generated with `material-shapes-ts@0.3.0`, the Apache-2.0
  TypeScript port of AndroidX Graphics Shapes. The seven definitions were compared with
  AndroidX `MaterialShapes.kt`; the preview interpolates paired cubic control points.
- AndroidX motion parameters: a unit-mass spring, stiffness 200, damping ratio 0.6, morph
  interval 650 ms, a spring-driven quarter-turn and global 360-degree rotation in 4666 ms.
  The preview samples the analytical spring; AndroidX uses its animation engine and a settling
  threshold. This is a web approximation of its timing, not a pixel-equivalence claim.
- The current portal's 48 px circular container and 38 px nominal active size, with uniform
  rotation-safe scaling calculated from the shapes' maximum bounds. Colours come from
  `frontend/src/app/core/theme/generated-colors.ts`.
- For a simulated request the indicator is absent through 200 ms, removed immediately on
  completion and reset on restart. Completion wins when it coincides with the threshold.
- Reduced motion holds the initial shape, without rotation, morphing or pulsing. The checkbox
  follows the system preference and permits inspection of that state.

The enlarged sample, speed control and permanent animation are review aids. They are not product
behaviour. The approved motion is implemented by `frontend/src/app/shared/ui/loading-indicator.ts`.
Rebuild its geometry with `node frontend/scripts/loading-geometry.mjs`, then format the output.

Sources:

- [Material 3 guidelines](https://m3.material.io/components/loading-indicator/guidelines)
- [AndroidX LoadingIndicator](https://github.com/androidx/androidx/blob/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/LoadingIndicator.kt)
- [AndroidX MaterialShapes](https://github.com/androidx/androidx/blob/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/MaterialShapes.kt)
- [TypeScript geometry port](https://github.com/ruanspies/material-shapes-ts)
