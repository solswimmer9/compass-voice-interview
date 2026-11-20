# Roadmap

- [x] Build school bundle checkout, shared-code claims, teacher balances, and refund-safe student credits.
- [x] Verify signed-in school claims, balance updates, refund revocation, refunded-code rejection, school checkout rendering and mobile layout; keep existing tester access unchanged.
- [ ] Publish school checkout and sync the school product to live — waits for Solomon to publish; a completed school payment remains unverified.

- [x] Replace the legal seller placeholder with the approved name Solomon Allen and check the public policy pages.
- [x] Voice geography interview MVP with transcript replay
- [x] Calmer, narrator-style voice
- [x] ElevenLabs natural British voice for the live two-way interview
- [x] AI assessment of interview replay
- [x] Optional video upload for assessment
- [x] Enable built-in payments with Paddle (chosen after the eligibility check)
- [x] Choose the £20 two-interview pack, free allowance, and no-subscription rules with Solomon
- [x] Add the £20 pack and £100 lifetime access to the payment provider
- [x] Build checkout, customer accounts, profiles, and interview/feedback allowance logic
- [ ] Verify a signed-in test purchase, automatic credit, full refund, and credit revocation end to end — blocked: Stripe's automated card submission stalled twice; manual checkout needed
- [x] Verify both test/live prices, webhook secrets, signed-webhook rejection, and 19 payment/access rule checks
- [x] Add missing refund and dispute notifications to the app's test and live Stripe webhooks and confirm both subscriptions
- [x] Explain how checkout, refunds, and interview entitlements work, including the manual test steps
- [x] Allow unlimited preview testing while preserving published-site allowances
- [x] Restore the interview used by the failed 13:49 connection and refund future failed voice starts automatically
- [x] Recognize the current live-preview host for unlimited testing
- [x] Replace ElevenLabs interviews with a natural Lovable live voice and verify a real voice session
- [ ] Verify audible two-way playback in a real browser — blocked: the sandbox browser produces no WebRTC audio candidates; Lovable session creation and final usage are verified
- [x] Switch payments to Stripe after the previous provider rejected AI products; recreate £20 pack and £100 lifetime products
- [x] Claim the Stripe account and complete live-payment setup in the Payments tab
- [x] Rename PPE tutor to Prof Matt
- [x] Give Prof Matt a separate Live voice while preserving Dr River's voice; verify tutor-specific startup payloads.
- [x] Speed up the interview connection: tutor starts speaking about a second sooner after audio connects.
- [x] Make Dr River (geography) sharper at testing assumptions hidden in students' answers.

## Bug fixes from tester sweep (19 Nov 2026)
- [x] Students can no longer restore their own interview credits (server-only refund)
- [x] Test-mode payments and interviews limited to tester accounts
- [x] Early refund/dispute notices still revoke the purchase when it arrives
- [x] Credit returned when a student leaves while the interview is starting
- [x] One claim per student per school code
- [x] Guests get the two free tries the app promises (database rule)
- [x] Chart timing survives reconnects (no late or repeat chart)
- [x] "Connecting" can no longer hang forever
- [x] Interview record stays in spoken order
- [x] School tax and tutor wording consistent with terms
- [x] Reset-password sign-in link, sign-up title/stale message, not-found page title
- [x] Update dependencies with security warnings (critical fixed; remaining are build/dev tools and a major zod upgrade)
- [x] Video feedback format/size checks; update stale tests
- [ ] Publish so the live site gets these fixes — waits for Solomon

## First ad campaign (19 Nov 2026)
- [x] Save goal (start a free interview) and audiences (applicants, parents, teachers/tutors) to the campaign plan
- [x] Locations: United Kingdom, English (default after question skipped)
- [x] Campaign put on hold: Solomon doesn't want to run ads right now (budget, research and channel choice resume only if he asks)

## Site
- [x] Remove Solomon's name from the footer on every page
- [x] Keep Solomon's name on the policy pages (default after question skipped; UK selling rules expect the seller's name)
