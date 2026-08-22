import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabaseClient";
import { getOwnProfile, profileFromUser } from "../../services/profileService";

import TouristDashboard from "./TouristDashboard";
import TouristLayout from "./TouristLayout";
import EcologicalMonitoring from "./EcologicalMonitoring";
import CarbonCalculator from "./CarbonCalculator";
import TouristProfile from "./TouristProfile";
import TripHistory from "./TripHistory";
import AchievementBadges from "./AchievementBadges";

export default function TouristWorkspace() {
  const navigate = useNavigate();

  const [page, setPage] = useState("dashboard");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user: loggedInUser },
        error,
      } = await supabase.auth.getUser();

      if (error || !loggedInUser) {
        navigate("/login", { replace: true });
        return;
      }

      setUser(loggedInUser);

      try {
        setProfile(await getOwnProfile(loggedInUser));
      } catch (profileError) {
        console.error("Profile loading failed:", profileError.message);
        setProfile(profileFromUser(loggedInUser));
      }

      setLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        navigate("/login", { replace: true });
        return;
      }

      setUser(session.user);
      getOwnProfile(session.user)
        .then(setProfile)
        .catch(() => setProfile(profileFromUser(session.user)));
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout failed:", error.message);
      return;
    }

    navigate("/login", { replace: true });
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading your account...</p>
      </div>
    );
  }

  return (
    <TouristLayout
      activePage={page}
      onNavigate={setPage}
      user={user}
      profile={profile}
      onLogout={handleLogout}
    >
      {page === "dashboard" ? (
        <TouristDashboard onNavigate={setPage} user={user} profile={profile} />
      ) : page === "carbon" ? (
        <CarbonCalculator user={user} />
      ) : page === "history" ? (
        <TripHistory onNavigate={setPage} user={user} />
      ) : page === "achievements" ? (
        <AchievementBadges onNavigate={setPage} user={user} profile={profile} />
      ) : page === "monitoring" ? (
        <EcologicalMonitoring onNavigate={setPage} />
      ) : page === "profile" ? (
        <TouristProfile
          user={user}
          profile={profile}
          onProfileChange={setProfile}
        />
      ) : (
        <section className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-green-600">
            Coming next
          </p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            {page.replace(/^./, (letter) => letter.toUpperCase())} module
          </h1>
        </section>
      )}
    </TouristLayout>
  );
}
