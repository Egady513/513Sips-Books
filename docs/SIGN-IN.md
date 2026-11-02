# Books sign-in

## Create your user

1. Open Supabase, then go to Authentication and Users.
2. Select Add user.
3. Enter `contact@513sips.com`, choose your own password and turn on auto-confirm.
4. Under Authentication settings, turn off **Allow new users to sign up**.

Nobody else needs your password. Do not put it in GitHub, the app settings or a message to an agent.

## Test before requiring sign-in

Merge and deploy the app first. Open Books, then go to Settings and Account. Sign in there while the requirement is off. This confirms your user works without blocking access to Books.

## Turn the requirement on or off

To turn it on, open the GitHub repository Settings, then Variables. Create `VITE_REQUIRE_LOGIN` with the value `true`, then re-run the Deploy workflow.

To turn it off again, set `VITE_REQUIRE_LOGIN` to `false`, then re-run the Deploy workflow.

`VITE_BOOKS_ALLOWED_EMAILS` is optional. When it is empty or missing, Books allows `contact@513sips.com`.

## What this does not do yet

The data is still readable with the public key until the database rules change in a later step. This sign-in is a gate on the screen. It is not yet a lock on the data.
