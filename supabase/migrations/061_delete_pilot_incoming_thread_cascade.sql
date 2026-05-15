-- Pilot Desk: deleting an incoming Ask Me / Local Friend row must also remove the
-- traveler-side echo + any bandit_reply rows keyed by the same thread root
-- (`reference_id` = thread root id as text). Otherwise the guest Notifications
-- list and badge stay out of sync.

create or replace function public.delete_pilot_incoming_thread_cascade(p_thread_root_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op uuid;
  v_root text;
  n int;
begin
  if not public.is_pilot_operator() then
    raise exception 'only pilot operator can delete incoming threads' using errcode = 'P0001';
  end if;

  v_op := auth.uid();
  v_root := p_thread_root_id::text;

  if not exists (
    select 1
    from public.notifications n
    where n.id = p_thread_root_id
      and n.user_id = v_op
      and n.type in ('local_friend', 'bandit_question')
      and n.reference_type in ('local_friend_request', 'bandit_question_request')
  ) then
    raise exception 'incoming thread not found or not deletable' using errcode = 'P0001';
  end if;

  delete from public.notifications c
  where nullif(btrim(c.reference_id), '') = v_root
    and (
      c.reference_type in (
        'local_friend_guest_echo',
        'bandit_question_guest_echo',
        'operator_reply',
        'operator_reply_local_friend',
        'operator_reply_bandit_question'
      )
      or (
        c.type = 'bandit_reply'
        and c.reference_type in (
          'operator_reply',
          'operator_reply_local_friend',
          'operator_reply_bandit_question'
        )
      )
    );

  delete from public.notifications r
  where r.id = p_thread_root_id
    and r.user_id = v_op
    and r.type in ('local_friend', 'bandit_question')
    and r.reference_type in ('local_friend_request', 'bandit_question_request');
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'incoming thread not found or not deletable' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.delete_pilot_incoming_thread_cascade(uuid) from public;
grant execute on function public.delete_pilot_incoming_thread_cascade(uuid) to authenticated;
