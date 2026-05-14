-- Optional: clean Windows-1252 / Latin-1 style mojibake in `recommendation_place` when present.
-- UTF-8 file. Inner replaces run first (ellipsis, â€", quotes) before bare â€ + euro pair.
-- Skips entirely if the table or any of the four columns is missing.

do $migration$
begin
  if to_regclass('public.recommendation_place') is null then
    raise notice '057: skip — public.recommendation_place does not exist';
    return;
  end if;

  if (
    select count(*)::int
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recommendation_place'
      and column_name in (
        'description',
        'why_recommended',
        'bandit_tip',
        'opening_hours_text'
      )
  ) < 4 then
    raise notice '057: skip — recommendation_place missing expected text columns';
    return;
  end if;

  update public.recommendation_place
  set
    description = replace(replace(replace(replace(replace(replace(replace(coalesce(description, ''), $a$â€¦$a$, U&'\2026'), $b$â€"$b$, U&'\2014'), $c$â€œ$c$, chr(34)), $d$â€$d$, chr(34)), $e$â€“$e$, U&'\2013'), $f$â€™$f$, chr(39)), $g$â€$g$, U&'\2014'),
    why_recommended = replace(replace(replace(replace(replace(replace(replace(coalesce(why_recommended, ''), $a$â€¦$a$, U&'\2026'), $b$â€"$b$, U&'\2014'), $c$â€œ$c$, chr(34)), $d$â€$d$, chr(34)), $e$â€“$e$, U&'\2013'), $f$â€™$f$, chr(39)), $g$â€$g$, U&'\2014'),
    bandit_tip = replace(replace(replace(replace(replace(replace(replace(coalesce(bandit_tip, ''), $a$â€¦$a$, U&'\2026'), $b$â€"$b$, U&'\2014'), $c$â€œ$c$, chr(34)), $d$â€$d$, chr(34)), $e$â€“$e$, U&'\2013'), $f$â€™$f$, chr(39)), $g$â€$g$, U&'\2014'),
    opening_hours_text = replace(replace(replace(replace(replace(replace(replace(coalesce(opening_hours_text, ''), $a$â€¦$a$, U&'\2026'), $b$â€"$b$, U&'\2014'), $c$â€œ$c$, chr(34)), $d$â€$d$, chr(34)), $e$â€“$e$, U&'\2013'), $f$â€™$f$, chr(39)), $g$â€$g$, U&'\2014')
  where
    (description is not null and description like '%â%')
    or (why_recommended is not null and why_recommended like '%â%')
    or (bandit_tip is not null and bandit_tip like '%â%')
    or (opening_hours_text is not null and opening_hours_text like '%â%');
end $migration$;
