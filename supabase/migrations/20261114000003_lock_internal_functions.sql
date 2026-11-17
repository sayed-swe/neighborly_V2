-- Internal trigger/helper functions must not be callable through the public API.
-- Triggers still fire (PostgreSQL checks EXECUTE only when the trigger is created).
revoke execute on function
  public.handle_new_user(), public.protect_profile_fields(), public.protect_moderation_status(),
  public.protect_service_verified(), public.touch_conversation(), public.on_reaction_created(),
  public.on_comment_created(), public.on_post_created(), public.on_alert_created(),
  public.on_help_response_created(), public.on_rsvp_created(), public.actor_name(uuid),
  public.notify(uuid, uuid, public.notification_type, text, text, bigint)
from public, anon, authenticated;
revoke execute on function public.is_admin(), public.is_active_user(), public.is_conversation_member(bigint) from public, anon;
grant execute on function public.is_admin(), public.is_active_user(), public.is_conversation_member(bigint) to authenticated;
