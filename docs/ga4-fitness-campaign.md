# GA4 fitness campaign funnel

The canonical campaign landing is `/landing/entrenadores`. The legacy
`/landing/entrenadorV51` route is reported with the same canonical path so GA4
does not split the audience between two URLs.

## Public landing events

| Event | Meaning | Important parameters |
| --- | --- | --- |
| `page_view` | Canonical landing view | `landing_variant`, `audience`, `plan`, `billing_cycle`, `trial_days` |
| `landing_section_view` | First meaningful view of a section | `section` |
| `landing_cta_click` | Trial CTA selected | `cta_location` |
| `landing_demo_click` | Public demo opened | `location` |
| `select_content` | Profile template selected | `content_type`, `item_id`, `location` |
| `landing_faq_open` | FAQ answer opened | `question` |
| `landing_nav_click` | Header navigation used | `section` |

`signup_started` is intentionally not emitted by the landing CTA. The admin
emits it only when the visitor actually interacts with the sign-up form.

The landing preserves `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`,
`utm_content`, `gclid`, `gbraid`, and `wbraid` in the safe GA page location and
in the admin sign-up URL. Arbitrary query parameters, aliases, chat content,
profile names, and contact data are not sent to GA.

## GA4 configuration

Mark `trial_started` as the primary campaign key event. Keep `sign_up` and
`begin_checkout` as secondary key events for diagnosis. Import
`trial_started` into Google Ads when the campaign is ready, and import
`purchase` separately once paid conversions have enough volume.

Create event-scoped custom dimensions for `app_surface`, `landing_variant`,
`audience`, `plan`, `billing_cycle`, `cta_location`, `section`, and
`checkout_origin`. Do not create custom dimensions for click IDs or transaction
IDs because they are high-cardinality values.

The recommended exploration funnel is:

1. `page_view` filtered to `/landing/entrenadores`
2. `landing_cta_click`
3. `signup_started`
4. `sign_up`
5. `email_verified`
6. `begin_checkout`
7. `add_payment_info`
8. `trial_started`
9. `profile_created`
10. `profile_published`
11. `chat_started`
12. `purchase`

The first-party activation report in the Bigmelo admin remains the source of
truth for authoritative onboarding milestones and campaign cohorts.
