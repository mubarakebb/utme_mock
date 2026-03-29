import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { ArrowRight, BookOpen, Clock, TrendingUp, Award } from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      setLocation("/exam");
    } else {
      window.location.href = getLoginUrl();
    }
  };

  const handleAdminAccess = () => {
    if (isAuthenticated && user?.role === "admin") {
      setLocation("/admin");
    } else {
      window.location.href = getLoginUrl();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-orange-500 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">AEI Master Class</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-muted-foreground">Welcome, {user?.name}</span>
                {user?.role === "admin" && (
                  <Button
                    onClick={handleAdminAccess}
                    className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white"
                  >
                    Admin Dashboard
                  </Button>
                )}
                <Button
                  onClick={handleGetStarted}
                  className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white"
                >
                  Start Exam
                </Button>
              </>
            ) : (
              <Button
                onClick={() => (window.location.href = getLoginUrl())}
                className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        {/* Geometric accents */}
        <div className="absolute top-20 right-10 w-32 h-32 border-2 border-cyan-500/20 rounded-lg transform rotate-45"></div>
        <div className="absolute bottom-40 left-10 w-24 h-24 border-2 border-orange-500/20 rounded-full"></div>

        <div className="container max-w-4xl mx-auto text-center fade-in">
          <div className="mb-6 inline-block">
            <div className="h-1 w-16 bg-gradient-to-r from-cyan-400 to-orange-500 rounded-full mx-auto mb-4"></div>
          </div>

          <h1 className="heading-hero mb-6 text-white">
            ONLINE UTME/WAEC MASTER CLASS
          </h1>

          <p className="text-base md:text-lg text-cyan-300 mb-4 font-semibold tracking-wide">
            Academic Excellence Initiative (AEI)
          </p>

          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            A focused learning platform by AEI to help Nigerian students prepare for UTME and WAEC through realistic CBT practice, guided improvement, and consistent performance tracking.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              onClick={() => setLocation(isAuthenticated ? "/exam" : "/signup")}
              className="px-8 py-6 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 transition-all duration-300 hover:scale-105 active:scale-95 text-lg shadow-lg shadow-cyan-500/50"
            >
              {isAuthenticated ? "Start Practice Exam" : "Start Practice Now"}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            {isAuthenticated && user?.role === "admin" && (
              <Button
                onClick={() => setLocation("/admin")}
                className="px-8 py-6 rounded-lg font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 transition-all duration-300 hover:scale-105 active:scale-95 text-lg shadow-lg shadow-orange-500/50"
              >
                Admin Dashboard
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => window.open("https://aeinigeria.org/home/", "_blank", "noopener,noreferrer")}
              className="text-lg px-8 py-6 border-2 border-muted text-white hover:bg-muted/20"
            >
              About AEI
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 md:gap-8 mt-12">
            <div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-6 shadow-2xl">
              <div className="text-3xl md:text-4xl font-bold text-cyan-400 mb-2">1000+</div>
              <div className="text-sm md:text-base text-muted-foreground">Questions</div>
            </div>
            <div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-6 shadow-2xl">
              <div className="text-3xl md:text-4xl font-bold text-orange-400 mb-2">50K+</div>
              <div className="text-sm md:text-base text-muted-foreground">Students</div>
            </div>
            <div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-6 shadow-2xl">
              <div className="text-3xl md:text-4xl font-bold text-cyan-400 mb-2">98%</div>
              <div className="text-sm md:text-base text-muted-foreground">Success Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-card/30 border-y border-border">
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="heading-lg mb-4 text-white">Why Choose AEI Master Class?</h2>
            <div className="h-1 w-16 bg-gradient-to-r from-cyan-400 to-orange-500 rounded-full mx-auto"></div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Feature 1 */}
            <div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-6 shadow-2xl group hover:border-cyan-500/50 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Realistic Timing</h3>
                  <p className="text-muted-foreground">Experience authentic UTME and WAEC exam conditions with precise timing and countdown alerts.</p>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-6 shadow-2xl group hover:border-orange-500/50 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Performance Analytics</h3>
                  <p className="text-muted-foreground">Track your progress with detailed breakdowns by topic and difficulty level.</p>
                </div>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-6 shadow-2xl group hover:border-cyan-500/50 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Comprehensive Questions</h3>
                  <p className="text-muted-foreground">Curated questions across UTME and WAEC subject areas with detailed explanations and revision support.</p>
                </div>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-6 shadow-2xl group hover:border-orange-500/50 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center flex-shrink-0">
                  <Award className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Instant Feedback</h3>
                  <p className="text-muted-foreground">Get immediate results with detailed explanations for every question.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container max-w-3xl mx-auto text-center">
          <h2 className="heading-lg mb-6 text-white">Ready to Excel in UTME and WAEC?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join AEI learners building confidence, discipline, and higher exam performance through structured online practice.
          </p>
          <Button
            onClick={handleGetStarted}
            className="px-8 py-6 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 transition-all duration-300 hover:scale-105 active:scale-95 text-lg shadow-lg shadow-cyan-500/50"
          >
            Begin Your Journey
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-8 px-4">
        <div className="container text-center text-muted-foreground text-sm">
          <p>&copy; 2026 Academic Excellence Initiative (AEI). All rights reserved. Educational NGO for every child in Nigeria.</p>
        </div>
      </footer>
    </div>
  );
}
