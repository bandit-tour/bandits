-- Real why_follow copy for Neo (bullet lines; app renders each line as a bullet).
update public.bandit
set why_follow = E'• Knows hidden record stores, flea market corners, and low-key music spots.\n• Curates routes with soul, not generic tourist stops.\n• Best for travelers who want vintage, jazz, and underground local energy.'
where lower(name) like 'neo%';
