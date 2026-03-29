import { useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Home, RotateCcw, TrendingUp } from "lucide-react";

interface Result {
  id: number;
  userId: number;
  score: number | string;
  correctAnswers: number;
  wrongAnswers: number;
  unanswered: number;
  timeTaken: number;
  totalQuestions: number;
  performanceByTopic?: Record<string, { correct: number; total: number }>;
  answerDetails?: any[];
}

export default function Results() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/results/:resultId");
  const resultId = params?.resultId ? Number(params.resultId) : NaN;

  const resultQuery = trpc.results.getResult.useQuery(
    { resultId },
    {
      enabled: isAuthenticated && match && Number.isFinite(resultId),
      retry: false,
    }
  );

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) {
    return null;
  }

  if (resultQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-muted-foreground">Loading results...</p>
      </div>
    );
  }

  if (resultQuery.error || !resultQuery.data) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-muted-foreground">Result not found</p>
      </div>
    );
  }

  const result: Result = resultQuery.data as Result;
  const scoreValue = Number(result.score);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const getScoreGrade = (score: number) => {
    if (score >= 80) return { grade: "A", color: "text-green-400" };
    if (score >= 70) return { grade: "B", color: "text-cyan-400" };
    if (score >= 60) return { grade: "C", color: "text-yellow-400" };
    if (score >= 50) return { grade: "D", color: "text-orange-400" };
    return { grade: "F", color: "text-red-400" };
  };

  const scoreGrade = getScoreGrade(scoreValue);

  // Prepare chart data
  const topicData = result.performanceByTopic
    ? Object.entries(result.performanceByTopic).map(([topic, data]) => ({
      name: topic,
      correct: data.correct,
      incorrect: data.total - data.correct,
      percentage: ((data.correct / data.total) * 100).toFixed(1),
    }))
    : [];

  const scoreData = [
    { name: "Correct", value: result.correctAnswers, fill: "#22d3ee" },
    { name: "Wrong", value: result.wrongAnswers, fill: "#f97316" },
    { name: "Unanswered", value: result.unanswered, fill: "#6b7280" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-md">
        <div className="container flex items-center justify-between h-16">
          <h1 className="text-2xl font-bold text-white">Exam Results</h1>
          <div className="flex gap-4">
            <Button
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 px-6 py-2 rounded-lg font-semibold text-white bg-muted/30 hover:bg-muted/50 transition-all"
            >
              <Home className="w-5 h-5" />
              Home
            </Button>
            <Button
              onClick={() => setLocation("/exam")}
              className="flex items-center gap-2 px-6 py-2 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 transition-all shadow-lg shadow-cyan-500/50"
            >
              <RotateCcw className="w-5 h-5" />
              Retake Exam
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-12">
        {/* Score Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Main Score */}
          <div className="md:col-span-2 bg-card/80 backdrop-blur-xl border border-border rounded-xl p-8 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground mb-2">Your Score</p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-6xl font-bold ${scoreGrade.color}`}>{scoreValue.toFixed(1)}%</span>
                  <span className={`text-4xl font-bold ${scoreGrade.color}`}>{scoreGrade.grade}</span>
                </div>
                <p className="text-muted-foreground mt-4">
                  {scoreValue >= 70
                    ? "Great job! You performed well on this exam."
                    : scoreValue >= 50
                      ? "Good effort! Keep practicing to improve."
                      : "Keep practicing! You'll improve with more attempts."}
                </p>
              </div>

              {/* Score Distribution Pie Chart */}
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={scoreData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {scoreData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} questions`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-4">
            <div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-6 shadow-2xl">
              <p className="text-muted-foreground text-sm mb-2">Correct Answers</p>
              <p className="text-3xl font-bold text-cyan-400">{result.correctAnswers}</p>
              <p className="text-xs text-muted-foreground mt-2">out of {result.totalQuestions}</p>
            </div>

            <div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-6 shadow-2xl">
              <p className="text-muted-foreground text-sm mb-2">Time Taken</p>
              <p className="text-3xl font-bold text-orange-400">{formatTime(result.timeTaken)}</p>
              <p className="text-xs text-muted-foreground mt-2">out of 60 minutes</p>
            </div>

            <div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-6 shadow-2xl">
              <p className="text-muted-foreground text-sm mb-2">Accuracy</p>
              <p className="text-3xl font-bold text-green-400">
                {((result.correctAnswers / result.totalQuestions) * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-2">of questions answered</p>
            </div>
          </div>
        </div>

        {/* Performance by Topic */}
        {topicData.length > 0 && (
          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-8 shadow-2xl mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-cyan-400" />
              Performance by Topic
            </h2>

            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topicData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #4b5563",
                      borderRadius: "8px",
                    }}
                    cursor={{ fill: "rgba(34, 211, 238, 0.1)" }}
                  />
                  <Legend />
                  <Bar dataKey="correct" stackId="a" fill="#22d3ee" name="Correct" />
                  <Bar dataKey="incorrect" stackId="a" fill="#f97316" name="Incorrect" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Topic Details Table */}
            <div className="mt-8 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-muted-foreground font-semibold">Topic</th>
                    <th className="text-center py-3 px-4 text-muted-foreground font-semibold">Correct</th>
                    <th className="text-center py-3 px-4 text-muted-foreground font-semibold">Total</th>
                    <th className="text-center py-3 px-4 text-muted-foreground font-semibold">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {topicData.map((topic, index) => (
                    <tr key={index} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 text-foreground">{topic.name}</td>
                      <td className="text-center py-3 px-4 text-cyan-400 font-semibold">{topic.correct}</td>
                      <td className="text-center py-3 px-4 text-muted-foreground">{topic.correct + topic.incorrect}</td>
                      <td className="text-center py-3 px-4">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${parseFloat(topic.percentage) >= 70
                              ? "bg-green-500/20 text-green-300"
                              : parseFloat(topic.percentage) >= 50
                                ? "bg-yellow-500/20 text-yellow-300"
                                : "bg-red-500/20 text-red-300"
                            }`}
                        >
                          {topic.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Answer Summary */}
        <div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6">Answer Summary</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-muted/20 rounded-lg p-4 border border-cyan-500/30">
              <p className="text-muted-foreground text-sm mb-2">Correct Answers</p>
              <p className="text-3xl font-bold text-cyan-400">{result.correctAnswers}</p>
            </div>

            <div className="bg-muted/20 rounded-lg p-4 border border-orange-500/30">
              <p className="text-muted-foreground text-sm mb-2">Wrong Answers</p>
              <p className="text-3xl font-bold text-orange-400">{result.wrongAnswers}</p>
            </div>

            <div className="bg-muted/20 rounded-lg p-4 border border-gray-500/30">
              <p className="text-muted-foreground text-sm mb-2">Unanswered</p>
              <p className="text-3xl font-bold text-gray-400">{result.unanswered}</p>
            </div>

            <div className="bg-muted/20 rounded-lg p-4 border border-cyan-500/30">
              <p className="text-muted-foreground text-sm mb-2">Total Questions</p>
              <p className="text-3xl font-bold text-cyan-400">{result.totalQuestions}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-12 flex gap-4 justify-center">
          <Button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 px-8 py-3 rounded-lg font-semibold text-white bg-muted/30 hover:bg-muted/50 transition-all"
          >
            <Home className="w-5 h-5" />
            Back to Home
          </Button>

          <Button
            onClick={() => setLocation("/exam")}
            className="flex items-center gap-2 px-8 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 transition-all shadow-lg shadow-cyan-500/50"
          >
            <RotateCcw className="w-5 h-5" />
            Retake Exam
          </Button>
        </div>
      </div>
    </div>
  );
}
