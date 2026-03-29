import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { ArrowLeft, BookOpen } from "lucide-react";

export default function SignUp() {
  const [, setLocation] = useLocation();

  const handleBackHome = () => {
    setLocation("/");
  };

  const handleSignIn = () => {
    window.location.href = getLoginUrl();
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-md">
        <div className="container flex items-center justify-between h-16">
          <button
            onClick={handleBackHome}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-orange-500 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">AEI Master Class</span>
          </div>
          <div className="w-20"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Accent line */}
          <div className="flex justify-center mb-8">
            <div className="h-1 w-16 bg-gradient-to-r from-cyan-400 to-orange-500 rounded-full"></div>
          </div>

          <div className="text-center mb-8">
            <h1 className="heading-md text-white mb-3">Create Your Account</h1>
            <p className="text-muted-foreground">
              Join the ONLINE UTME/WAEC MASTER CLASS of Academic Excellence Initiative (AEI)
            </p>
          </div>

          {/* Sign-up Card */}
          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-6 shadow-2xl mb-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Create a strong password"
                  className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  placeholder="Confirm your password"
                  className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                />
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="terms"
                  className="mt-1"
                />
                <label htmlFor="terms" className="text-sm text-muted-foreground">
                  I agree to the Terms of Service and Privacy Policy
                </label>
              </div>
            </div>

            <Button
              className="w-full mt-6 px-6 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 transition-all duration-300 hover:scale-105 active:scale-95 text-base shadow-lg shadow-cyan-500/50"
              onClick={handleSignIn}
            >
              Create Account with Manus
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-card text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full border-2 border-border text-foreground hover:bg-muted/20 py-3"
              onClick={handleSignIn}
            >
              Sign Up with OAuth
            </Button>
          </div>

          {/* Sign In Link */}
          <div className="text-center">
            <p className="text-muted-foreground">
              Already have an account?{" "}
              <button
                onClick={handleSignIn}
                className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
              >
                Sign In
              </button>
            </p>
          </div>

          {/* Info Box */}
          <div className="mt-8 p-4 rounded-lg bg-card/50 border border-border">
            <p className="text-xs text-muted-foreground text-center">
              By signing up, you agree to our Terms of Service and have read our Privacy Policy. We use your data to improve your learning experience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
