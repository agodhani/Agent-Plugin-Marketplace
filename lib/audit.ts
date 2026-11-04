import { getDb } from "./db";
import { now } from "./utils";

export function audit(
  actor: { id: number; name: string } | null,
  action: string,
  entityType: string,
  entityId: number | null,
  entityName: string,
  details: Record<string, unknown> = {}
) {
  getDb()
    .prepare(
      `INSERT INTO audit_log (actor_id, actor_name, action, entity_type, entity_id, entity_name, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(actor?.id ?? null, actor?.name ?? "system", action, entityType, entityId, entityName, JSON.stringify(details), now());
}

export function describeAudit(action: string): string {
  const map: Record<string, string> = {
    plugin_submitted: "submitted for review",
    version_submitted: "submitted a new version",
    submission_approved: "approved a submission",
    submission_rejected: "rejected a submission",
    version_published: "published a version",
    team_usage_added: "marked as used by a team",
    team_usage_removed: "removed team usage",
    downloaded: "downloaded",
    plugin_updated: "updated plugin details",
    team_created: "created a team",
    admin_toggled: "changed admin status",
    admin_granted: "granted admin access",
    plugin_verified: "verified the plugin",
    plugin_unverified: "removed the plugin's verification",
    playbook_created: "created a playbook",
    playbook_updated: "updated a playbook",
    playbook_deleted: "deleted a playbook",
    playbook_item_added: "added a plugin to a playbook",
    playbook_item_removed: "removed a plugin from a playbook",
    review_posted: "posted a review",
    user_registered: "registered an account",
    token_created: "created an access token",
    token_revoked: "revoked an access token",
  };
  return map[action] ?? action.replaceAll("_", " ");
}
