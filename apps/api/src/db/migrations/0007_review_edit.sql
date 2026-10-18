alter table core.moderation_actions
  drop constraint if exists moderation_actions_action_check;

alter table core.moderation_actions
  add constraint moderation_actions_action_check
  check (
    action in (
      'submit',
      'edit',
      'approve',
      'reject',
      'hide',
      'withdraw',
      'report_dismiss',
      'appeal_uphold',
      'appeal_restore'
    )
  );
