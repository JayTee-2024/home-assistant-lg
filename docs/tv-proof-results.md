# TV proof results

What the proof app showed when it ran on a real TV. Plan 1 built the proof app to answer three questions
before the real app is written: which sign-in route works, whether the build chain produces something the
TV runs, and which codes the remote's keys send.

- **Date:** 23 November 2026
- **TV:** LG OLED65C9PLA (C9), webOS 4.5, firmware 05.50.00, rooted with Homebrew Channel
- **Installed with:** `npm run deploy`
- **Read from the screen by:** Simon, who reported the results in conversation. Lines marked
  "not yet recorded" are still to be filled in.

## Sign-in route: direct

| Test                 | Result  |
| -------------------- | ------- |
| Reach Home Assistant | reached |
| Read sign-in options | reached |
| Start sign-in        | reached |
| Open the live link   | reached |

**Sign-in route: direct.**

"Start sign-in" is the test that decides the route. It sends the same request a desktop browser has
refused by Home Assistant's cross-origin check (HTTP 403). From the installed app on the TV it came back with
the username and password form. So webOS 4.5 does not apply that check to an installed app, and the app can
make the sign-in requests itself. No helper service is needed, and plan 1's Task 6 is not built.

**Limit of this result:** it is proven on webOS 4.5 only. Newer webOS versions use newer browser engines
and have not been tested. If one of them applies the check, sign-in on that TV fails at "Start sign-in" and
the helper service described in the design is the fallback.

## Build chain: works

The package built by `npm run package` installed and started on the TV, and the screen drew and ran its
tests. That covers TypeScript and Preact compiled for Chromium 53, the polyfills, and the flexbox layout.

- Browser engine line: not yet recorded
- CSS grid line: not yet recorded

## Remote keys

| Key                         | Name shown | Code |
| --------------------------- | ---------- | ---- |
| Up, Down, Left, Right       | correct    | not yet recorded |
| OK                          | not yet recorded | |
| Back                        | not yet recorded | |
| Red, Green, Yellow, Blue    | not yet recorded | |
| Channel up and channel down | not yet recorded | |

## Found while testing

- **The TV does not move focus by itself.** On the first version of the proof screen, Left and Right did
  nothing on the "Run tests" button, although the address box sat directly to its left. The proof screen
  only handled Up and Down, and the TV's browser did not fill the gap. So every focus move in the real app
  has to be made by the app, which is what the design already plans. The proof screen was fixed so Left and
  Right move along its row of controls.
- **The TV's install command needs its input closed.** Over SSH without a terminal, `luna-send` prints
  nothing and reports success unless it is run with `< /dev/null`. `scripts/lib/tv-commands.mjs` adds that,
  and a test pins it.
- **The TV's own Node is version 0.12.2**, not version 8. It does not matter now that no helper service is
  built. If one is ever needed, it has to be written in the JavaScript of 2011 (ES5).

## Still to check

- The "Last key" line for OK, Back, the four colour keys, and channel up and down.
- Whether the on-screen keyboard appeared for the address box and could type a full address.
- Whether "Close app" leaves the app completely.
