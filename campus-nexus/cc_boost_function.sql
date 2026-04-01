-- Atomic CC spend + boost in one transaction
create or replace function public.boost_listing_with_cc(
  p_user uuid,
  p_listing uuid,
  p_cost integer default 20
)
returns table(success boolean, remaining_cc integer)
language plpgsql
as $$
declare
  new_cc integer;
begin
  update public.profiles
  set cc_points = cc_points - p_cost
  where id = p_user
    and cc_points >= p_cost
  returning cc_points into new_cc;

  if not found then
    return query select false, null::integer;
    return;
  end if;

  update public.listings
  set is_featured = true, is_bumped = true, updated_at = now()
  where id = p_listing
    and seller_id = p_user;

  return query select true, new_cc;
end;
$$;

grant execute on function public.boost_listing_with_cc(uuid, uuid, integer) to anon, authenticated;
