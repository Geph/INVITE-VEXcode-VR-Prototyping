# Rover Rescue spec

Single source of truth for Rover Rescue constants. Later phases import these numbers from `playgrounds/rover-rescue/config.ts` and `map-spec.ts`. They do not invent new ones.

Sources: VEXcode VR Rover Rescue Documentation (28 Aug 2025) pp. 33–36, 39–52; [field details](https://api.vex.com/vr/home/playgrounds/rover_rescue/field_details.html); [robot-specific blocks](https://api.vex.com/vr/home/robots/rover/robot_specific_blocks.html). Zone polygons, river centreline, and bridge pads were pixel-traced from the reference map — **draft, not ground truth**. Phase 4 includes a debug overlay to drag vertices and re-export.

Official names: playground **Rover Rescue**, robot **VR Rover**. The current picker label “Rescue Rover” / id `rescue-rover` is the same playground.

## Field

| Constant | Value |
| --- | --- |
| Field | 12000 mm (X) × 6000 mm (Y) |
| X range | −6000 … +6000 (west → east) |
| Y range | −3000 … +3000 (south → north; canvas Y is inverted at render time only) |
| Origin (0, 0) | Centre of the playable rectangle, near the river in Zone A |
| Grid | 500 mm squares → 24 × 12 cells |
| Base (nominal) | (−6000, −3000), SW corner |
| Base pad (drawn) | ≈ (−5750, −2650) |
| Rover start | At the Base |
| Rover size | 191 mm long × 147 mm wide |
| Heading | 0–359.9°, clockwise positive, 0° = North |

The host camera is **pan + zoom** with a follow-rover mode. Pose is stored in world millimetres. Pixels exist only in `engine/camera.ts` and render functions.

## Zones

Each zone changes which enemies spawn and whether minerals respawn. Enemy strength also scales with distance from the Base, independently of zone.

| Zone | Colour on ref map | Enemies | Mineral respawn |
| --- | --- | --- | --- |
| A | blue | Alien Spiders | never |
| B | grey | Alien Spiders | never |
| C | orange | Spiders + orange Serpents | yes |
| D | red | Spiders + blue Serpents | more frequent |
| E | purple | Spiders + purple Serpents | most frequent |

Minerals appear in every zone. They respawn indefinitely only in C, D, and E.

Zone polygons — traced draft. World mm, +Y = north. Paint in this order (later wins on overlap):

```ts
ZONE_B_WEST: [[-6000,-2800],[-6000,1000],[-4200,1100],[-3000,600],[-1400,-500],
              [-3000,-1200],[-4600,-1700],[-6000,-1950]]
ZONE_B_EAST: [[1500,-3000],[5900,-3000],[5900,300],[2000,300],[1200,-1900]]
ZONE_A:      [[-5930,-2790],[-5930,-1960],[-4620,-1700],[-3020,-1170],[-1420,-490],
              [-40,220],[620,120],[840,-1240],[690,-2380],[470,-2790]]
ZONE_C:      [[-2440,3000],[3530,3000],[3530,480],[5850,480],[5850,-1240],
              [2070,-1240],[2070,620],[-2440,480]]
ZONE_D:      [[2900,480],[6000,480],[6000,3000],[2900,3000]]
ZONE_E:      [[4250,1700],[6000,1700],[6000,3000],[4250,3000]]
```

## River and bridges

The river is impassable — entering it ends the mission. It enters from the northwest, runs east across the north of the map, turns south around X ≈ +900, and exits to the southeast. Width ≈ 700–900 mm.

```ts
RIVER_CENTERLINE: [[-6000,1410],[-4760,1200],[-3310,980],[-2000,1200],[-840,980],
                   [330,770],[910,190],[1060,-950],[1200,-1950],[1490,-2670],[2200,-3000]]
RIVER_WIDTH_MM: 800

BRIDGES: [
  { id: "north", centre: [-3500, 1240], orientation: "NS", widthMm: 700, lengthMm: 1400 },
  { id: "south", centre: [ 1130,-1880], orientation: "EW", widthMm: 700, lengthMm: 1400 },
]
```

Bridge decks are walkable strips that punch a hole in the river's hazard polygon. `go to` must route through them.

## Economy, levels, and combat

| Event | Effect |
| --- | --- |
| Use a mineral (on the ground; cargo cannot be used) | +2 XP, battery → 100% |
| Return a mineral to Base | +5 XP per mineral |
| Neutralize Alien Spider | +5 XP |
| Neutralize orange or blue Serpent | +10 XP |
| Neutralize purple Serpent | +15 XP |
| Absorb radiation | + (absorb % × enemy radiation); neutralize that enemy |

| Level | XP threshold |
| --- | --- |
| L1 | 0 |
| L2 | 10 |
| L3 | 30 |
| L4 | 70 |
| L5 | 125 |

| Starting stats | Value |
| --- | --- |
| Absorb | 10% |
| Capacity | 2 minerals |
| Battery | 100% |

Per-level growth (not published by VEX — suggested, tune in playtest):

| Level | Absorb | Capacity |
| --- | --- | --- |
| 1 | 10% | 2 |
| 2 | 20% | 3 |
| 3 | 35% | 4 |
| 4 | 55% | 6 |
| 5 | 80% | 8 |

`exp` is XP at the current level, not lifetime XP.

## Battery, standby, and mission

| Rule | Value |
| --- | --- |
| Battery | Drains continuously with time and movement. 0% → mission over |
| Use mineral | Battery → 100% instantly |
| Absorb | Battery += absorb% × enemy radiation |
| Standby | Fast-forwards the clock (`tick` without render) until battery **falls to** the given %. If the threshold ≥ current battery, do not enter standby |
| Mission length | 50 in-game days, then a dialog: Continue / View Statistics / Get Certificate |
| Continue | Re-irradiates every previously neutralized enemy |

Ocean Reef's 180 s battery (`CORAL_REEF_BATTERY_SEC`) does not apply here. Active drain % per second is unpublished; tune in playtest so 50 days is reachable with standby and mineral use.

## Sensing

| Sensor | Range | Shape | Reports |
| --- | --- | --- | --- |
| AI detect | 800 mm | 360° circle | minerals and enemies only; boolean |
| AI sight (`sees`) | 1000 mm | 40° forward cone | minerals, enemies, obstacles, hazards, Base — name + distance + angle; enemies also level and health points |
| Distance | 2000 mm max | Forward ray | `found_object`, `object distance` |
| Location | — | — | rover (X, Y) in mm; also selected object when in sight (Base always) |

Base direction, distance, and location are always available, even outside the 40° cone. Mineral / enemy attributes require the 1000 mm cone. Obstacle / hazard distance: if none in view, official API returns 1000 mm (39.37 in). `enemy_level` / `enemy_radiation` return 0 when no enemy is in the detect radius.

The Ocean Reef half-plane (`nearestTrashInFrontMm`) is not this sensor model.

## Blocks — 1:1 with VEX

Bold = new work. The rest already exist in some form in `vex-workspace.tsx`. Shared Logic / Operators / Console / Control stay. Magnet and Coral Reef eye / bumper blocks are not in this playground.

### Drivetrain — actions

drive [forward] · drive [forward] for (200) [mm] · turn [right] · turn [right] for (90) degrees · turn to heading (90) degrees · stop driving · **go to [minerals▾]** (minerals / enemy / base)

`go to` pathfinds around obstacles and over bridges. Closest mineral or enemy if several. No-op if the target is not in visual range, except Base, which is always valid. Python also has `drive_to` / `turn_to` / `go_to`.

### Drivetrain — settings

set drive velocity (50) [%] · set turn velocity (50) [%] · set drive heading (0) degrees · set drive timeout (1) seconds

Default drive and turn velocity is 50%. Heading is 0–359.9°, clockwise, 0° = North.

### Drivetrain — values

drive is done? · drive is moving? · drive heading

### Minerals and resources

**minerals action [pick up▾]** (pick up / drop / use) · **absorb radiation** · **standby until (50) % battery**

Pick up / drop / use are non-waiting. Standby is waiting.

### Rover sensing — values

**rover sees [minerals▾]?** · **rover detects [minerals▾]?** · **minerals in storage** · **storage capacity** · **rover direction [minerals▾]** · **rover distance [minerals▾] in [mm]** · **rover location [minerals▾] [X▾]** · **under attack?** · **enemy level** · **enemy radiation** · **battery level** · **level** · **XP**

### Rover events (hat blocks)

**when under attack** · **when level up**

### Distance sensor

distance found object? · object distance in [mm]

## Unpublished / tune in playtest

Do not block Phase 4 on these. Use the suggested values above and the draft polygons; measure from official VEXcode VR when it matters.

- Active battery drain (% per second, idle vs moving)
- In-game day length in real milliseconds
- Obstacle positions and radii
- Initial mineral count and spawn table
- Pickup / use / absorb ranges (mm)
- Attack damage, attack range, enemy radiation starting values, enemy HP
- Whether `use` consumes one mineral or every mineral in range

## Out of scope for this playground

- Coral Reef trash, eye sensors, bumpers, and the 2000 mm reef field
- Castle Crashers (still unavailable)
- Changing Ocean Reef timing constants (`DRIVE_MS_PER_MM_AT_50`, `TURN_MS_PER_DEGREE_AT_50`) to “feel more like the rover”
