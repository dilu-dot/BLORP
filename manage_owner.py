"""One-time local owner bootstrap. Never expose this command as a public API.

Usage (server stopped): python manage_owner.py your-existing-account@example.com
"""
import sys
from server import init_db, database


def main():
    if len(sys.argv) != 2 or '@' not in sys.argv[1]:
        raise SystemExit('Usage: python manage_owner.py your-existing-account@example.com')
    email=sys.argv[1].strip().lower()
    init_db()
    with database() as conn:
        row=conn.execute('SELECT id,role FROM users WHERE email=?',(email,)).fetchone()
        if not row:
            raise SystemExit('No such account. Sign up first, then run this locally.')
        if row['role']=='owner':
            print('This account already has owner access.')
            return
        conn.execute("UPDATE users SET role='owner' WHERE id=?",(row['id'],))
    print('Owner access granted to existing account:', email)
    print('Restart Blorp and sign in again. Never expose owner controls on a public API.')


if __name__=='__main__':
    main()
