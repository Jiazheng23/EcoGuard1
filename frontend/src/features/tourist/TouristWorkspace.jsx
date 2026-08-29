import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabaseClient";
import { getOwnProfile, profileFromUser } from "../../services/profileService";

import TouristDashboard from "./TouristDashboard";
import TouristLayout from "./TouristLayout";
import EcologicalMonitoring from "./EcologicalMonitoring";
import CarbonCalculator from "./CarbonCalculator";
import TouristProfile from "./TouristProfile";
import TouristHistory from "./TouristHistory";
import TouristAchievements from "./TouristAchievements";

export default function TouristWorkspace() {
  const navigate = useNavigate();

  const [page, setPage] = useState("dashboard");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculatorDestination, setCalculatorDestination] = useState(null);
  const [dashboardMessage, setDashboardMessage] = useState("");

  function handleNavigate(nextPage, options = {}) {
    if (nextPage !== "dashboard") {
      setDashboardMessage("");
    }
    if (nextPage === "carbon") {
      setCalculatorDestination(options.destination || null);
    }
    setPage(nextPage);
  }

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

  async function handleTripSaved(savedTrip) {
    const savedPoints = Number(savedTrip?.eco_points) || 0;
    const formattedPoints = savedPoints > 0 ? `+${savedPoints}` : String(savedPoints);

    setDashboardMessage(`Eco Score changed by ${formattedPoints}.`);
    setCalculatorDestination(null);
    setPage("dashboard");

    if (!user) return;

    try {
      setProfile(await getOwnProfile(user));
    } catch (profileError) {
      console.error("Eco Score refresh failed:", profileError.message);
    }
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
      onNavigate={handleNavigate}
      user={user}
      profile={profile}
      onLogout={handleLogout}
    >
      {page === "dashboard" ? (
        <TouristDashboard
          onNavigate={handleNavigate}
          user={user}
          profile={profile}
          successMessage={dashboardMessage}
          onDismissMessage={() => setDashboardMessage("")}
        />
      ) : page === "carbon" ? (
        <CarbonCalculator
          user={user}
          initialDestination={calculatorDestination}
          onTripSaved={handleTripSaved}
        />
      ) : page === "history" ? (
        <TouristHistory user={user} />
      ) : page === "achievements" ? (
        <TouristAchievements user={user} profile={profile} />
      ) : page === "monitoring" ? (
        <EcologicalMonitoring onNavigate={handleNavigate} />
      ) : page === "profile" ? (
        <TouristProfile
          user={user}
          profile={profile}
          onProfileChange={setProfile}
          onNavigate={handleNavigate}
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
