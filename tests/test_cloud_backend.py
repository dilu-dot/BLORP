from pathlib import Path
p=Path(__file__).resolve().parents[1]
sql=(p/'supabase/migrations/20261117120000_blorp_membership.sql').read_text()
edge=(p/'supabase/functions/blorp-membership/index.ts').read_text()
for tab in ('blorp_memberships','blorp_payment_requests','blorp_owner_accounts','blorp_payment_audit','blorp_plan_prices','blorp_payment_config'):
    assert 'create table if not exists public.'+tab in sql
    assert 'alter table public.'+tab+' enable row level security' in sql
assert 'revoke execute on function public.blorp_approve_payment' in sql
assert 'from anon, authenticated' in sql
assert 'for update' in sql
assert 'blorp_chats' not in sql and 'blorp_projects' not in sql
assert 'identity.auth.getUser(match[1])' in edge
assert 'if(!isOwner) return bad("Owner access required",403)' in edge
assert 'statement_confirmed' in edge
print("Blorp cloud backend source checks passed")
