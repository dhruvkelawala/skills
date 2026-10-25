Sharing a photo used to open the capture card on a blank polaroid: the frame and its label came up first, and the picture filled in a beat later. The card now holds back until the picture is ready, so the polaroid arrives with it inside. Closes #12.

## Evidence

The polaroid's first frame on screen:

| Before | After |
| --- | --- |
| ![A half-faded polaroid frame with nothing inside it](https://files.example.com/fixture/polaroid-first-frame-base.png) | ![A half-faded polaroid frame already holding the shared picture](https://files.example.com/fixture/polaroid-first-frame-head.png) |

**Proof:** Tried on an iPhone simulator with made-up data, and by hand on a phone with a release build. The share test now records the opening and fails if the first polaroid frame is blank; it passes twice in a row. Portrait screenshots and landscape photos keep their layout, and the poster that reuses the picture window renders identically. `pnpm check` passes.

Reviewed: two `/code-review` passes and an autoreview, with the findings below.

**Not checked:**

- The next iOS release, and Reduce Motion.
- How fast it feels in a release build, beyond a look on the phone.

**Door:** two-way. Reverting brings the blank polaroid back, and no data changes shape.

**Blast radius:** share extension. Should the picture never finish loading, the card would stay hidden. A picture that fails to load gets the poster's error window instead.

<details>
<summary>Frames, criteria, verification and review trail</summary>

### Frames

Consecutive frames of the card opening on the base, where the polaroid is empty for part of its entrance:

![Consecutive frames of the card opening on the base, two of them with an empty polaroid](https://files.example.com/fixture/opening-strip-base.png)

The same strip with this change, with the picture in place from the start:

![Consecutive frames of the card opening with this change, each polaroid holding the picture](https://files.example.com/fixture/opening-strip-head.png)

### Criteria

| Criterion | Commit | Test | Evidence |
| --- | --- | --- | --- |
| The polaroid never shows empty | `a1b2c3d`, `b2c3d4e` | card unit test; share e2e | [first frame](https://files.example.com/fixture/polaroid-first-frame-head.png), [strip](https://files.example.com/fixture/opening-strip-head.png) |
| Portrait and landscape pictures keep their layout | `a1b2c3d` | layout unit test | [landscape at rest](https://files.example.com/fixture/landscape-at-rest.png) |
| The card doesn't shift when the picture lands | `a1b2c3d`, `b2c3d4e` | fixed window height; card drawn once complete | [strip](https://files.example.com/fixture/opening-strip-head.png) |
| The share e2e catches a blank first polaroid | `c3d4e5f` | share e2e | red and green runs below |
| The poster's picture window is unchanged | `a1b2c3d` | existing poster tests | [poster, base and head](https://files.example.com/fixture/poster-base-and-head.png) |

```text
e2e    red    expected the first polaroid frame to show the picture
       green  share e2e: 2 passed
unit   red    expected the card to wait for its picture
       green  card tests: all passed
```

### Verification

Captured at `d4e5f6a`. Run at `e5f6a7b` against base `f6a7b8c`. After a rebase on `main`, the share e2e passed again at `0a1b2c3`.

| Check | Command | Result |
| --- | --- | --- |
| Lint, format, typecheck, tests | `pnpm check` | passed |
| Share e2e | the share e2e, twice | passed 2/2 |
| Other share e2e suites | three suites, twice each | passed |
| Next iOS simulator | none | not run |
| Reduce Motion | none | not captured |

### Review trail

- `/code-review` pass 1 at `1b2c3d4`: one P1 fixed in `d4e5f6a`, a card test that stayed green with the hold removed.
- Autoreview, tree `2c3d4e5`: clean.
- `/code-review` pass 2: two P3s fixed.
- A phone test of the first build showed the caption before the picture, so `9a8b7c6` holds the whole card instead of only the polaroid.
- Not re-reviewed: `e5f6a7b`, `9a8b7c6`.
- Follow-ups, P2 and lower: the decode's failure path is covered only by the e2e.
- Open question: what a picture that can't load should show. The owner decides.

</details>
