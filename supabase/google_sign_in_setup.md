# Enable Google sign-in for EcoGuard

The app uses the existing Supabase URL and publishable key. Google credentials belong only in the Supabase dashboard. No additional frontend secrets or packages are needed.

## 1. Find the Supabase callback

Open your project in Supabase → Authentication → Sign In / Providers → Google (some dashboard versions label this Providers). Copy the callback URL shown there, typically `https://<project-ref>.supabase.co/auth/v1/callback`.

## 2. Configure Google Cloud

1. Open https://console.cloud.google.com/ and select or create a project.
2. Open Google Auth Platform. If prompted, click Get started. Under Branding, enter EcoGuard as the app name, your support email, and developer contact email.
3. Under Audience, select External for public users. While in Testing, add the Google accounts you will use under Test users. Publish the app when ready for public access and complete any verification Google requests.
4. Under Data Access, include `openid`, `https://www.googleapis.com/auth/userinfo.email`, and `https://www.googleapis.com/auth/userinfo.profile`.
5. Under Clients, create an OAuth client with application type Web application and a name such as EcoGuard Web.
6. Add Authorized JavaScript origins: `http://localhost:5173` for the default Vite development server and your actual production origin, for example `https://your-domain.com`. Use your actual port if Vite starts on another one.
7. Add the exact Supabase callback from step 1 under Authorized redirect URIs. This points to Supabase, including when the frontend runs on localhost against a hosted Supabase project.
8. Create the client and copy its Client ID and Client Secret.

## 3. Enable the Supabase provider

Return to Authentication → Sign In / Providers → Google. Enable Google, paste the Client ID and Client Secret, and save. Keep nonce checks enabled. Keep any option allowing users without an email disabled. In Authentication settings, ensure new user sign-ups are allowed if you want Google registration.

## 4. Allow the app's return URLs

Under Authentication → URL Configuration, set Site URL to your production origin (or `http://localhost:5173` during development). Add these Redirect URLs individually:

```text
http://localhost:5173/auth/callback
http://localhost:5173/auth/callback?application=location_admin
https://your-domain.com/auth/callback
https://your-domain.com/auth/callback?application=location_admin
```

Replace the example domain and port with your actual values. Keep your existing password-reset redirect entries. Configure your production host to serve the React application for `/auth/callback`, just like other client-side routes.

## 5. Check the integration

Run the frontend and backend. Visit `/register`, choose Tourist, and click Continue with Google using a new test account. Verify the tourist dashboard opens and Authentication → Users and the `profiles` table contain the account. Sign out and repeat from `/login`. Existing users should return to their existing role's dashboard.

For Location Admin registration, choose Location Admin before clicking Google. An account without an assigned profile starts as pending, and the existing application form opens. An existing tourist email is rejected and keeps its tourist role; use a different Google email to register as Location Admin. Existing location administrators keep their role. Administrator access still requires the existing approval process. This path needs the backend running with its existing admin credentials. If a database trigger automatically assigns every new Google account a tourist profile, that account is treated as assigned and cannot register as Location Admin; the trigger must be reviewed before enabling that onboarding path. Do not work around this by converting tourist profiles.

Also test cancelling Google's consent screen, email/password login, email registration, and password recovery. Check `/login` and `/register` on a narrow screen and at browser zoom: the page should scroll with comfortably spaced fields.

If Google shows `redirect_uri_mismatch`, compare Google's authorized redirect URI with the Supabase callback exactly. If Supabase reports that the provider is disabled, enable and save Google. If the return goes to the wrong page, check the app callback entries above. If a profile cannot be created, inspect existing `profiles` insert/select policies for the authenticated user's own ID; do not disable RLS. The integration uses the existing profile creation mechanism and requires no schema migration.

References: [Supabase Google authentication](https://supabase.com/docs/guides/auth/social-login/auth-google), [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).
