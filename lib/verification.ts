export function verificationBlockReason(
  p: { status: string; author_id: number | null },
  user: { id: number; is_admin: number } | null,
  verify: boolean
): string | null {
  if (!user || !user.is_admin) return "Only admins can change verification.";
  if (user.id === p.author_id) return "You can't change verification on your own plugin — another admin must.";
  if (verify && p.status !== "approved") return "Only published plugins can be verified.";
  return null;
}
