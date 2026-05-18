-- After at least one user has signed in via magic link, flip them to admin
-- with the email you want to use for the demo:
update public.profiles
set role = 'admin', display_name = 'RİH Administrator'
where id = (select id from auth.users where email = 'admin@narpulse.az');

-- Verify:
-- select p.role, u.email from public.profiles p join auth.users u on u.id = p.id;
