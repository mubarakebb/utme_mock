import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { AlertCircle, ChevronLeft, ChevronRight, Clock, CheckCircle2, XCircle } from "lucide-react";

interface Question {
  id: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  topic: string;
  difficulty: string;
}

interface ExamState {
  sessionId: number;
  questions: Question[];
  currentQuestionIndex: number;
  selectedAnswers: Record<number, string>;
  timeRemaining: number;
  isSubmitting: boolean;
}

interface AvailableExam {
  id: number;
  name: string;
  description: string | null;
  duration: number;
  availableAt: string | Date;
  questionIds: number[];
  subjectCounts: Array<{ subject: string; count: number }>;
  shuffleQuestionsPerUser: boolean;
}

export default function Exam() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [examState, setExamState] = useState<ExamState | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [timeWarning, setTimeWarning] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);

  const startExamMutation = trpc.exam.startExam.useMutation();
  const saveProgressMutation = trpc.exam.saveProgress.useMutation();
  const submitExamMutation = trpc.exam.submitExam.useMutation();
  const availableExamsQuery = trpc.exams.getAvailableForUser.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });

  const sessionId = examState?.sessionId;
  const currentQuestionIndex = examState?.currentQuestionIndex;
  const selectedAnswers = examState?.selectedAnswers;
  const isSubmitting = examState?.isSubmitting ?? false;
  const availableExams = (availableExamsQuery.data as AvailableExam[] | undefined) ?? [];

  const selectedExam = selectedExamId === null
    ? null
    : availableExams.find((exam) => exam.id === selectedExamId) ?? null;

  const configuredQuestionCount = selectedExam
    ? selectedExam.questionIds.length +
      selectedExam.subjectCounts.reduce((sum, entry) => sum + entry.count, 0)
    : 0;

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, setLocation]);

  useEffect(() => {
    if (selectedExamId !== null) return;
    if (availableExams.length === 0) return;
    setSelectedExamId(availableExams[0].id);
  }, [availableExams, selectedExamId]);

  // Timer effect
  useEffect(() => {
    if (!examState || showInstructions) return;

    const timer = setInterval(() => {
      setExamState(prev => {
        if (!prev) return prev;

        const newTimeRemaining = prev.timeRemaining - 1;
        setTimeWarning(newTimeRemaining < 300); // Warning when less than 5 minutes

        if (newTimeRemaining <= 0) {
          handleSubmitExam();
          return prev;
        }

        return { ...prev, timeRemaining: newTimeRemaining };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [examState, showInstructions]);

  // Auto-save when answer selection or question position changes.
  useEffect(() => {
    if (!sessionId || showInstructions || isSubmitting) return;

    const timeout = setTimeout(() => {
      void saveProgressMutation
        .mutateAsync({
          sessionId,
          currentQuestionIndex: currentQuestionIndex ?? 0,
          selectedAnswers: Object.fromEntries(
            Object.entries(selectedAnswers ?? {}).map(([key, value]) => [
              String(key),
              value,
            ])
          ),
        })
        .catch(error => {
          console.warn("Auto-save failed:", error);
        });
    }, 800);

    return () => clearTimeout(timeout);
  }, [
    currentQuestionIndex,
    isSubmitting,
    saveProgressMutation,
    selectedAnswers,
    sessionId,
    showInstructions,
  ]);

  const handleStartExam = async () => {
    if (!selectedExamId) return;

    try {
      const result = await startExamMutation.mutateAsync({
        examId: selectedExamId,
      });

      setExamState({
        sessionId: result.sessionId,
        questions: result.questions,
        currentQuestionIndex: 0,
        selectedAnswers: {},
        timeRemaining: result.timeLimit,
        isSubmitting: false,
      });

      setShowInstructions(false);
    } catch (error) {
      console.error("Failed to start exam:", error);
    }
  };

  const handleSelectAnswer = (option: string) => {
    if (!examState) return;

    const currentQuestion = examState.questions[examState.currentQuestionIndex];
    setExamState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        selectedAnswers: {
          ...prev.selectedAnswers,
          [currentQuestion.id]: option,
        },
      };
    });
  };

  const handleNextQuestion = () => {
    setExamState(prev => {
      if (!prev || prev.currentQuestionIndex >= prev.questions.length - 1) return prev;
      return { ...prev, currentQuestionIndex: prev.currentQuestionIndex + 1 };
    });
  };

  const handlePreviousQuestion = () => {
    setExamState(prev => {
      if (!prev || prev.currentQuestionIndex <= 0) return prev;
      return { ...prev, currentQuestionIndex: prev.currentQuestionIndex - 1 };
    });
  };

  const handleJumpToQuestion = (index: number) => {
    setExamState(prev => {
      if (!prev) return prev;
      return { ...prev, currentQuestionIndex: index };
    });
  };

  const handleSubmitExam = async () => {
    if (!examState) return;

    setExamState(prev => (prev ? { ...prev, isSubmitting: true } : prev));

    try {
      // Best-effort final progress flush before submit.
      await saveProgressMutation.mutateAsync({
        sessionId: examState.sessionId,
        currentQuestionIndex: examState.currentQuestionIndex,
        selectedAnswers: Object.fromEntries(
          Object.entries(examState.selectedAnswers).map(([key, value]) => [
            String(key),
            value,
          ])
        ),
      });

      const result = await submitExamMutation.mutateAsync({
        sessionId: examState.sessionId,
        selectedAnswers: examState.selectedAnswers,
      });

      setLocation(`/results/${result.resultId}`);
    } catch (error) {
      console.error("Failed to submit exam:", error);
      setExamState(prev => (prev ? { ...prev, isSubmitting: false } : prev));
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isAuthenticated) {
    return null;
  }

  // Instructions Screen
  if (showInstructions) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-card/80 backdrop-blur-xl border border-border rounded-xl p-8 shadow-2xl">
          <h1 className="heading-lg mb-6 text-white">
            {selectedExam?.name ?? "Practice Exam"}
          </h1>

          <div className="mb-6">
            <label className="block text-sm font-medium text-white mb-2">Choose Exam</label>
            <select
              value={selectedExamId ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedExamId(value ? Number(value) : null);
              }}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
              disabled={availableExamsQuery.isLoading || availableExams.length === 0}
            >
              {availableExams.length === 0 ? (
                <option value="">No available exams</option>
              ) : (
                availableExams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name} ({exam.questionIds.length + exam.subjectCounts.reduce((s, e) => s + e.count, 0)} questions)
                  </option>
                ))
              )}
            </select>
            {selectedExam?.description && (
              <p className="mt-2 text-xs text-muted-foreground">{selectedExam.description}</p>
            )}
            
            {/* No exams available messaging */}
            {availableExamsQuery.isLoading === false && availableExams.length === 0 && (
              <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <p className="text-sm text-amber-200 mb-2">
                  <strong>No exams available</strong>
                </p>
                {!user?.userGroup ? (
                  <p className="text-xs text-amber-100">
                    You haven't selected a group yet. <a href="/" className="underline hover:no-underline">Go back</a> to select your exam cohort.
                  </p>
                ) : (
                  <p className="text-xs text-amber-100">
                    No exams have been published for your group <strong>{user.userGroup}</strong> yet. Check back soon!
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Exam Details Badges */}
          {selectedExam && (
            <div className="mb-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 p-3">
                  <p className="text-xs text-cyan-300 font-medium">Questions</p>
                  <p className="text-lg font-bold text-white">{configuredQuestionCount}</p>
                </div>
                <div className="rounded-lg bg-purple-500/10 border border-purple-500/30 p-3">
                  <p className="text-xs text-purple-300 font-medium">Duration</p>
                  <p className="text-lg font-bold text-white">{selectedExam.duration}m</p>
                </div>
              </div>
              
              {selectedExam.groups && selectedExam.groups.length > 0 && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                  <p className="text-xs text-amber-300 font-medium mb-2">Group Requirements</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedExam.groups.map((group, idx) => (
                      <span 
                        key={idx} 
                        className="inline-block px-2 py-1 rounded text-xs bg-amber-500/20 text-amber-200 border border-amber-500/40"
                      >
                        {group.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-6 mb-8">
            <div className="flex gap-4">
              <AlertCircle className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-white mb-2">Important Instructions:</h3>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>• Total Questions: {configuredQuestionCount}</li>
                  <li>• Time Limit: {selectedExam?.duration ?? 0} minutes</li>
                  <li>• Each question has 4 options (A, B, C, D)</li>
                  <li>• You can navigate between questions freely</li>
                  <li>• Your progress is auto-saved</li>
                  <li>• Once submitted, you cannot change your answers</li>
                  <li>• Unanswered questions will be marked as incorrect</li>
                  {selectedExam?.shuffleQuestionsPerUser ? (
                    <li>• Questions are shuffled per user</li>
                  ) : (
                    <li>• Questions are served in a fixed order</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
              <p className="text-sm text-orange-300">
                <strong>Note:</strong> This is a practice exam. Your score will help you identify areas for improvement.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={handleStartExam}
              disabled={startExamMutation.isPending || !selectedExamId || configuredQuestionCount === 0}
              className="flex-1 px-6 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg shadow-cyan-500/50 disabled:opacity-50"
            >
              {startExamMutation.isPending ? "Starting..." : "Start Exam"}
            </Button>
            <Button
              onClick={() => setLocation("/")}
              variant="outline"
              className="flex-1 px-6 py-3 rounded-lg font-semibold text-white border-2 border-border hover:bg-muted/20 transition-all"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!examState) {
    return null;
  }

  const currentQuestion = examState.questions[examState.currentQuestionIndex];
  const selectedAnswer = examState.selectedAnswers[currentQuestion.id];
  const answeredCount = Object.keys(examState.selectedAnswers).length;

  const getQuestionStatus = (index: number) => {
    const q = examState.questions[index];
    if (examState.selectedAnswers[q.id]) {
      return "answered";
    }
    return "unanswered";
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Question {examState.currentQuestionIndex + 1} of {examState.questions.length}</p>
              <p className="text-xs text-muted-foreground">Answered: {answeredCount}/{examState.questions.length}</p>
            </div>
          </div>

          {/* Timer */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${timeWarning ? "bg-orange-500/20 border border-orange-500/50" : "bg-cyan-500/10 border border-cyan-500/30"}`}>
            <Clock className={`w-5 h-5 ${timeWarning ? "text-orange-400" : "text-cyan-400"}`} />
            <span className={`font-mono font-semibold ${timeWarning ? "text-orange-300" : "text-cyan-300"}`}>
              {formatTime(examState.timeRemaining)}
            </span>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmitExam}
            disabled={examState.isSubmitting}
            className="px-6 py-2 rounded-lg font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 transition-all shadow-lg shadow-orange-500/50 disabled:opacity-50"
          >
            {examState.isSubmitting ? "Submitting..." : "Submit Exam"}
          </Button>
        </div>
      </div>

      <div className="container py-8 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Question Area */}
        <div className="lg:col-span-3">
          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-8 shadow-2xl">
            {/* Question Header */}
            <div className="mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 mb-2">
                    {currentQuestion.topic}
                  </span>
                  <span className="inline-block ml-2 px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-300">
                    {currentQuestion.difficulty}
                  </span>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-6">{currentQuestion.questionText}</h2>
            </div>

            {/* Answer Options */}
            <div className="space-y-3 mb-8">
              {[
                { label: "A", text: currentQuestion.optionA },
                { label: "B", text: currentQuestion.optionB },
                { label: "C", text: currentQuestion.optionC },
                { label: "D", text: currentQuestion.optionD },
              ].map(option => (
                <button
                  key={option.label}
                  onClick={() => handleSelectAnswer(option.label)}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${selectedAnswer === option.label
                      ? "bg-cyan-500/20 border-cyan-500 text-white"
                      : "bg-muted/30 border-border hover:border-cyan-500/50 text-foreground"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center font-semibold ${selectedAnswer === option.label
                          ? "bg-cyan-500 border-cyan-500 text-white"
                          : "border-muted-foreground"
                        }`}
                    >
                      {selectedAnswer === option.label && "✓"}
                    </div>
                    <div>
                      <span className="font-semibold">{option.label}.</span> {option.text}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex gap-4">
              <Button
                onClick={handlePreviousQuestion}
                disabled={examState.currentQuestionIndex === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-muted/30 hover:bg-muted/50 transition-all disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
                Previous
              </Button>

              <Button
                onClick={handleNextQuestion}
                disabled={examState.currentQuestionIndex === examState.questions.length - 1}
                className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-muted/30 hover:bg-muted/50 transition-all disabled:opacity-50"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Question Navigator Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-6 shadow-2xl sticky top-24">
            <h3 className="font-bold text-white mb-4">Question Navigator</h3>
            <div className="grid grid-cols-5 gap-2">
              {examState.questions.map((q, index) => {
                const status = getQuestionStatus(index);
                const isCurrentQuestion = index === examState.currentQuestionIndex;

                return (
                  <button
                    key={index}
                    onClick={() => handleJumpToQuestion(index)}
                    className={`aspect-square rounded-lg font-semibold text-sm transition-all flex items-center justify-center ${isCurrentQuestion
                        ? "bg-cyan-500 text-white border-2 border-cyan-300 scale-110"
                        : status === "answered"
                          ? "bg-green-500/30 text-green-300 border border-green-500/50 hover:bg-green-500/50"
                          : "bg-muted/30 text-muted-foreground border border-border hover:bg-muted/50"
                      }`}
                    title={`Question ${index + 1} - ${status}`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-6 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-cyan-500"></div>
                <span className="text-muted-foreground">Current</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500/30 border border-green-500/50"></div>
                <span className="text-muted-foreground">Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-muted/30 border border-border"></div>
                <span className="text-muted-foreground">Unanswered</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
