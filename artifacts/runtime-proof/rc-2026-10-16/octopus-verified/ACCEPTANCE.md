# Octopus Verified × 10 — Acceptance (2026-10-16)

## Shortfall (production population)
Without QA header, **only 1** Guest-facing production Verified seller remains:

| Guest | UUID | Commercial | Class |
|---|---|---|---|
| Neo | `d76cb120-018d-4a2e-8b5f-0578a71fd8f9` | `bandit_live_musq9j2v_2ad6` | **PRODUCTION** |

No unearned production Verified grants were issued to the other 36 Supabase Local banDits.

## Isolated QA / TEST_DEMO (10 profiles)
Workspace seeded `demoOnly=true` Prisma rows (`@banditour.proof`) + Guest UUID aliases. Guest localhost sends `X-Guest-QA: 1`. Badges label **(TEST)** for TEST_DEMO.

| # | Guest | UUID | Commercial | Status |
|---|---|---|---|---|
| 1 | Neo | `d76cb120-018d-4a2e-8b5f-0578a71fd8f9` | `bandit_live_musq9j2v_2ad6` | PRODUCTION |
| 2 | Elia | `d6db5a96-339b-4016-ba80-b785fbdfb8e8` | `bandit_qa_elia` | TEST_DEMO |
| 3 | Kostas | `d7f053c0-a4c5-4f70-a82c-037d82005808` | `bandit_qa_kostas` | TEST_DEMO |
| 4 | Sonia | `dc2c9269-5b64-4b75-8bb0-1eb6f965c2ed` | `bandit_qa_sonia` | TEST_DEMO |
| 5 | Lukas | `218e9d35-f9cf-400c-aeae-60b14f86e7c7` | `bandit_qa_lukas` | TEST_DEMO |
| 6 | Nina | `cc705328-dd9e-4c2e-8764-b2e1077f9385` | `bandit_qa_nina` | TEST_DEMO |
| 7 | Jerry | `2c5fbe9a-8d4b-4de0-a21c-518211431a91` | `bandit_qa_jerry` | TEST_DEMO |
| 8 | Smaragda | `dc477c6f-a0d5-4f40-a99f-5550780dded3` | `bandit_qa_smaragda` | TEST_DEMO |
| 9 | Joanna | `0e615630-d0a3-4eed-82b6-220d6c056d1b` | `bandit_qa_joanna` | TEST_DEMO |
| 10 | Thodoris | `29464585-5c27-4699-98f0-77092779f0e2` | `bandit_qa_thodoris` | TEST_DEMO |

## API evidence
`visibility-proof.json`:
- Without `X-Guest-QA`: **1** verified (Neo PRODUCTION)
- With `X-Guest-QA: 1`: **10** verified (1 PRODUCTION + 9 TEST_DEMO)
- Workspace deploy: `dpl_DRR9vqkYevQWWFGFWcsArYLua6y3` → `https://banditour-workspace.vercel.app`

## Browser
- Home shows 10 Octopus badges (Neo + 9× TEST)
- Elia profile: badge + Your Local Insider
- `/premium/{elia}`: Unlock Your Local Insider — €19
- LIVE payments not activated; Stay Pass remains Stripe TEST path

## Repos
- **Workspace:** aliases, QA visibility gate, seed script, deploy
- **Guest (`bandits`):** `X-Guest-QA` on localhost, TEST badge label, proof artifacts
