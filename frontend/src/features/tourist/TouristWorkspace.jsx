import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../services/supabaseClient";
import { getOwnProfile, profileFromUser } from "../../services/profileService";

import TouristDashboard from "./TouristDashboard";
import TouristLayout from "./TouristLayout";
import EcologicalMonitoring from "./EcologicalMonitoring";
import CarbonCalculator from "./CarbonCalculator";
import TouristProfile from "./TouristProfile";
import TouristHistory from "./TouristHistory";
import TouristAchievements from "./TouristAchievements";
import LoadingScreen from "../../components/LoadingScreen";

const touristPages = new Set(["dashboard", "carbon", "history", "achievements", "monitoring", "profile"]);

function administratorWorkspace(profile) {
  if (profile?.role === "super_admin") return "/super_admin/dashboard";
  if (profile?.role === "location_admin") return "/location_admin/dashboard";
  if (profile?.role === "pending_location_admin") return "/location_admin/application";
  return "";
}

export default function TouristWorkspace() {
  const navigate = useNavigate();
  const { page: routePage } = useParams();

  const page = touristPages.has(routePage) ? routePage : "dashboard";
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculatorDestination, setCalculatorDestination] = useState(null);
  const [dashboardMessage, setDashboardMessage] = useState("");

  function handleNavigate(nextPage, options = {}) {
    const destinationPage = touristPages.has(nextPage) ? nextPage : "dashboard";
    if (nextPage !== "dashboard") {
      setDashboardMessage("");
    }
    if (nextPage === "carbon") {
      setCalculatorDestination(options.destination || null);
    }
    if (destinationPage !== page) {
      navigate(`/tourist/${destinationPage}`);
    }
  }

  useEffect(() => {
    if (!touristPages.has(routePage)) {
      navigate("/tourist/dashboard", { replace: true });
      return;
    }
  }, [navigate, routePage]);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      const {
        data: { user: loggedInUser },
        error,
      } = await supabase.auth.getUser();

      if (error || !loggedInUser) {
        navigate("/login", { replace: true });
        return;
      }

      let currentProfile;
      try {
        currentProfile = await getOwnProfile(loggedInUser);
      } catch (profileError) {
        console.error("Profile loading failed:", profileError.message);
        currentProfile = profileFromUser(loggedInUser);
      }

      if (!active) return;
      const adminRoute = administratorWorkspace(currentProfile);
      if (adminRoute) {
        navigate(adminRoute, { replace: true });
        return;
      }

      setUser(loggedInUser);
      setProfile(currentProfile);
      setLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session?.user) {
        navigate("/login", { replace: true });
        return;
      }

      getOwnProfile(session.user)
        .catch(() => profileFromUser(session.user))
        .then((currentProfile) => {
          if (!active) return;
          const adminRoute = administratorWorkspace(currentProfile);
          if (adminRoute) {
            navigate(adminRoute, { replace: true });
            return;
          }
          setUser(session.user);
          setProfile(currentProfile);
          setLoading(false);
        });
    });

    return () => {
      active = false;
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
    navigate("/tourist/dashboard");

    if (!user) return;

    try {
      setProfile(await getOwnProfile(user));
    } catch (profileError) {
      console.error("Eco Score refresh failed:", profileError.message);
    }
  }

  if (loading) {
    return (
      <LoadingScreen fullScreen label="Loading your account..." />
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
        <EcologicalMonitoring onNavigate={handleNavigate} user={user} />
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
