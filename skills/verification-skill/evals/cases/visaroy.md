# Visaroy

Visaroy's verify skill, `verify-visaroy`, was written with `create` in 560808a1 on 2026-10-16, then fixed by hand 21 times. The lessons below are the generic ones, mined from its history on 2026-10-25.

- Repo: dhruvkelawala/visaroy
- Checkout: ~/code/visaroy
- Base: 8ec6495ceffb3bd7659665019e93e83227a8c546

## Lessons

1. Each paid external dependency gets an off and a live mode that doctor prints (9ceb4e23).
2. Flag fixtures with absolute dates (9ceb4e23).
3. Run helpers on GNU and BSD tools (d286d647).
4. Bind to loopback, and have doctor prove it (f7a3336d).
5. Prove recipes on a clean PATH (f7a3336d).
6. Open each capture at full size before calling it proof (800509b7).
7. Reach deep states through a dev-only seed, and say what it skips (305835f0, fc9651e7).
8. Blank build-time public variables too (ec87acbe).
9. Prove the production-build launch separately (daf4aeb1).
10. For each spec, list its mocks, what it asserts and the credentials the test process reads (553a93d1).
11. Name each environment and which ones a run may drive (66a4d9f7).
12. Environment guards fail closed (70479332).
13. Record the revision the target actually serves (e63a07c1).
14. Point at the source instead of copying changing values (edc28879).
15. One unmocked recipe per feature; label mocked ones UI-only (3b722625).
16. Helpers need a fallback when a shared API quota runs out (e1f36c16, 840987fb).
17. Never echo URLs or env values (cf53f164).
18. Route every harness `webServer` and `reuseExistingServer` to the owned instance (4f8b1b23, 13c96fcc).
19. Not fixed in the skill, but recurring: a port per run for parallel verifiers (about 14 PRs, such as #507 and #569), and killing the whole process group (#540, #545, #555, #569).
